import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  wheelSlotsTable,
  userTasksTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.post("/init", async (req, res) => {
  const { id, username, first_name, last_name, photo_url } = req.body;
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);

  if (existing.length === 0) {
    const [user] = await db.insert(usersTable).values({
      id,
      username: username || null,
      firstName: first_name || "",
      lastName: last_name || "",
      photoUrl: photo_url || null,
    }).returning();
    res.json(user);
  } else {
    const [user] = await db.update(usersTable)
      .set({
        username: username || existing[0].username,
        firstName: first_name || existing[0].firstName,
        lastName: last_name || existing[0].lastName,
        photoUrl: photo_url || existing[0].photoUrl,
      })
      .where(eq(usersTable.id, id))
      .returning();
    res.json(user);
  }
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.post("/:id/spin", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.spins <= 0) {
    res.status(400).json({ error: "No spins available" });
    return;
  }

  const slots = await db.select().from(wheelSlotsTable).orderBy(wheelSlotsTable.displayOrder);

  if (slots.length === 0) {
    res.status(400).json({ error: "Wheel not configured" });
    return;
  }

  const totalWeight = slots.reduce((sum, s) => sum + s.probability, 0);
  if (totalWeight === 0) {
    res.status(400).json({ error: "All probabilities are zero" });
    return;
  }

  let rand = Math.random() * totalWeight;
  let winner = slots[slots.length - 1];
  for (const slot of slots) {
    rand -= slot.probability;
    if (rand <= 0) {
      winner = slot;
      break;
    }
  }

  await db.update(usersTable)
    .set({
      spins: sql`spins - 1`,
      balance: sql`balance + ${winner.amount}`,
    })
    .where(eq(usersTable.id, id));

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.json({ winner, user: updated, slotIndex: slots.findIndex(s => s.id === winner.id) });
});

export default router;
