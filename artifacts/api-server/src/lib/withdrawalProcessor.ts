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

// Inline buildMsg to avoid circular dependency with bot/index.ts
function utf16Len(s: string): number {
  let n = 0;
  for (const ch of s) n += (ch.codePointAt(0)! > 0xffff) ? 2 : 1;
  return n;
}
function buildMsgLocal(parts: { text: string; emojiId?: string }[]) {
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
      // Notify user — custom emoji message
      try {
        const amtStr = parseFloat(amount).toFixed(4);
        const { text: uText, entities: uEnt } = buildMsgLocal([
          { text: "✅", emojiId: "6008009744969637955" },
          { text: ` تم الموافقة على سحبك بنجاح!\n\n` },
          { text: "💵", emojiId: "5409048419211682843" },
          { text: ` المبلغ: ${amtStr} TON\n` },
          { text: "👛", emojiId: "5039557485157942342" },
          { text: ` العنوان: ${walletAddress}\n` },
          { text: `🔗 المرجع: ${result.txRef}` },
        ]);
        await bot.sendMessage(userId, uText, { entities: uEnt as any });
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
