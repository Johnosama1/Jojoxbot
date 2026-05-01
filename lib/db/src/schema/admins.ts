import { pgTable, bigint, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminsTable = pgTable("admins", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  username: text("username"),
  role: text("role").notNull().default("admin"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const botSettingsTable = pgTable("bot_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const insertAdminSchema = createInsertSchema(adminsTable).omit({ addedAt: true });
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof adminsTable.$inferSelect;
export type BotSetting = typeof botSettingsTable.$inferSelect;
