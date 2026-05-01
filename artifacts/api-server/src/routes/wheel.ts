import { Router } from "express";
import { db } from "@workspace/db";
import { wheelSlotsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const slots = await db.select().from(wheelSlotsTable).orderBy(wheelSlotsTable.displayOrder);
  res.json(slots);
});

export default router;
