import TelegramBot from "node-telegram-bot-api";
import { db } from "@workspace/db";
import {
  usersTable,
  botSettingsTable,
  withdrawalsTable,
} from "@workspace/db/schema";
import { eq, sql, desc, and, gt } from "drizzle-orm";
import { logger } from "../lib/logger";
import { executeAutoWithdrawal, isTonConfigured } from "../lib/withdrawalProcessor";
import {
  OWNER_USERNAME,
  isOwner,
  adminConvState,
  showAdminMenu,
  handleAdminCallback,
  handleAdminText,
} from "./admin";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

let bot: TelegramBot;

// ── In-bot captcha store ──────────────────────────────────────────────
interface CaptchaChallenge {
  answer: number;
  expires: number;
  firstName: string;
  attempts: number;
}
const captchaStore = new Map<number, CaptchaChallenge>();

setInterval(() => {
  const now = Date.now();
  for (const [id, c] of captchaStore) {
    if (now > c.expires) captchaStore.delete(id);
  }
}, 5 * 60_000).unref();

function buildCaptchaButtons(userId: number, correct: number): TelegramBot.InlineKeyboardButton[][] {
  const offsets = [1, 2, 3, -1, -2, -3].sort(() => Math.random() - 0.5);
  let wrong1 = correct + offsets[0];
  let wrong2 = correct + offsets[1];
  if (wrong1 <= 0) wrong1 = correct + 1;
  if (wrong2 <= 0) wrong2 = correct + 2;
  if (wrong2 === wrong1) wrong2 = wrong1 + 1;
  const shuffled = [correct, wrong1, wrong2].sort(() => Math.random() - 0.5);
  return [shuffled.map(n => ({ text: String(n), callback_data: `captcha_${userId}_${n}` }))];
}

async function sendCaptchaChallenge(chatId: number, userId: number, firstName: string) {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const correct = a + b;

  captchaStore.set(userId, {
    answer: correct,
    expires: Date.now() + 5 * 60_000,
    firstName,
    attempts: 0,
  });

  await bot.sendMessage(
    chatId,
    `👋 أهلاً ${firstName}!\n\n🔐 يجب عليك إكمال التحقق أولاً قبل استخدام البوت.\n\n📊 حل هذه المسألة:\n\n*${a} + ${b} = ?*\n\nاختر الإجابة الصحيحة:`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buildCaptchaButtons(userId, correct) },
    }
  );
}

// ── Lightweight command spam guard (no external deps) ─────────────────
const cmdTimestamps = new Map<number, number>();
const CMD_COOLDOWN_MS = 1_000; // max 1 command per second per user

function isCommandSpam(userId: number): boolean {
  const now = Date.now();
  const last = cmdTimestamps.get(userId);
  if (last && now - last < CMD_COOLDOWN_MS) return true;
  cmdTimestamps.set(userId, now);
  return false;
}

// Clean up every 10 minutes to avoid memory leak
setInterval(() => {
  const cutoff = Date.now() - CMD_COOLDOWN_MS * 10;
  for (const [id, ts] of cmdTimestamps) {
    if (ts < cutoff) cmdTimestamps.delete(id);
  }
}, 10 * 60_000).unref();

export function getBot(): TelegramBot {
  return bot;
}

// ── Shared welcome message sender ────────────────────────────────────
const utf16Len = (s: string): number => {
  let n = 0;
  for (const ch of s) n += (ch.codePointAt(0)! > 0xffff) ? 2 : 1;
  return n;
};

export interface MsgPart { text: string; emojiId?: string }
export const buildMsg = (parts: MsgPart[]) => {
  let text = "";
  let offset = 0;
  const entities: object[] = [];
  for (const p of parts) {
    if (p.emojiId) {
      entities.push({ type: "custom_emoji", offset, length: utf16Len(p.text), custom_emoji_id: p.emojiId });
    }
    text += p.text;
    offset += utf16Len(p.text);
  }
  return { text, entities };
};

export async function sendWelcomeMessage(chatId: number, userId: number, firstName: string) {
  const MINI_APP_URL =
    process.env.MINI_APP_URL ||
    `https://${process.env.REPLIT_DEV_DOMAIN}:3000/app/`;

  const { text: welcomeText, entities: welcomeEntities } = buildMsg([
    { text: "👋", emojiId: "5319007286004299794" },
    { text: ` أهلاً بيك في Jo-jokes\n\n` },
    { text: "😀", emojiId: "6129832240303051599" },
    { text: ` مرحباً يا ${firstName} في أسرع بوت ربح TON\n\n` },
    { text: "✨", emojiId: "6131673419768403090" },
    { text: " كيف تكسب من البوت" },
    { text: "❓", emojiId: "5436113877181941026" },
    { text: "\n\n" },
    { text: "✅", emojiId: "6203840986443944067" },
    { text: " أكمل المهام " },
    { text: "⬅️", emojiId: "6131729520631223468" },
    { text: " لفات إضافية لكل " },
    { text: "5️⃣", emojiId: "6203785577070858514" },
    { text: " مهام\n\n" },
    { text: "👥", emojiId: "6204118338252049831" },
    { text: " ادعُ أصدقاءك " },
    { text: "⬅️", emojiId: "6131729520631223468" },
    { text: " لفة مجانية لكل " },
    { text: "5️⃣", emojiId: "6203785577070858514" },
    { text: " أصدقاء\n\n" },
    { text: "🎰", emojiId: "5104986024807760966" },
    { text: " دوّر العجلة " },
    { text: "⬅️", emojiId: "6131729520631223468" },
    { text: " اربح من 0.05 إلى 4 TON!\n\n" },
    { text: "🎁", emojiId: "6129832240303051599" },
    { text: " لديك " },
    { text: "✅", emojiId: "6203840986443944067" },
    { text: " لفات مجانية للبدء!" },
  ]);

  await bot.sendMessage(chatId, welcomeText, {
    entities: welcomeEntities as any,
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎁 Open now", web_app: { url: `${MINI_APP_URL}?uid=${userId}` } }],
      ],
    },
  });
}

export function initBot() {
  if (!TOKEN) {
    logger.warn("No TELEGRAM_BOT_TOKEN — bot disabled");
    return;
  }
  bot = new TelegramBot(TOKEN, { polling: true });
  bot.on("polling_error", (err) => {
    logger.error({ err }, "Bot polling error");
  });
  setupBotHandlers();
}

export function initBotWebhook(webhookUrl: string) {
  if (!TOKEN) {
    logger.warn("No TELEGRAM_BOT_TOKEN — bot disabled");
    return;
  }
  bot = new TelegramBot(TOKEN, {});
  bot.setWebHook(webhookUrl)
    .then(() => logger.info({ webhookUrl }, "Telegram webhook registered"))
    .catch(err => logger.error({ err }, "Failed to set webhook"));
  setupBotHandlers();
}

function setupBotHandlers() {
  // ───────────────────────────── /start ─────────────────────────────
  bot.onText(/\/start(.*)/, async (msg, match) => {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from!.id;
      if (isCommandSpam(userId)) return; // silent drop — don't reply
      const username = msg.from?.username;
      const firstName = msg.from?.first_name || "";
      const lastName = msg.from?.last_name || "";
      const refParam = match?.[1]?.trim();

      let referredBy: number | undefined;
      if (refParam?.startsWith("ref_")) {
        const refId = parseInt(refParam.replace("ref_", ""));
        if (!isNaN(refId) && refId !== userId) referredBy = refId;
      }

      const existing = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      // Block banned users
      if (existing.length > 0 && existing[0].isVisible === false) {
        await bot.sendMessage(chatId, "🚫 حسابك محظور من استخدام هذا البوت.", {
          
        });
        return;
      }

      const isNew = existing.length === 0;

      if (isNew) {
        const inserted = await db
          .insert(usersTable)
          .values({
            id: userId,
            username: username || null,
            firstName,
            lastName,
            referredBy: referredBy ?? null,
            spins: 1,
          })
          .onConflictDoNothing()
          .returning({ id: usersTable.id });

        if (inserted.length > 0 && referredBy) {
          const [refUser] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, referredBy))
            .limit(1);
          if (refUser) {
            const newCount = (refUser.referralCount || 0) + 1;
            const extraSpin = newCount % 5 === 0 ? 1 : 0;
            await db
              .update(usersTable)
              .set({
                referralCount: newCount,
                spins: sql`spins + ${extraSpin}`,
              })
              .where(eq(usersTable.id, referredBy));
            if (extraSpin > 0) {
              try {
                await bot.sendMessage(
                  referredBy,
                  `🎉 مبروك! وصلت إحالاتك إلى ${newCount} — حصلت على لفة مجانية!`,
                  { }
                );
              } catch { /* user may not have started bot */ }
            }
          }
        }
      } else {
        await db
          .update(usersTable)
          .set({
            username: username || existing[0].username,
            firstName: firstName || existing[0].firstName,
          })
          .where(eq(usersTable.id, userId));
      }

      // ── Verification gate ─────────────────────────────────────────
      const isVerified = !isNew && existing[0].ipVerifiedAt != null;

      if (!isVerified) {
        const MINI_APP_URL =
          process.env.MINI_APP_URL ||
          `https://${process.env.REPLIT_DEV_DOMAIN}:3000/app/`;

        const { text: verifyText, entities: verifyEntities } = buildMsg([
          { text: "👋", emojiId: "5339536521009571338" },
          { text: ` أهلاً ${firstName}!\n\n` },
          { text: "🎰", emojiId: "5102856631562011824" },
          { text: " مرحباً بك في Jo-jokes — أسرع بوت ربح TON!\n\n" },
          { text: "🔐", emojiId: "5197288647275071607" },
          { text: " خطوة واحدة للبدء:\n" },
          { text: "افتح التطبيق وأكمل التحقق السريع للحصول على وصول كامل." },
        ]);

        await bot.sendMessage(chatId, verifyText, {
          entities: verifyEntities as any,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔐 ابدأ التحقق والدخول", web_app: { url: MINI_APP_URL } }],
            ],
          },
        });
        return;
      }

      await sendWelcomeMessage(chatId, userId, firstName);
    } catch (err) {
      logger.error({ err }, "Error in /start handler");
    }
  });

  // ───────────────────────────── /top ───────────────────────────────
  bot.onText(/^\/top$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    if (isCommandSpam(userId)) return;
    try {
      const top = await db
        .select({
          id: usersTable.id,
          username: usersTable.username,
          firstName: usersTable.firstName,
          referralCount: usersTable.referralCount,
        })
        .from(usersTable)
        .where(and(eq(usersTable.isVisible, true), gt(usersTable.referralCount, 0)))
        .orderBy(desc(usersTable.referralCount))
        .limit(10);

      if (top.length === 0) {
        await bot.sendMessage(chatId, "🏆 لا يوجد متصدرون بعد. كن أول المتصدرين!");
        return;
      }

      const medals = ["🥇", "🥈", "🥉"];
      const rows = top.map((u, i) => {
        const medal = medals[i] ?? `${i + 1}.`;
        const name = u.username ? `@${u.username}` : (u.firstName || "مستخدم");
        return `${medal} ${name} — ${u.referralCount} إحالة`;
      });

      // Find current user's rank
      let myLine = "";
      const myPos = top.findIndex((u) => u.id === userId);
      if (myPos >= 0) {
        myLine = `\n\n🎯 أنت في المركز #${myPos + 1}`;
      } else {
        const [countRow] = await db
          .select({ cnt: sql<number>`count(*)` })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.isVisible, true),
              sql`referral_count > (SELECT referral_count FROM users WHERE id = ${userId})`
            )
          );
        const [me] = await db
          .select({ referralCount: usersTable.referralCount })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1);
        if (me && me.referralCount > 0) {
          myLine = `\n\n🎯 ترتيبك: #${Number(countRow.cnt) + 1} (${me.referralCount} إحالة)`;
        } else {
          myLine = "\n\n💡 ادعُ أصدقاءك لتصعد في الترتيب!";
        }
      }

      await bot.sendMessage(
        chatId,
        `🏆 *المتصدرون — أكثر المُحيلين*\n\n${rows.join("\n")}${myLine}`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      logger.error({ err }, "Error in /top handler");
    }
  });

  // ───────────────────────────── /admin ─────────────────────────────
  bot.onText(/^\/admin$/, async (msg) => {
    const userId = msg.from!.id;
    if (isCommandSpam(userId)) return;
    const username = msg.from?.username;
    const ok = await isOwner(userId, username);
    if (!ok) return;

    // Auto-save owner Telegram ID on first admin access
    const existing = await db
      .select()
      .from(botSettingsTable)
      .where(eq(botSettingsTable.key, "owner_telegram_id"))
      .limit(1);
    const isFirstTime = existing.length === 0;
    if (isFirstTime) {
      await db.insert(botSettingsTable).values({
        key: "owner_telegram_id",
        value: String(userId),
      });
      logger.info({ userId }, "Owner telegram ID saved automatically");

      // Re-send all pending withdrawal notifications that were missed
      try {
        const pendingWithdrawals = await db
          .select({ w: withdrawalsTable, u: usersTable })
          .from(withdrawalsTable)
          .leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
          .where(eq(withdrawalsTable.status, "pending"));

        for (const { w, u } of pendingWithdrawals) {
          await sendWithdrawalNotification(
            userId,
            { firstName: u?.firstName || "", username: u?.username, id: w.userId },
            w.amount,
            w.walletAddress,
            w.id
          );
        }
        if (pendingWithdrawals.length > 0) {
          logger.info({ count: pendingWithdrawals.length }, "Re-sent pending withdrawal notifications");
        }
      } catch (err) {
        logger.error({ err }, "Failed to re-send pending withdrawals");
      }
    }

    await showAdminMenu(bot, msg.chat.id);
  });

  // ───────────────────────────── /setowner ──────────────────────────
  bot.onText(/^\/setowner$/, async (msg) => {
    const userId = msg.from!.id;
    const username = msg.from?.username;
    if (username !== OWNER_USERNAME) return;

    await db
      .insert(botSettingsTable)
      .values({ key: "owner_telegram_id", value: String(userId) })
      .onConflictDoUpdate({
        target: botSettingsTable.key,
        set: { value: String(userId) },
      });

    await bot.sendMessage(
      msg.chat.id,
      `✅ تم تسجيلك كمالك البوت!\nID: ${userId}\nالآن يمكنك استخدام /admin للوحة التحكم`,
      { }
    );
  });

  // ───────────────────────────── /reset_all ─────────────────────────
  bot.onText(/^\/reset_all$/, async (msg) => {
    const userId = msg.from!.id;
    const username = msg.from?.username;
    const ok = await isOwner(userId, username);
    if (!ok) return;

    const chatId = msg.chat.id;

    // Confirmation step — ask before wiping
    await bot.sendMessage(chatId,
      "⚠️ *تحذير: إعادة ضبط كاملة*\n\n" +
      "سيتم مسح بيانات التحقق لجميع المستخدمين.\n" +
      "سيُطلب من كل مستخدم التحقق من جديد عند الدخول.\n\n" +
      "هل أنت متأكد؟",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ نعم، إعادة الضبط", callback_data: "owner:reset_all:confirm" },
              { text: "❌ إلغاء", callback_data: "owner:reset_all:cancel" },
            ],
          ],
        },
      }
    );
  });

  // ───────────────────────────── /reset_user ────────────────────────
  bot.onText(/^\/reset_user (.+)$/, async (msg, match) => {
    const userId = msg.from!.id;
    const username = msg.from?.username;
    const ok = await isOwner(userId, username);
    if (!ok) return;

    const target = match?.[1]?.trim();
    if (!target) return;

    const targetId = parseInt(target);
    if (isNaN(targetId)) {
      await bot.sendMessage(msg.chat.id, "⚠️ أرسل رقم ID صحيح. مثال: /reset_user 123456789");
      return;
    }

    await db.update(usersTable).set({
      ipVerifiedAt: null,
      deviceId: null,
      verificationToken: null,
    }).where(eq(usersTable.id, targetId));

    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
    await bot.sendMessage(
      msg.chat.id,
      `🔄 تم إعادة ضبط التحقق للمستخدم *${u?.firstName || targetId}* (${targetId}).\nسيُطلب منه التحقق مجدداً.`,
      { parse_mode: "Markdown" }
    );
  });

  // ───────────────────────────── Callback handlers ──────────────────
  bot.on("callback_query", async (q) => {
    if (!q.data) return;
    const data = q.data;

    // ── In-bot captcha verification ───────────────────────────────
    if (data.startsWith("captcha_")) {
      const parts = data.split("_");
      const targetUserId = parseInt(parts[1]);
      const chosen = parseInt(parts[2]);

      if (q.from.id !== targetUserId) {
        await bot.answerCallbackQuery(q.id, { text: "⛔ هذا التحقق ليس لك" });
        return;
      }

      const challenge = captchaStore.get(targetUserId);

      if (!challenge || Date.now() > challenge.expires) {
        await bot.answerCallbackQuery(q.id, { text: "⏰ انتهت صلاحية السؤال، اضغط /start مجدداً" });
        try {
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: q.message!.chat.id,
            message_id: q.message!.message_id,
          });
        } catch { /* ignore */ }
        return;
      }

      if (chosen === challenge.answer) {
        captchaStore.delete(targetUserId);
        await db
          .update(usersTable)
          .set({ ipVerifiedAt: new Date(), verificationToken: null })
          .where(eq(usersTable.id, targetUserId));

        await bot.answerCallbackQuery(q.id, { text: "✅ تم التحقق بنجاح!" });
        try {
          await bot.editMessageText("✅ تم التحقق بنجاح!", {
            chat_id: q.message!.chat.id,
            message_id: q.message!.message_id,
            reply_markup: { inline_keyboard: [] },
          });
        } catch { /* ignore */ }

        await sendWelcomeMessage(q.message!.chat.id, targetUserId, challenge.firstName);
      } else {
        challenge.attempts++;
        if (challenge.attempts >= 3) {
          captchaStore.delete(targetUserId);
          await bot.answerCallbackQuery(q.id, { text: "❌ محاولات كثيرة، اضغط /start للمحاولة مجدداً" });
          try {
            await bot.editMessageText(
              "❌ فشل التحقق — محاولات كثيرة خاطئة.\nاضغط /start للمحاولة مجدداً.",
              { chat_id: q.message!.chat.id, message_id: q.message!.message_id, reply_markup: { inline_keyboard: [] } }
            );
          } catch { /* ignore */ }
        } else {
          const remaining = 3 - challenge.attempts;
          const a = Math.floor(Math.random() * 9) + 1;
          const b = Math.floor(Math.random() * 9) + 1;
          const correct = a + b;
          challenge.answer = correct;

          await bot.answerCallbackQuery(q.id, { text: `❌ إجابة خاطئة! تبقى ${remaining} محاولة` });
          try {
            await bot.editMessageText(
              `❌ إجابة خاطئة! تبقى *${remaining}* محاولات.\n\n📊 سؤال جديد:\n\n*${a} + ${b} = ?*\n\nاختر الإجابة الصحيحة:`,
              {
                chat_id: q.message!.chat.id,
                message_id: q.message!.message_id,
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: buildCaptchaButtons(targetUserId, correct) },
              }
            );
          } catch { /* ignore */ }
        }
      }
      return;
    }

    // ── Owner: reset all users verification ──────────────────────────
    if (data === "owner:reset_all:confirm") {
      const ok = await isOwner(q.from.id, q.from.username);
      if (!ok) {
        await bot.answerCallbackQuery(q.id, { text: "⛔ غير مصرح" });
        return;
      }
      await bot.answerCallbackQuery(q.id, { text: "⏳ جاري إعادة الضبط..." });
      const result = await db.update(usersTable).set({
        ipVerifiedAt: null,
        deviceId: null,
        verificationToken: null,
        isVisible: true,
      });
      const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      try {
        await bot.editMessageText(
          `✅ *تم إعادة ضبط التحقق لجميع المستخدمين*\n\nعدد المستخدمين المتأثرين: *${count}*\nسيُطلب من الجميع التحقق مجدداً عند الدخول.`,
          {
            chat_id: q.message!.chat.id,
            message_id: q.message!.message_id,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [] },
          }
        );
      } catch { /* ignore */ }
      return;
    }

    if (data === "owner:reset_all:cancel") {
      const ok = await isOwner(q.from.id, q.from.username);
      if (!ok) return;
      await bot.answerCallbackQuery(q.id, { text: "❌ تم الإلغاء" });
      try {
        await bot.editMessageText("❌ تم إلغاء عملية إعادة الضبط.", {
          chat_id: q.message!.chat.id,
          message_id: q.message!.message_id,
          reply_markup: { inline_keyboard: [] },
        });
      } catch { /* ignore */ }
      return;
    }

    // Admin panel callbacks
    const handled = await handleAdminCallback(bot, q);
    if (handled) return;

    // Withdrawal approve/reject (legacy format)
    await handleWithdrawalCallback(q);
  });

  // ───────────────────────────── Text messages ──────────────────────
  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const userId = msg.from!.id;
    if (!adminConvState.has(userId)) return;

    const ok = await isOwner(userId, msg.from?.username);
    if (!ok) return;

    await handleAdminText(bot, msg);
  });

}

// ────────────────────────────────────────────────────────────────────
// Withdrawal callback (approve / reject)
// ────────────────────────────────────────────────────────────────────
async function handleWithdrawalCallback(q: TelegramBot.CallbackQuery) {
  const data = q.data ?? "";
  const chatId = q.message!.chat.id;
  const msgId = q.message!.message_id;
  const userId = q.from.id;
  const username = q.from.username;

  const ok = await isOwner(userId, username);
  if (!ok) {
    await bot.answerCallbackQuery(q.id, { text: "⛔ غير مصرح" });
    return;
  }

  if (data.startsWith("withdraw_approve_")) {
    const wdId = parseInt(data.replace("withdraw_approve_", ""));
    await processWithdrawal(bot, wdId, "approved", chatId, msgId, q.id);
  } else if (data.startsWith("withdraw_reject_")) {
    const wdId = parseInt(data.replace("withdraw_reject_", ""));
    await processWithdrawal(bot, wdId, "rejected", chatId, msgId, q.id);
  }
}

async function processWithdrawal(
  bot: TelegramBot,
  wdId: number,
  action: "approved" | "rejected",
  chatId: number,
  msgId: number,
  callbackId: string
) {
  try {
    const [wd] = await db
      .select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.id, wdId))
      .limit(1);

    if (!wd) {
      await bot.answerCallbackQuery(callbackId, { text: "❌ الطلب غير موجود" });
      return;
    }
    if (wd.status !== "pending") {
      await bot.answerCallbackQuery(callbackId, {
        text: `تمت معالجة هذا الطلب مسبقاً: ${wd.status}`,
      });
      return;
    }

    if (action === "rejected") {
      await db.update(withdrawalsTable)
        .set({ status: "rejected" })
        .where(eq(withdrawalsTable.id, wdId));
      await db.update(usersTable)
        .set({ balance: sql`balance + ${wd.amount}` })
        .where(eq(usersTable.id, wd.userId));
    } else {
      // approved — mark and trigger TON transfer
      await db.update(withdrawalsTable)
        .set({ status: "approved" })
        .where(eq(withdrawalsTable.id, wdId));
    }

    await bot.answerCallbackQuery(callbackId, {
      text: action === "approved" ? "✅ تمت الموافقة — جاري الإرسال..." : "❌ تم الرفض",
    });

    const autoMode = isTonConfigured();
    const statusText =
      action === "approved"
        ? autoMode
          ? `✅ تمت الموافقة — جاري إرسال ${parseFloat(wd.amount).toFixed(4)} TON`
          : `✅ تمت الموافقة على طلب السحب #${wdId}\nيرجى إرسال ${parseFloat(wd.amount).toFixed(4)} TON يدوياً إلى:\n\`${wd.walletAddress}\``
        : `❌ تم رفض طلب السحب #${wdId}\nتم إعادة ${parseFloat(wd.amount).toFixed(4)} TON للمستخدم.`;

    try {
      await bot.editMessageText(statusText, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [] },
      });
    } catch { /* ignore edit errors */ }

    // Notify user
    if (action === "rejected") {
      try {
        await bot.sendMessage(
          wd.userId,
          `❌ تم رفض طلب السحب\n\nتم إعادة ${parseFloat(wd.amount).toFixed(4)} TON لرصيدك.`
        );
      } catch { /* user may not be reachable */ }
    } else if (action === "approved" && !autoMode) {
      // Manual mode — notify user directly since no auto-processor will do it
      try {
        const amtStr = parseFloat(wd.amount).toFixed(4);
        const { text: uText, entities: uEnt } = buildMsg([
          { text: "✅", emojiId: "6008009744969637955" },
          { text: ` تم الموافقة على سحبك بنجاح!\n\n` },
          { text: "💵", emojiId: "5409048419211682843" },
          { text: ` المبلغ: ${amtStr} TON\n` },
          { text: "👛", emojiId: "5039557485157942342" },
          { text: ` العنوان: ${wd.walletAddress}` },
        ]);
        await bot.sendMessage(wd.userId, uText, { entities: uEnt as any });
      } catch { /* ignore */ }
    }

    // Fire-and-forget TON transfer if configured — pass admin chatId for completion notification
    if (action === "approved" && autoMode) {
      executeAutoWithdrawal(wdId, wd.userId, wd.walletAddress, wd.amount, chatId).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, "Error processing withdrawal");
    await bot.answerCallbackQuery(callbackId, { text: "❌ خطأ في المعالجة" });
  }
}

// ────────────────────────────────────────────────────────────────────
// Send withdrawal notification to owner
// ────────────────────────────────────────────────────────────────────
export async function sendWithdrawalNotification(
  ownerId: number,
  user: { firstName: string; username?: string | null; id: number },
  amount: string,
  wallet: string,
  withdrawalId: number
) {
  if (!bot) return;
  const uname = user.username ? `@${user.username}` : "—";
  const text =
    `💸 طلب سحب جديد #${withdrawalId}\n\n` +
    `👤 الاسم: ${user.firstName || "—"}\n` +
    `🔗 اليوزر: ${uname}\n` +
    `🆔 ID: ${user.id}\n` +
    `💰 المبلغ: ${parseFloat(amount).toFixed(4)} TON\n` +
    `📍 المحفظة:\n${wallet}`;

  try {
    await bot.sendMessage(ownerId, text, {
      
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ قبول", callback_data: `withdraw_approve_${withdrawalId}` },
            { text: "❌ رفض", callback_data: `withdraw_reject_${withdrawalId}` },
          ],
        ],
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to send withdrawal notification");
  }
}

export function setupCallbackHandlers() {
  // handled inline in initBot
}
