import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { initBot, setupCallbackHandlers } from "./bot";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const app: Express = express();

// Compress all responses (gzip/brotli) — huge win for JSON payloads
app.use(compression());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

initBot();
setupCallbackHandlers();

// ── Pre-warm DB connection so first user request isn't slow ──────────
db.execute(sql`SELECT 1`).catch(() => {});

export default app;
