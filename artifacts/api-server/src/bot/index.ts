import TelegramBot from "node-telegram-bot-api";
import { db } from "@workspace/db";
import {
  usersTable,
  tasksTable,
  userTasksTable,
  adminsTable,
  botSettingsTable,
  wheelSlotsTable,
  withdrawalsTable,
} from "@workspace/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const OWNER_USERNAME = "J_O_H_N8";

let bot: TelegramBot;

export function getBot(): TelegramBot {
  return bot;
}

export function initBot() {
  bot = new TelegramBot(TOKEN, { polling: true });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Polling error");
  });

  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const username = msg.from?.username;
    const firstName = msg.from?.first_name || "";
    const lastName = msg.from?.last_name || "";
    const refParam = match?.[1]?.trim();

    let referredBy: number | undefined;
    if (refParam && refParam.startsWith("ref_")) {
      const refId = parseInt(refParam.replace("ref_", ""));
      if (!isNaN(refId) && refId !== userId) referredBy = refId;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (existing.length === 0) {
      await db.insert(usersTable).values({
        id: userId,
        username: username || null,
        firstName,
        lastName,
        referredBy: referredBy || null,
      });

      if (referredBy) {
        const refUser = await db.select().from(usersTable).where(eq(usersTable.id, referredBy)).limit(1);
        if (refUser.length > 0) {
          const newCount = (refUser[0].referralCount || 0) + 1;
          let newSpins = refUser[0].spins;
          if (newCount % 5 === 0) newSpins += 1;
          await db.update(usersTable).set({ referralCount: newCount, spins: newSpins }).where(eq(usersTable.id, referredBy));
        }
      }
    }

    const MINI_APP_URL = process.env.MINI_APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}/app`;
    const BOT_USERNAME = process.env.BOT_USERNAME || "jojoxbot";

    const isNew = existing.length === 0;
    const greeting = isNew
      ? `أهلاً ${firstName}! 🎉\nيسعدنا انضمامك لعائلة *JojoX*`
      : `أهلاً مرحباً بعودتك ${firstName}! 👋`;

    const welcomeText =
      `${greeting}\n\n` +
      `🎡 *عجلة الحظ تنتظرك!*\n` +
      `دوّر العجلة واربح TON حقيقي كل يوم\n\n` +
      `✨ *كيف تكسب أكثر؟*\n` +
      `🔗 ادعُ أصدقاءك ← لفة مجانية لكل 5 أصدقاء\n` +
      `✅ أكمل المهام اليومية ← لفات إضافية\n` +
      `🎰 دوّر العجلة ← اربح من 0.05 إلى 5 TON!\n\n` +
      `💎 *ابدأ الآن وجرّب حظك!*`;

    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎡 العب الآن", web_app: { url: MINI_APP_URL } }],
          [
            { text: "👥 شارك مع أصدقائك", url: `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=ref_${userId}&text=🎰 العب عجلة الحظ واربح TON مجاناً!` },
          ],
        ],
      },
    });
  });

  bot.onText(/\/admin/, async (msg) => {
    const userId = msg.from!.id;
    const username = msg.from?.username;

    const isOwner = username === OWNER_USERNAME;
    const adminRecord = await db.select().from(adminsTable).where(eq(adminsTable.id, userId)).limit(1);

    if (!isOwner && adminRecord.length === 0) return;

    const MINI_APP_URL = process.env.MINI_APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}/app`;

    await bot.sendMessage(userId, "🔐 *لوحة التحكم*\nاختر من القائمة:", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⚙️ لوحة الأدمن", web_app: { url: `${MINI_APP_URL}?admin=1` } }],
        ],
      },
    });
  });

  logger.info("Telegram bot started");
}

export async function sendWithdrawalNotification(
  ownerId: number,
  user: { firstName: string; username?: string | null },
  amount: string,
  wallet: string,
  withdrawalId: number
) {
  const text =
    `💸 *طلب سحب جديد*\n\n` +
    `👤 الاسم: ${user.firstName}\n` +
    `🔗 اليوزر: @${user.username || "بدون يوزر"}\n` +
    `💰 المبلغ: ${amount} TON\n` +
    `📬 المحفظة: \`${wallet}\``;

  await bot.sendMessage(ownerId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ موافقة", callback_data: `approve_${withdrawalId}` },
          { text: "❌ رفض", callback_data: `reject_${withdrawalId}` },
        ],
      ],
    },
  });
}

export async function getOwnerTelegramId(): Promise<number | null> {
  const setting = await db.select().from(botSettingsTable).where(eq(botSettingsTable.key, "owner_telegram_id")).limit(1);
  if (setting.length > 0) return parseInt(setting[0].value);
  return null;
}

export async function setupCallbackHandlers() {
  bot.on("callback_query", async (query) => {
    const data = query.data || "";
    const chatId = query.message!.chat.id;
    const messageId = query.message!.id;

    if (data.startsWith("approve_") || data.startsWith("reject_")) {
      const withdrawalId = parseInt(data.split("_")[1]);
      const approved = data.startsWith("approve_");

      await db
        .update(withdrawalsTable)
        .set({ status: approved ? "approved" : "rejected", processedAt: new Date() })
        .where(eq(withdrawalsTable.id, withdrawalId));

      if (!approved) {
        const withdrawal = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, withdrawalId)).limit(1);
        if (withdrawal.length > 0) {
          await db
            .update(usersTable)
            .set({ balance: sql`balance + ${withdrawal[0].amount}` })
            .where(eq(usersTable.id, Number(withdrawal[0].userId)));
        }
      }

      await bot.editMessageText(
        approved ? "✅ تم الموافقة على السحب" : "❌ تم رفض السحب وإعادة الرصيد",
        { chat_id: chatId, message_id: messageId }
      );

      await bot.answerCallbackQuery(query.id);
    }
  });
}
