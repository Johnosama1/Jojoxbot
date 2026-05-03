import TelegramBot from "node-telegram-bot-api";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import {
  usersTable,
  botSettingsTable,
  withdrawalsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
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

interface MsgPart { text: string; emojiId?: string }
const buildMsg = (parts: MsgPart[]) => {
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
        // Reuse existing token or generate a new one
        const existingToken = !isNew ? existing[0].verificationToken : null;
        let token = existingToken;
        if (!token) {
          token = randomBytes(16).toString("hex");
          await db
            .update(usersTable)
            .set({ verificationToken: token })
            .where(eq(usersTable.id, userId));
        }

        const API_BASE_URL =
          process.env.API_BASE_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
          `https://${process.env.REPLIT_DEV_DOMAIN}`;
        const verifyUrl = `${API_BASE_URL}/api/verify?uid=${userId}&token=${token}`;

        await bot.sendMessage(
          chatId,
          `👋 أهلاً ${firstName}!\n\n🔐 يجب عليك إكمال التحقق أولاً قبل استخدام البوت.\n\n📋 الخطوات:\n1️⃣ اضغط على زر التحقق أدناه\n2️⃣ حل المسألة البسيطة\n3️⃣ عُد هنا واستمتع بالربح!`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ تحقق الآن", url: verifyUrl }],
              ],
            },
          },
        );
        return;
      }

      await sendWelcomeMessage(chatId, userId, firstName);
    } catch (err) {
      logger.error({ err }, "Error in /start handler");
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

  // ───────────────────────────── Callback handlers ──────────────────
  bot.on("callback_query", async (q) => {
    if (!q.data) return;

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

    // Notify user (only on rejection, on approval notify when transfer is complete)
    if (action === "rejected") {
      try {
        await bot.sendMessage(
          wd.userId,
          `❌ تم رفض طلب السحب\n\nتم إعادة ${parseFloat(wd.amount).toFixed(4)} TON لرصيدك.`
        );
      } catch { /* user may not be reachable */ }
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
