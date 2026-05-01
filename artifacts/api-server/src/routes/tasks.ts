import { Router } from "express";
import { db } from "@workspace/db";
import {
  tasksTable,
  userTasksTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const now = new Date();
  const tasks = await db.select().from(tasksTable).where(
    eq(tasksTable.isActive, true)
  );
  const activeTasks = tasks.filter(t => !t.expiresAt || t.expiresAt > now);
  res.json(activeTasks);
});

router.post("/:taskId/complete", async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (!task || !task.isActive) {
    res.status(404).json({ error: "Task not found or inactive" });
    return;
  }

  if (task.expiresAt && task.expiresAt < new Date()) {
    res.status(400).json({ error: "Task expired" });
    return;
  }

  const existing = await db.select().from(userTasksTable)
    .where(and(eq(userTasksTable.userId, userId), eq(userTasksTable.taskId, taskId)))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "Already completed" });
    return;
  }

  await db.insert(userTasksTable).values({ userId, taskId });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user) {
    const newTasksCompleted = (user.tasksCompleted || 0) + 1;
    let newSpins = user.spins;
    if (newTasksCompleted % 5 === 0) newSpins += 1;
    await db.update(usersTable)
      .set({ tasksCompleted: newTasksCompleted, spins: newSpins })
      .where(eq(usersTable.id, userId));
  }

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  res.json({ success: true, user: updated });
});

router.get("/:userId/completed", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const completed = await db.select().from(userTasksTable).where(eq(userTasksTable.userId, userId));
  res.json(completed.map(c => c.taskId));
});

export default router;
