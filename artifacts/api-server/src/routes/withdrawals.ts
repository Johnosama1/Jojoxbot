import { Router } from "express";
import rateLimit from "express-rate-limit";
import { db } from "@workspace/db";
import { withdrawalsTable, usersTable } from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { sendWithdrawalNotification } from "../bot";
import { getSetting } from "../lib/settingsCache";
import { executeAutoWithdrawal, isTonConfigured } from "../lib/withdrawalProcessor";

const router = Router();

const MIN_WITHDRAWAL = 0.1;
const MAX_WITHDRAWAL = 1000;

// TON address: EQ/UQ/kQ/0Q + 46 base64url chars
const TON_ADDRESS_RE = /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;

// Max 3 withdrawal requests per 10 minutes — keyed by IP (default)
const withdrawLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات سحب كثيرة، حاول بعد قليل" },
  skip: () => process.env.NODE_ENV !== "production",
});

router.post("/", withdrawLimiter, async (req, res) => {
  const { userId, amount, walletAddress } = req.body;

  if (!userId || !amount || !walletAddress) {
    res.status(400).json({ error: "الحقول مطلوبة" }); return;
  }

  const numUserId = parseInt(String(userId));
  if (isNaN(numUserId) || numUserId <= 0) {
    res.status(400).json({ error: "معرّف مستخدم غير صحيح" }); return;
  }

  const cleanAddress = String(walletAddress).trim();
  if (!TON_ADDRESS_RE.test(cleanAddress)) {
    res.status(400).json({ error: "عنوان محفظة TON غير صحيح. يجب أن يبدأ بـ EQ أو UQ ويتكون من 48 حرفاً." }); return;
  }

  const amt = parseFloat(String(amount));
  if (isNaN(amt) || amt < MIN_WITHDRAWAL || amt > MAX_WITHDRAWAL) {
    res.status(400).json({ error: `المبلغ يجب أن يكون بين ${MIN_WITHDRAWAL} و ${MAX_WITHDRAWAL} TON` }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, numUserId)).limit(1);
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  if (user.isVisible === false) { res.status(403).json({ error: "الحساب محظور" }); return; }

  if (parseFloat(user.balance) < amt) {
    res.status(400).json({ error: "الرصيد غير كافٍ" }); return;
  }

  // Deduct balance atomically
  await db.update(usersTable)
    .set({ balance: sql`balance - ${amt}` })
    .where(eq(usersTable.id, numUserId));

  // Determine mode — cached, no extra DB round-trip
  const [mode, ownerIdStr] = await Promise.all([
    getSetting("withdraw_mode"),
    getSetting("owner_telegram_id"),
  ]);

  const isAuto = mode === "auto" && isTonConfigured();
  const initialStatus = isAuto ? "approved" : "pending";

  const [withdrawal] = await db.insert(withdrawalsTable).values({
    userId: numUserId,
    amount: amt.toString(),
    walletAddress: cleanAddress,
    status: initialStatus,
  }).returning();

  if (isAuto) {
    // Fire-and-forget TON transfer
    executeAutoWithdrawal(withdrawal.id, numUserId, cleanAddress, amt.toString()).catch(() => {});
  } else {
    // Notify owner for manual approval
    try {
      if (ownerIdStr) {
        const ownerId = parseInt(ownerIdStr);
        sendWithdrawalNotification(
          ownerId,
          { firstName: user.firstName || "", username: user.username, id: numUserId },
          amt.toString(),
          cleanAddress,
          withdrawal.id,
        ).catch(() => {});
      }
    } catch { /* ignore */ }
  }

  res.json(withdrawal);
});

router.get("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const withdrawals = await db.select().from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, userId))
    .orderBy(desc(withdrawalsTable.createdAt));
  res.json(withdrawals);
});

export default router;
