import { Router } from "express";
import { getBot } from "../bot";

const router = Router();

// Telegram webhook endpoint — Telegram POSTs updates here
router.post("/bot/webhook", (req, res) => {
  const botInstance = getBot();
  if (!botInstance) {
    res.sendStatus(403);
    return;
  }
  try {
    botInstance.processUpdate(req.body);
  } catch { /* ignore */ }
  res.sendStatus(200);
});

export default router;
