import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, wheelSlotsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { telegramAuth, spinRateLimit } from "../middlewares/telegramAuth";

const router = Router();

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

  res.setHeader("Cache-Control", "no-store");
  res.json(user);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.setHeader("Cache-Control", "private, max-age=5");
  res.json(user);
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

export default router;
