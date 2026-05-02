import app from "./app";
import { logger } from "./lib/logger";
import { initBot, setupCallbackHandlers } from "./bot";
import { db } from "@workspace/db";
import { pool } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

// ── Start HTTP server immediately — don't block on bot or DB ──────────
const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  // ── Non-blocking post-startup tasks ──────────────────────────────
  // Pre-warm exactly 1 DB connection so first request is instant
  db.execute(sql`SELECT 1`).catch(() => {});

  // Start Telegram bot polling after HTTP is ready
  initBot();
  setupCallbackHandlers();
});

// ── Keep-alive: re-use connections, avoid TIME_WAIT accumulation ──────
server.keepAliveTimeout = 65_000;   // Slightly longer than ALB 60s
server.headersTimeout  = 66_000;

// ── Keep Replit awake — self-ping every 14 minutes in production ──────
if (process.env.NODE_ENV === "production") {
  const SELF_URL = `http://localhost:${port}/api/health`;
  const PING_INTERVAL = 14 * 60_000;

  setInterval(async () => {
    try {
      const res = await fetch(SELF_URL, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) logger.warn({ status: res.status }, "Keep-alive ping non-OK");
    } catch {
      // Ignore transient errors — don't crash the process
    }
  }, PING_INTERVAL);
}

// ── Graceful shutdown ─────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  // Force kill after 10 s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT",  () => shutdown("SIGINT"));
