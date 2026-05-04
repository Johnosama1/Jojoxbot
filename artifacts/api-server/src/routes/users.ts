import { Router } from "express";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { usersTable, wheelSlotsTable } from "@workspace/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { telegramAuth, spinRateLimit } from "../middlewares/telegramAuth";

const router = Router();

// Fixed salt — change this in production via IP_HASH_SALT env var
const IP_SALT = process.env.IP_HASH_SALT || "jojox_ip_salt_2025";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + IP_SALT).digest("hex");
}

function normalizeIp(raw: string): string {
  // Strip IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 → 1.2.3.4)
  return (raw || "").replace(/^::ffff:/, "").trim();
}

// ── Single-query upsert init — fast path for returning users ─────────
router.post("/init", telegramAuth, async (req, res) => {
  const { id, username, first_name, last_name, photo_url } = req.body;
  if (!id) { res.status(400).json({ error: "Missing id" }); return; }

  // Single upsert: insert new user OR update profile fields for existing user
  const [user] = await db
    .insert(usersTable)
    .values({
      id,
      username: username || null,
      firstName: first_name || "",
      lastName: last_name || "",
      photoUrl: photo_url || null,
      spins: 3,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        username: sql`COALESCE(${username || null}, users.username)`,
        firstName: sql`COALESCE(NULLIF(${first_name || ""}, ''), users.first_name)`,
        lastName: sql`COALESCE(NULLIF(${last_name || ""}, ''), users.last_name)`,
        photoUrl: sql`COALESCE(${photo_url || null}, users.photo_url)`,
      },
    })
    .returning();

  if (user.isVisible === false) {
    res.status(403).json({ error: "محظور", banned: true });
    return;
  }

  // Record IP for informational purposes only (no auto-ban)
  if (!user.ipVerifiedAt) {
    const rawIp = normalizeIp(req.ip || req.socket.remoteAddress || "");
    if (rawIp) {
      const ipHash = hashIp(rawIp);
      await db.update(usersTable).set({ ipHash }).where(eq(usersTable.id, user.id));
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({ ...user, isVerified: user.ipVerifiedAt != null });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.setHeader("Cache-Control", "private, max-age=5");
  res.json({ ...user, isVerified: user.ipVerifiedAt != null });
});

router.post("/:id/spin", telegramAuth, spinRateLimit, async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.isVisible === false) { res.status(403).json({ error: "محظور", banned: true }); return; }
  if (user.spins <= 0) { res.status(400).json({ error: "No spins available" }); return; }

  const slots = await db.select().from(wheelSlotsTable).orderBy(wheelSlotsTable.displayOrder);
  if (slots.length === 0) { res.status(400).json({ error: "Wheel not configured" }); return; }

  const totalWeight = slots.reduce((sum, s) => sum + s.probability, 0);
  if (totalWeight === 0) { res.status(400).json({ error: "All probabilities are zero" }); return; }

  let rand = Math.random() * totalWeight;
  let winner = slots[slots.length - 1];
  for (const slot of slots) {
    rand -= slot.probability;
    if (rand <= 0) { winner = slot; break; }
  }

  await db
    .update(usersTable)
    .set({ spins: sql`spins - 1`, balance: sql`balance + ${winner.amount}` })
    .where(eq(usersTable.id, id));

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.setHeader("Cache-Control", "no-store");
  res.json({ winner, user: updated, slotIndex: slots.findIndex(s => s.id === winner.id) });
});

// ── Save / update wallet address ────────────────────────────────────
const TON_ADDRESS_RE = /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;

router.put("/:id/wallet", telegramAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

  const { walletAddress } = req.body;
  if (!walletAddress) { res.status(400).json({ error: "walletAddress مطلوب" }); return; }

  const clean = String(walletAddress).trim();
  if (!TON_ADDRESS_RE.test(clean)) {
    res.status(400).json({ error: "عنوان محفظة TON غير صحيح. يجب أن يبدأ بـ EQ أو UQ ويتكون من 48 حرفاً." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ savedWalletAddress: clean })
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ savedWalletAddress: updated.savedWalletAddress });
});

export default router;
