import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_API = `https://api.telegram.org/bot${TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${TOKEN}`;

interface CachedSticker { filePath: string; contentType: string }
const cache = new Map<string, CachedSticker>();

async function resolveSticker(emojiId: string): Promise<CachedSticker> {
  if (cache.has(emojiId)) return cache.get(emojiId)!;

  const sRes = await fetch(`${TG_API}/getCustomEmojiStickers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ custom_emoji_ids: [emojiId] }),
  });
  const sData = await sRes.json() as {
    ok: boolean;
    result?: Array<{ thumbnail?: { file_id: string }; file_id: string; mime_type?: string }>;
  };

  if (!sData.ok || !sData.result?.length) throw new Error("Sticker not found");

  const sticker = sData.result[0];
  const fileId = sticker.thumbnail?.file_id ?? sticker.file_id;
  const contentType = sticker.thumbnail ? "image/webp" : (sticker.mime_type ?? "image/webp");

  const fRes = await fetch(`${TG_API}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  const fData = await fRes.json() as { ok: boolean; result?: { file_path: string } };

  if (!fData.ok || !fData.result?.file_path) throw new Error("File path not found");

  const entry: CachedSticker = { filePath: fData.result.file_path, contentType };
  cache.set(emojiId, entry);
  return entry;
}

router.get("/:emojiId", async (req: Request, res: Response) => {
  const { emojiId } = req.params;

  if (!emojiId || !/^\d+$/.test(emojiId)) {
    return res.status(400).json({ error: "Invalid emoji ID" });
  }

  try {
    const { filePath, contentType } = await resolveSticker(emojiId);

    const fileRes = await fetch(`${TG_FILE}/${filePath}`);
    if (!fileRes.ok) {
      cache.delete(emojiId);
      return res.status(502).json({ error: "Failed to fetch sticker" });
    }

    const buf = Buffer.from(await fileRes.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch (err) {
    logger.error({ err }, "Sticker fetch error");
    res.status(404).json({ error: "Sticker not found" });
  }
});

export default router;
