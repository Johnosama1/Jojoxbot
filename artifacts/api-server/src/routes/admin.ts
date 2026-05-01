import { Router } from "express";
import { db } from "@workspace/db";
import {
  tasksTable,
  wheelSlotsTable,
  usersTable,
  adminsTable,
  botSettingsTable,
  withdrawalsTable,
} from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";

const router = Router();

const OWNER_USERNAME = "J_O_H_N8";

async function isAdmin(userId: number): Promise<boolean> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.username === OWNER_USERNAME) return true;
  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.id, userId)).limit(1);
  return !!admin;
}

router.use(async (req, res, next) => {
  const userId = parseInt(req.headers["x-user-id"] as string || "0");
  if (!userId || !(await isAdmin(userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
});

// ---- Tasks ----
router.get("/tasks", async (req, res) => {
  const tasks = await db.select().from(tasksTable).orderBy(tasksTable.id);
  res.json(tasks);
});

router.post("/tasks", async (req, res) => {
  const { title, description, url, icon, expiresAt } = req.body;
  const [task] = await db.insert(tasksTable).values({
    title,
    description,
    url,
    icon: icon || "⭐",
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();
  res.json(task);
});

router.put("/tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, url, icon, isActive, expiresAt } = req.body;
  const [task] = await db.update(tasksTable).set({
    title,
    description,
    url,
    icon,
    isActive,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).where(eq(tasksTable.id, id)).returning();
  res.json(task);
});

router.delete("/tasks/:id", async (req, res) => {
  await db.delete(tasksTable).where(eq(tasksTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

// ---- Wheel Slots ----
router.get("/wheel", async (req, res) => {
  const slots = await db.select().from(wheelSlotsTable).orderBy(wheelSlotsTable.displayOrder);
  res.json(slots);
});

router.put("/wheel", async (req, res) => {
  const { slots } = req.body as { slots: { id: number; amount: string; probability: number }[] };
  for (const slot of slots) {
    await db.update(wheelSlotsTable).set({ amount: slot.amount, probability: slot.probability }).where(eq(wheelSlotsTable.id, slot.id));
  }
  const updated = await db.select().from(wheelSlotsTable).orderBy(wheelSlotsTable.displayOrder);
  res.json(updated);
});

router.post("/wheel", async (req, res) => {
  const { amount, probability, displayOrder } = req.body;
  const [slot] = await db.insert(wheelSlotsTable).values({ amount, probability, displayOrder }).returning();
  res.json(slot);
});

router.delete("/wheel/:id", async (req, res) => {
  await db.delete(wheelSlotsTable).where(eq(wheelSlotsTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

// ---- Users ----
router.get("/users", async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.get("/users/count", async (req, res) => {
  const [result] = await db.select({ count: count() }).from(usersTable);
  
  const settings = await db.select().from(botSettingsTable).where(eq(botSettingsTable.key, "show_user_count"));
  const showCount = settings.length === 0 || settings[0].value === "true";
  
  res.json({ count: result.count, showCount });
});

router.put("/users/:id/balance", async (req, res) => {
  const id = parseInt(req.params.id);
  const { balance, spins } = req.body;
  const updates: Record<string, unknown> = {};
  if (balance !== undefined) updates.balance = balance.toString();
  if (spins !== undefined) updates.spins = spins;
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  res.json(user);
});

// ---- Settings ----
router.get("/settings", async (req, res) => {
  const settings = await db.select().from(botSettingsTable);
  const obj: Record<string, string> = {};
  for (const s of settings) obj[s.key] = s.value;
  res.json(obj);
});

router.put("/settings", async (req, res) => {
  const { key, value } = req.body;
  const existing = await db.select().from(botSettingsTable).where(eq(botSettingsTable.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(botSettingsTable).set({ value }).where(eq(botSettingsTable.key, key));
  } else {
    await db.insert(botSettingsTable).values({ key, value });
  }
  res.json({ key, value });
});

// ---- Admins ----
router.get("/admins", async (req, res) => {
  const admins = await db.select().from(adminsTable);
  res.json(admins);
});

router.post("/admins", async (req, res) => {
  const { id, username } = req.body;
  const [admin] = await db.insert(adminsTable).values({ id, username }).returning();
  res.json(admin);
});

router.delete("/admins/:id", async (req, res) => {
  await db.delete(adminsTable).where(eq(adminsTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

// ---- Withdrawals ----
router.get("/withdrawals", async (req, res) => {
  const list = await db.select().from(withdrawalsTable).orderBy(withdrawalsTable.createdAt);
  res.json(list);
});

export default router;
