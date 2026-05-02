import { Router, type Request, type Response } from "express";
import { gunzip } from "zlib";
import { promisify } from "util";
import { logger } from "../lib/logger";

const router = Router();
const gunzipAsync = promisify(gunzip);

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_API = `https://api.telegram.org/bot${TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${TOKEN}`;

interface CachedSticker { buf: Buffer; contentType: string; format: string }
const cache = new Map<string, CachedSticker>();

// Emoji IDs used across the app — pre-loaded at startup
const KNOWN_IDS = [
  "5224607267797606837", // ⚡
  "5285313465135669781", // 🫂
  "6131757897480148214", // 🏆
  "5474371208176737086", // ✉️
  "5197269100878907942", // ✍️
];

async function fetchAndCache(emojiId: string): Promise<CachedSticker> {
  const hit = cache.get(emojiId);
  if (hit) return hit;

  // 1. Get sticker metadata
  const sRes = await fetch(`${TG_API}/getCustomEmojiStickers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ custom_emoji_ids: [emojiId] }),
  });
  const sData = await sRes.json() as { ok: boolean; result?: Array<{ file_id: string }> };
  if (!sData.ok || !sData.result?.length) throw new Error("Sticker not found");

  // 2. Get file path
  const fRes = await fetch(`${TG_API}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: sData.result[0].file_id }),
  });
  const fData = await fRes.json() as { ok: boolean; result?: { file_path: string } };
  if (!fData.ok || !fData.result?.file_path) throw new Error("File path not found");

  const filePath = fData.result.file_path;
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

  // 3. Download file
  const dlRes = await fetch(`${TG_FILE}/${filePath}`);
  if (!dlRes.ok) throw new Error("Failed to download sticker");
  const rawBuf = Buffer.from(await dlRes.arrayBuffer());

  let buf: Buffer;
  let format: string;
  let contentType: string;

  if (ext === "tgs") {
    // Decompress TGS (gzip → Lottie JSON) on server, send as JSON to client
    buf = await gunzipAsync(rawBuf);
    format = "lottie";
    contentType = "application/json";
  } else if (ext === "webm") {
    buf = rawBuf;
    format = "webm";
    contentType = "video/webm";
  } else {
    buf = rawBuf;
    format = "webp";
    contentType = "image/webp";
  }

  const entry: CachedSticker = { buf, contentType, format };
  cache.set(emojiId, entry);
  return entry;
}

// Pre-warm cache 3 seconds after server starts (sequentially to avoid Telegram rate limits)
setTimeout(async () => {
  for (const id of KNOWN_IDS) {
    try {
      await fetchAndCache(id);
    } catch (err) {
      logger.warn({ err, id }, "Failed to pre-cache sticker");
    }
  }
  logger.info("Sticker cache warmed");
}, 3000);

router.get("/:emojiId", async (req: Request, res: Response) => {
  const { emojiId } = req.params;
  if (!/^\d+$/.test(emojiId ?? "")) {
    return res.status(400).json({ error: "Invalid emoji ID" });
  }

  try {
    const { buf, contentType, format } = await fetchAndCache(emojiId);
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Sticker-Format", format);
    res.setHeader("Access-Control-Expose-Headers", "X-Sticker-Format");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch (err) {
    logger.error({ err }, "Sticker fetch error");
    res.status(404).json({ error: "Sticker not found" });
  }
});

export default router;
