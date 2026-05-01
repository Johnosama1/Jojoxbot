import { Router } from "express";
import { db } from "@workspace/db";
import {
  withdrawalsTable,
  usersTable,
  botSettingsTable,
} from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { sendWithdrawalNotification } from "../bot";

const router = Router();

const MIN_WITHDRAWAL = 0.1;

// TON address formats: EQ/UQ/kQ/0Q followed by 46 base64url chars (48 total)
const TON_ADDRESS_REGEX = /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;

function isValidTonAddress(address: string): boolean {
  return TON_ADDRESS_REGEX.test(address.trim());
}

router.post("/", async (req, res) => {
  const { userId, amount, walletAddress } = req.body;

  if (!userId || !amount || !walletAddress) {
    res.status(400).json({ error: "الحقول مطلوبة" });
    return;
  }

  const cleanAddress = String(walletAddress).trim();
  if (!isValidTonAddress(cleanAddress)) {
    res.status(400).json({
      error:
        "عنوان محفظة TON غير صحيح. يجب أن يبدأ بـ EQ أو UQ ويتكون من 48 حرفاً.",
    });
    return;
  }

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt < MIN_WITHDRAWAL) {
    res.status(400).json({
      error: `الحد الأدنى للسحب هو ${MIN_WITHDRAWAL} TON`,
    });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  if (parseFloat(user.balance) < amt) {
    res.status(400).json({ error: "الرصيد غير كافٍ" });
    return;
  }

  // Deduct balance
  await db
    .update(usersTable)
    .set({ balance: sql`balance - ${amt}` })
    .where(eq(usersTable.id, userId));

  // Check withdraw mode
  const modeSetting = await db
    .select()
    .from(botSettingsTable)
    .where(eq(botSettingsTable.key, "withdraw_mode"))
    .limit(1);
  const mode = modeSetting[0]?.value || "manual";

  const initialStatus = mode === "auto" ? "approved" : "pending";

  const [withdrawal] = await db
    .insert(withdrawalsTable)
    .values({
      userId,
      amount: amt.toString(),
      walletAddress: cleanAddress,
      status: initialStatus,
    })
    .returning();

  // Notify owner
  try {
    const ownerSetting = await db
      .select()
      .from(botSettingsTable)
      .where(eq(botSettingsTable.key, "owner_telegram_id"))
      .limit(1);

    if (ownerSetting.length > 0) {
      const ownerId = parseInt(ownerSetting[0].value);
      await sendWithdrawalNotification(
        ownerId,
        { firstName: user.firstName || "", username: user.username, id: user.id },
        amt.toString(),
        cleanAddress,
        withdrawal.id
      );
    }
  } catch {
    // Bot notification failed — non-fatal
  }

  res.json(withdrawal);
});

router.get("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, userId))
    .orderBy(desc(withdrawalsTable.createdAt));
  res.json(withdrawals);
});

export default router;
