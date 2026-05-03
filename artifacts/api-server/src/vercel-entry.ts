/**
 * Vercel serverless entry point.
 * Exports the Express app (no app.listen call).
 * Bot uses webhook mode instead of long-polling.
 */
import app from "./app";
import { initBotWebhook } from "./bot";
import { db } from "@workspace/db";
import { pool } from "@workspace/db";
import { sql } from "drizzle-orm";

// Warm-up DB connection (fire and forget)
db.execute(sql`SELECT 1`).catch(() => {});

// Determine webhook URL:
// 1. Explicit env var (set in Vercel project settings for stable prod URL)
// 2. VERCEL_URL (auto-set by Vercel per deployment)
const webhookUrl =
  process.env.BOT_WEBHOOK_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/bot/webhook` : "");

if (webhookUrl) {
  initBotWebhook(webhookUrl);
}

// Export app for Vercel — @vercel/node wraps it as a serverless handler
export default app;
