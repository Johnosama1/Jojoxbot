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
  amount: string
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

    try {
      if (bot) {
        await bot.sendMessage(
          userId,
          `✅ تم إرسال ${parseFloat(amount).toFixed(4)} TON إلى محفظتك تلقائياً!\n\n` +
          `📍 المحفظة: \`${walletAddress}\`\n` +
          `🔑 مرجع المعاملة: \`${result.txRef}\``,
          { parse_mode: "Markdown" }
        );
      }
    } catch { /* ignore notification error */ }

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

    try {
      if (bot) {
        await bot.sendMessage(
          userId,
          `❌ فشل إرسال ${parseFloat(amount).toFixed(4)} TON.\n` +
          `تم إعادة المبلغ لرصيدك. حاول مرة أخرى لاحقاً.`
        );
      }
    } catch { /* ignore */ }
  }
}
