import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

function verifyTelegramHash(initData: string, token: string): { valid: boolean; userId?: number } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };
    params.delete("hash");

    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (computedHash !== hash) return { valid: false };

    const userParam = params.get("user");
    const userId = userParam ? JSON.parse(userParam).id : undefined;
    return { valid: true, userId };
  } catch {
    return { valid: false };
  }
}

// In-memory rate limiter for spin endpoint
const spinTimestamps = new Map<number, number>();
const SPIN_COOLDOWN_MS = 3000;

export function spinRateLimit(req: Request, res: Response, next: NextFunction) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { next(); return; }

  const now = Date.now();
  const last = spinTimestamps.get(id);
  if (last && now - last < SPIN_COOLDOWN_MS) {
    res.status(429).json({ error: "يرجى الانتظار قليلاً قبل الدوران مجدداً" });
    return;
  }
  spinTimestamps.set(id, now);
  next();
}

export function telegramAuth(req: Request, res: Response, next: NextFunction) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { next(); return; }

  const initData = req.headers["x-telegram-init-data"] as string | undefined;

  if (!initData) {
    if (process.env.NODE_ENV !== "production") { next(); return; }
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { valid, userId } = verifyTelegramHash(initData, token);
  if (!valid) {
    res.status(401).json({ error: "Invalid authentication" });
    return;
  }

  // Verify the userId from initData matches the one in the request
  const bodyId = req.body?.id ? parseInt(String(req.body.id)) : undefined;
  const paramId = req.params?.id ? parseInt(req.params.id) : undefined;
  const routeUserId = bodyId ?? paramId;

  if (routeUserId && userId && routeUserId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
