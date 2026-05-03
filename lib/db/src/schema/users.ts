import { pgTable, bigint, text, integer, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  photoUrl: text("photo_url"),
  balance: numeric("balance", { precision: 18, scale: 6 }).notNull().default("0"),
  spins: integer("spins").notNull().default(0),
  referralCount: integer("referral_count").notNull().default(0),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  referredBy: bigint("referred_by", { mode: "number" }),
  isVisible: boolean("is_visible").notNull().default(true),
  ipHash: text("ip_hash"),
  ipVerifiedAt: timestamp("ip_verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
