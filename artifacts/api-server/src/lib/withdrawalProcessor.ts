import { db } from "@workspace/db";
import { withdrawalsTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendTon, isTonConfigured } from "./tonSender";
import { logger } from "./logger";

// Lazily import bot to avoid circular deps
function getBot() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../bot").getBot?.();
}

export { isTonConfigured };

export async function executeAutoWithdrawal(
  withdrawalId: number,
  userId: number,
  walletAddress: string,
  amount: string,
  adminChatId?: number
) {
  const bot = getBot();
  try {
    await db.update(withdrawalsTable)
      .set({ status: "processing" })
      .where(eq(withdrawalsTable.id, withdrawalId));

    const result = await sendTon(walletAddress, amount);

    await db.update(withdrawalsTable)
      .set({
        status: "completed",
        txHash: result.txRef,
        processedAt: new Date(),
      })
      .where(eq(withdrawalsTable.id, withdrawalId));

    // Get the withdrawal record to fetch estimated fee
    const [wd] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, withdrawalId)).limit(1);
    const estimatedFee = wd?.fee ? parseFloat(wd.fee).toFixed(4) : "0.05";

    if (bot) {
      // Notify user
      try {
        await bot.sendMessage(
          userId,
          `✅ تم إرسال ${parseFloat(amount).toFixed(4)} TON بنجاح!\n\n` +
          `💲 المبلغ: ${parseFloat(amount).toFixed(4)} TON\n` +
          `👛 العنوان: \`${walletAddress}\`\n` +
          `🔗 المرجع: \`${result.txRef}\``,
          { parse_mode: "Markdown" }
        );
      } catch { /* ignore */ }

      // Notify admin
      if (adminChatId) {
        try {
          await bot.sendMessage(
            adminChatId,
            `✅ تم إرسال *${parseFloat(amount).toFixed(4)} TON* بنجاح!\n\n` +
            `💲 المبلغ للمستخدم: *${parseFloat(amount).toFixed(4)} TON*\n` +
            `⚡ الرسم المخصوم منك: *${estimatedFee} TON*\n` +
            `👛 العنوان: \`${walletAddress}\`\n` +
            `🔗 المرجع: \`${result.txRef}\``,
            { parse_mode: "Markdown" }
          );
        } catch { /* ignore */ }
      }
    }

  } catch (err) {
    logger.error({ err, withdrawalId }, "TON transfer failed");

    // Refund balance
    await db.update(usersTable)
      .set({ balance: sql`balance + ${amount}` })
      .where(eq(usersTable.id, userId));

    const errMsg = err instanceof Error ? err.message : String(err);
    await db.update(withdrawalsTable)
      .set({ status: "failed", errorMsg: errMsg })
      .where(eq(withdrawalsTable.id, withdrawalId));

    if (bot) {
      // Notify user
      try {
        await bot.sendMessage(
          userId,
          `❌ فشل إرسال ${parseFloat(amount).toFixed(4)} TON.\n` +
          `تم إعادة المبلغ لرصيدك. حاول مرة أخرى لاحقاً.`
        );
      } catch { /* ignore */ }

      // Notify admin
      if (adminChatId) {
        try {
          await bot.sendMessage(
            adminChatId,
            `❌ فشل إرسال *${parseFloat(amount).toFixed(4)} TON*\n` +
            `السبب: ${errMsg}`,
            { parse_mode: "Markdown" }
          );
        } catch { /* ignore */ }
      }
    }
  }
}
