import { Router } from "express";
import { db } from "@workspace/db";
import { withdrawalsTable, usersTable, botSettingsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendWithdrawalNotification } from "../bot";

const router = Router();

const MIN_WITHDRAWAL = 0.1;

router.post("/", async (req, res) => {
  const { userId, amount, walletAddress } = req.body;

  if (!userId || !amount || !walletAddress) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt < MIN_WITHDRAWAL) {
    res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} TON` });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (parseFloat(user.balance) < amt) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  await db.update(usersTable)
    .set({ balance: sql`balance - ${amt}` })
    .where(eq(usersTable.id, userId));

  const [withdrawal] = await db.insert(withdrawalsTable).values({
    userId,
    amount: amt.toString(),
    walletAddress,
    status: "pending",
  }).returning();

  try {
    const ownerSettings = await db.select().from(botSettingsTable).where(eq(botSettingsTable.key, "owner_telegram_id")).limit(1);
    if (ownerSettings.length > 0) {
      const ownerId = parseInt(ownerSettings[0].value);
      await sendWithdrawalNotification(ownerId, { firstName: user.firstName || "", username: user.username }, amt.toString(), walletAddress, withdrawal.id);
    }
  } catch (_err) {
    // Bot notification failed silently
  }

  res.json(withdrawal);
});

router.get("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const withdrawals = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.userId, userId));
  res.json(withdrawals);
});

export default router;
