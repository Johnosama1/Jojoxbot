import TelegramBot from "node-telegram-bot-api";
import { db } from "@workspace/db";
import {
  usersTable,
  tasksTable,
  wheelSlotsTable,
  botSettingsTable,
  withdrawalsTable,
} from "@workspace/db/schema";
import { eq, desc, sql, count, ilike } from "drizzle-orm";

export const OWNER_USERNAME = "J_O_H_N8";

export async function checkChannelMembership(
  bot: TelegramBot,
  userId: number,
  channelUsername: string
): Promise<boolean> {
  try {
    const member = await bot.getChatMember(`@${channelUsername}`, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

interface ConvState {
  step: string;
  data: Record<string, unknown>;
}
export const adminConvState = new Map<number, ConvState>();

export async function isOwner(userId: number, username?: string): Promise<boolean> {
  try {
    const setting = await db
      .select()
      .from(botSettingsTable)
      .where(eq(botSettingsTable.key, "owner_telegram_id"))
      .limit(1);
    if (setting.length > 0 && setting[0].value) {
      return userId === parseInt(setting[0].value);
    }
  } catch { /* fall through */ }
  return username === OWNER_USERNAME;
}

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(botSettingsTable).where(eq(botSettingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(botSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: botSettingsTable.key, set: { value } });
}

async function editOrSend(
  bot: TelegramBot,
  chatId: number,
  text: string,
  keyboard: TelegramBot.InlineKeyboardMarkup,
  messageId?: number
) {
  const opts = { parse_mode: "Markdown" as const, reply_markup: keyboard };
  if (messageId) {
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...opts });
      return;
    } catch { /* fall through to send */ }
  }
  await bot.sendMessage(chatId, text, opts);
}

export async function showAdminMenu(bot: TelegramBot, chatId: number, messageId?: number) {
  const [usersRes] = await db.select({ c: count() }).from(usersTable);
  const [pendingRes] = await db.select({ c: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));
  const text =
    `🎛 *لوحة التحكم — JojoX*\n\n` +
    `👥 المستخدمون: *${usersRes?.c ?? 0}*\n` +
    `💸 سحوبات معلقة: *${pendingRes?.c ?? 0}*\n\n` +
    `اختر من القائمة:`;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "🎡 العجلة", callback_data: "adm:wheel" },
        { text: "📋 المهام", callback_data: "adm:tasks" },
      ],
      [
        { text: "👥 المستخدمون", callback_data: "adm:users" },
        { text: "💸 السحوبات", callback_data: "adm:wd" },
      ],
      [
        { text: "⚙️ الإعدادات", callback_data: "adm:settings" },
        { text: "📊 الإحصائيات", callback_data: "adm:stats" },
      ],
    ],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

// ─────────────────────────── WHEEL ───────────────────────────

async function showWheelMenu(bot: TelegramBot, chatId: number, messageId?: number) {
  const slots = await db.select().from(wheelSlotsTable).orderBy(wheelSlotsTable.displayOrder);
  const total = slots.reduce((s, r) => s + r.probability, 0);
  const totalIcon = total === 100 ? "✅" : total > 100 ? "🔴" : "🟡";
  let text = `🎡 *إعدادات العجلة*\n${totalIcon} إجمالي الاحتمالات: *${total}%* (يجب = 100%)\n\n`;
  slots.forEach((s) => {
    const icon = s.probability > 0 ? "🟢" : "⚫";
    text += `${icon} ${parseFloat(s.amount).toFixed(3)} TON — *${s.probability}%*\n`;
  });
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      ...slots.map((s) => [
        {
          text: `✏️ ${parseFloat(s.amount).toFixed(3)} TON (${s.probability}%)`,
          callback_data: `adm:w:e:${s.id}`,
        },
        {
          text: `🗑️`,
          callback_data: `adm:w:del:${s.id}`,
        },
      ]),
      [
        { text: "➕ إضافة شريحة جديدة", callback_data: "adm:w:add" },
      ],
      [
        { text: "⚫ صفّر الكل", callback_data: "adm:w:zero" },
      ],
      [{ text: "◀️ رجوع", callback_data: "adm:main" }],
    ],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

// ─────────────────────────── TASKS ───────────────────────────

async function showTasksMenu(bot: TelegramBot, chatId: number, messageId?: number) {
  const tasks = await db.select().from(tasksTable).orderBy(tasksTable.id);
  let text = "📋 *إدارة المهام*\n\n";
  if (tasks.length === 0) {
    text += "لا توجد مهام بعد.\n";
  } else {
    tasks.forEach((t) => {
      text += `${t.isActive ? "✅" : "❌"} [${t.id}] ${t.title}\n`;
    });
  }
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      ...tasks.map((t) => [
        {
          text: `${t.isActive ? "✅" : "❌"} ${t.title.substring(0, 28)}`,
          callback_data: `adm:t:v:${t.id}`,
        },
      ]),
      [{ text: "➕ إضافة مهمة جديدة", callback_data: "adm:t:add" }],
      [{ text: "◀️ رجوع", callback_data: "adm:main" }],
    ],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

// ─────────────────────────── USERS ───────────────────────────

async function showUsersMenu(bot: TelegramBot, chatId: number, messageId?: number) {
  const [res] = await db.select({ c: count() }).from(usersTable);
  const total = res?.c ?? 0;
  const text =
    `👥 *إدارة المستخدمين*\n\n` +
    `إجمالي المستخدمين: *${total}*\n\n` +
    `ابحث بالـ ID أو @username:`;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "🔍 بحث عن مستخدم", callback_data: "adm:u:search" }],
      [{ text: "◀️ رجوع", callback_data: "adm:main" }],
    ],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

function showUserCard(
  bot: TelegramBot,
  chatId: number,
  u: typeof usersTable.$inferSelect
) {
  const safeName = `${u.firstName || "—"} ${u.lastName || ""}`.trim();
  const safeUsername = u.username ? `@${u.username}` : "—";
  const banned = u.isVisible === false;
  const info =
    `${banned ? "🚫 محظور" : "✅ نشط"} | المستخدم رقم: ${u.id}\n\n` +
    `الاسم: ${safeName}\n` +
    `اليوزر: ${safeUsername}\n` +
    `💰 الرصيد: ${parseFloat(u.balance).toFixed(4)} TON\n` +
    `🎰 اللفات: ${u.spins}\n` +
    `👥 الإحالات: ${u.referralCount}\n` +
    `✅ المهام المكتملة: ${u.tasksCompleted}`;
  return bot.sendMessage(chatId, info, {
    parse_mode: undefined,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💰 إضافة رصيد", callback_data: `adm:u:addbal:${u.id}` },
          { text: "💸 خصم رصيد", callback_data: `adm:u:subbal:${u.id}` },
        ],
        [
          { text: "✏️ تعيين رصيد محدد", callback_data: `adm:u:bal:${u.id}` },
          { text: "🎰 تعديل اللفات", callback_data: `adm:u:spins:${u.id}` },
        ],
        [
          banned
            ? { text: "✅ رفع الحظر", callback_data: `adm:u:unban:${u.id}` }
            : { text: "🚫 حظر المستخدم", callback_data: `adm:u:ban:${u.id}` },
        ],
        [{ text: "◀️ رجوع للمستخدمين", callback_data: "adm:users" }],
      ],
    },
  });
}

// ─────────────────────────── WITHDRAWALS ───────────────────────────

async function showWithdrawalsMenu(bot: TelegramBot, chatId: number, messageId?: number, tab: "pending" | "all" = "pending") {
  const statusIcon = (s: string) => s === "pending" ? "⏳" : s === "approved" ? "✅" : "❌";

  if (tab === "all") {
    const all = await db
      .select()
      .from(withdrawalsTable)
      .orderBy(desc(withdrawalsTable.createdAt))
      .limit(15);
    let text = `📋 سجل جميع السحوبات (آخر ${all.length})\n\n`;
    if (all.length === 0) {
      text += "لا توجد سحوبات بعد.";
    } else {
      all.forEach((w) => {
        text += `${statusIcon(w.status)} #${w.id} — ${parseFloat(w.amount).toFixed(3)} TON — ID: ${w.userId}\n`;
      });
    }
    const keyboard: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: [
        ...all.map((w) => [
          { text: `${statusIcon(w.status)} #${w.id} — ${parseFloat(w.amount).toFixed(2)} TON`, callback_data: `adm:wd:v:${w.id}` },
        ]),
        [
          { text: "⏳ المعلقة", callback_data: "adm:wd" },
          { text: "📋 الكل ✓", callback_data: "adm:wd:all" },
        ],
        [{ text: "◀️ رجوع", callback_data: "adm:main" }],
      ],
    };
    await editOrSend(bot, chatId, text, keyboard, messageId);
  } else {
    const pending = await db
      .select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.status, "pending"))
      .orderBy(desc(withdrawalsTable.createdAt))
      .limit(10);
    const [allRes] = await db.select({ c: count() }).from(withdrawalsTable);
    let text = `💸 طلبات السحب المعلقة\nمعلق: ${pending.length} | إجمالي: ${allRes?.c ?? 0}\n\n`;
    if (pending.length === 0) text += "لا توجد طلبات معلقة.";
    const keyboard: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: [
        ...pending.map((w) => [
          { text: `⏳ #${w.id} — ${parseFloat(w.amount).toFixed(2)} TON (${w.userId})`, callback_data: `adm:wd:v:${w.id}` },
        ]),
        [
          { text: "⏳ المعلقة ✓", callback_data: "adm:wd" },
          { text: "📋 الكل", callback_data: "adm:wd:all" },
        ],
        [{ text: "◀️ رجوع", callback_data: "adm:main" }],
      ],
    };
    await editOrSend(bot, chatId, text, keyboard, messageId);
  }
}

// ─────────────────────────── SETTINGS ───────────────────────────

async function showSettingsMenu(bot: TelegramBot, chatId: number, messageId?: number) {
  const mode = (await getSetting("withdraw_mode")) || "manual";
  const modeLabel = mode === "auto" ? "🟢 تلقائي" : "🔴 يدوي";
  const text =
    `⚙️ *إعدادات البوت*\n\n` +
    `وضع السحب الحالي: ${modeLabel}\n\n` +
    `*يدوي* → تأكيد يدوي من المالك.\n` +
    `*تلقائي* → موافقة تلقائية.`;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "🔴 يدوي", callback_data: "adm:set:mode:manual" },
        { text: "🟢 تلقائي", callback_data: "adm:set:mode:auto" },
      ],
      [{ text: "◀️ رجوع", callback_data: "adm:main" }],
    ],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

// ─────────────────────────── STATS ───────────────────────────

async function showStats(bot: TelegramBot, chatId: number, messageId?: number) {
  const [users] = await db.select({ c: count() }).from(usersTable);
  const [pending] = await db.select({ c: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));
  const [approved] = await db.select({ c: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "approved"));
  const [tasks] = await db.select({ c: count() }).from(tasksTable).where(eq(tasksTable.isActive, true));
  const [slots] = await db.select({ c: count() }).from(wheelSlotsTable);
  const text =
    `📊 *الإحصائيات*\n\n` +
    `👥 المستخدمون: *${users?.c ?? 0}*\n` +
    `📋 المهام النشطة: *${tasks?.c ?? 0}*\n` +
    `🎡 شرائح العجلة: *${slots?.c ?? 0}*\n` +
    `💸 سحوبات معلقة: *${pending?.c ?? 0}*\n` +
    `✅ سحوبات موافق عليها: *${approved?.c ?? 0}*`;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: "◀️ رجوع", callback_data: "adm:main" }]],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

// ─────────────────────────── MAIN CALLBACK HANDLER ───────────────────────────

export async function handleAdminCallback(
  bot: TelegramBot,
  q: TelegramBot.CallbackQuery
): Promise<boolean> {
  const data = q.data ?? "";
  if (!data.startsWith("adm:")) return false;

  const chatId = q.message!.chat.id;
  const msgId = q.message!.message_id;
  const userId = q.from.id;
  const username = q.from.username;

  const ok = await isOwner(userId, username);
  if (!ok) {
    await bot.answerCallbackQuery(q.id, { text: "⛔ غير مصرح لك بالوصول" });
    return true;
  }
  await bot.answerCallbackQuery(q.id);

  const parts = data.split(":");
  const sec = parts[1];
  const act = parts[2];
  const p1 = parts[3];

  try {
    // ── Main navigation ──
    if (data === "adm:main") return (await showAdminMenu(bot, chatId, msgId), true);
    if (data === "adm:wheel") return (await showWheelMenu(bot, chatId, msgId), true);
    if (data === "adm:tasks") return (await showTasksMenu(bot, chatId, msgId), true);
    if (data === "adm:users") return (await showUsersMenu(bot, chatId, msgId), true);
    if (data === "adm:wd") return (await showWithdrawalsMenu(bot, chatId, msgId, "pending"), true);
    if (data === "adm:wd:all") return (await showWithdrawalsMenu(bot, chatId, msgId, "all"), true);
    if (data === "adm:settings") return (await showSettingsMenu(bot, chatId, msgId), true);
    if (data === "adm:stats") return (await showStats(bot, chatId, msgId), true);

    // ── Wheel ──
    if (data === "adm:w:zero") {
      await db.update(wheelSlotsTable).set({ probability: 0 });
      await showWheelMenu(bot, chatId, msgId);
    }

    else if (data === "adm:w:add") {
      adminConvState.set(userId, { step: "wheel_add_amount", data: { chatId, msgId } });
      await bot.sendMessage(chatId,
        "🎡 *إضافة شريحة جديدة*\n\nأدخل *المبلغ* بالـ TON (مثال: `0.5` أو `5`):",
        { parse_mode: "Markdown" });
    }

    else if (sec === "w" && act === "del" && p1) {
      await db.delete(wheelSlotsTable).where(eq(wheelSlotsTable.id, parseInt(p1)));
      await showWheelMenu(bot, chatId, msgId);
    }

    else if (sec === "w" && act === "e" && p1) {
      const slotId = parseInt(p1);
      const [slot] = await db.select().from(wheelSlotsTable).where(eq(wheelSlotsTable.id, slotId)).limit(1);
      if (slot) {
        adminConvState.set(userId, { step: "wheel_edit_amount", data: { slotId, chatId, msgId } });
        await bot.sendMessage(chatId,
          `✏️ تعديل شريحة *${parseFloat(slot.amount).toFixed(3)} TON*\n\nأدخل المبلغ الجديد (أو `-` للإبقاء على *${parseFloat(slot.amount).toFixed(3)}*):`,
          { parse_mode: "Markdown" });
      }
    }

    // ── Tasks ──
    else if (sec === "t" && act === "v" && p1) {
      const [t] = await db.select().from(tasksTable).where(eq(tasksTable.id, parseInt(p1))).limit(1);
      if (t) {
        const text =
          `📋 مهمة #${t.id}\n\n` +
          `${t.icon || "⭐"} ${t.title}\n` +
          `الوصف: ${t.description || "—"}\n` +
          `الرابط: ${t.url || "—"}\n` +
          `الحالة: ${t.isActive ? "✅ نشطة" : "❌ معطلة"}`;
        await bot.editMessageText(text, {
          chat_id: chatId, message_id: msgId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: t.isActive ? "❌ تعطيل" : "✅ تفعيل", callback_data: `adm:t:tog:${t.id}` },
                { text: "🗑️ حذف", callback_data: `adm:t:del:${t.id}` },
              ],
              [{ text: "◀️ رجوع للمهام", callback_data: "adm:tasks" }],
            ],
          },
        });
      }
    }

    else if (sec === "t" && act === "tog" && p1) {
      const [t] = await db.select().from(tasksTable).where(eq(tasksTable.id, parseInt(p1))).limit(1);
      if (t) await db.update(tasksTable).set({ isActive: !t.isActive }).where(eq(tasksTable.id, parseInt(p1)));
      await showTasksMenu(bot, chatId, msgId);
    }

    else if (sec === "t" && act === "del" && p1) {
      await db.delete(tasksTable).where(eq(tasksTable.id, parseInt(p1)));
      await showTasksMenu(bot, chatId, msgId);
    }

    else if (sec === "t" && act === "add") {
      adminConvState.set(userId, { step: "task_title", data: { chatId, msgId } });
      await bot.sendMessage(chatId, "📝 أدخل *عنوان المهمة*:", { parse_mode: "Markdown" });
    }

    // ── Users ──
    else if (sec === "u" && act === "search") {
      adminConvState.set(userId, { step: "user_search", data: {} });
      await bot.sendMessage(chatId,
        "🔍 أدخل *Telegram ID* أو *@username* للمستخدم:",
        { parse_mode: "Markdown" });
    }

    else if (sec === "u" && act === "addbal" && p1) {
      adminConvState.set(userId, { step: "user_addbal", data: { targetId: parseInt(p1) } });
      await bot.sendMessage(chatId,
        `💰 كم تريد *إضافته* لرصيد المستخدم \`${p1}\`؟\n_(مثال: 5 أو 0.5)_`,
        { parse_mode: "Markdown" });
    }

    else if (sec === "u" && act === "subbal" && p1) {
      adminConvState.set(userId, { step: "user_subbal", data: { targetId: parseInt(p1) } });
      await bot.sendMessage(chatId,
        `💸 كم تريد *خصمه* من رصيد المستخدم \`${p1}\`؟\n_(مثال: 5 أو 0.5)_`,
        { parse_mode: "Markdown" });
    }

    else if (sec === "u" && act === "bal" && p1) {
      adminConvState.set(userId, { step: "user_balance", data: { targetId: parseInt(p1) } });
      await bot.sendMessage(chatId,
        `✏️ أدخل الرصيد الجديد المحدد لـ \`${p1}\`\n_(مثال: 10.5)_`,
        { parse_mode: "Markdown" });
    }

    else if (sec === "u" && act === "spins" && p1) {
      adminConvState.set(userId, { step: "user_spins", data: { targetId: parseInt(p1) } });
      await bot.sendMessage(chatId,
        `🎰 أدخل عدد اللفات لـ \`${p1}\`\n_(مثال: 10 أو +5 أو -2)_`,
        { parse_mode: "Markdown" });
    }

    else if (sec === "u" && act === "ban" && p1) {
      const targetId = parseInt(p1);
      await db.update(usersTable).set({ isVisible: false }).where(eq(usersTable.id, targetId));
      try {
        await bot.sendMessage(targetId,
          "🚫 تم حظر حسابك من استخدام البوت. للاستفسار تواصل مع الدعم.");
      } catch { /* user may have blocked bot */ }
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      await bot.sendMessage(chatId, `🚫 تم حظر المستخدم ${u?.firstName || targetId} (${targetId}) بنجاح.`);
    }

    else if (sec === "u" && act === "unban" && p1) {
      const targetId = parseInt(p1);
      await db.update(usersTable).set({ isVisible: true }).where(eq(usersTable.id, targetId));
      try {
        await bot.sendMessage(targetId,
          "✅ تم رفع الحظر عن حسابك. يمكنك الآن استخدام البوت مجدداً!");
      } catch { /* user may have blocked bot */ }
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      await bot.sendMessage(chatId, `✅ تم رفع الحظر عن المستخدم ${u?.firstName || targetId} (${targetId}).`);
    }

    // ── Withdrawals ──
    else if (sec === "wd" && act === "v" && p1) {
      const [w] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, parseInt(p1))).limit(1);
      if (w) {
        const [u] = await db.select().from(usersTable).where(eq(usersTable.id, w.userId)).limit(1);
        const text =
          `💸 *طلب سحب #${w.id}*\n\n` +
          `👤 ${u?.firstName || "—"} @${u?.username || "—"}\n` +
          `🆔 \`${w.userId}\`\n` +
          `💰 *${parseFloat(w.amount).toFixed(4)} TON*\n` +
          `📍 \`${w.walletAddress}\`\n` +
          `الحالة: *${w.status}*`;
        await bot.editMessageText(text, {
          chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ قبول", callback_data: `withdraw_approve_${w.id}` },
                { text: "❌ رفض", callback_data: `withdraw_reject_${w.id}` },
              ],
              [{ text: "◀️ رجوع", callback_data: "adm:wd" }],
            ],
          },
        });
      }
    }

    // ── Settings ──
    else if (sec === "set" && act === "mode" && p1) {
      await setSetting("withdraw_mode", p1);
      await showSettingsMenu(bot, chatId, msgId);
    }
  } catch (err) {
    console.error("Admin callback error:", err);
    try { await bot.sendMessage(chatId, "❌ حدث خطأ، حاول مرة أخرى."); } catch { /* ignore */ }
  }

  return true;
}

// ─────────────────────────── TEXT HANDLER ───────────────────────────

export async function handleAdminText(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<boolean> {
  const userId = msg.from!.id;
  const state = adminConvState.get(userId);
  if (!state) return false;

  const text = msg.text?.trim() ?? "";
  const chatId = msg.chat.id;
  const clearState = () => adminConvState.delete(userId);

  try {
    // ── Wheel: add new slot (amount) ──
    if (state.step === "wheel_add_amount") {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, "❌ أدخل رقماً صحيحاً أكبر من 0");
        return true;
      }
      adminConvState.set(userId, { step: "wheel_add_prob", data: { ...state.data, amount } });
      await bot.sendMessage(chatId,
        `💡 المبلغ: *${amount} TON*\nالآن أدخل *الاحتمالية* (0–100):`,
        { parse_mode: "Markdown" });
      return true;
    }

    if (state.step === "wheel_add_prob") {
      const prob = parseInt(text);
      if (isNaN(prob) || prob < 0 || prob > 100) {
        await bot.sendMessage(chatId, "❌ أدخل رقماً بين 0 و 100");
        return true;
      }
      const { amount } = state.data as { amount: number };
      const maxOrder = await db.select({ m: sql<number>`max(display_order)` }).from(wheelSlotsTable);
      const nextOrder = ((maxOrder[0]?.m as number) || 0) + 1;
      await db.insert(wheelSlotsTable).values({
        amount: String(amount),
        probability: prob,
        displayOrder: nextOrder,
      });
      clearState();
      await bot.sendMessage(chatId,
        `✅ تمت إضافة شريحة *${amount} TON* بنسبة *${prob}%*`,
        { parse_mode: "Markdown" });
      const tmp = await bot.sendMessage(chatId, "جاري التحميل...");
      await showWheelMenu(bot, chatId, tmp.message_id);
      return true;
    }

    // ── Wheel: edit existing slot (amount first) ──
    if (state.step === "wheel_edit_amount") {
      const { slotId, chatId: sChat, msgId: sMsgId } = state.data as { slotId: number; chatId: number; msgId: number };
      const [slot] = await db.select().from(wheelSlotsTable).where(eq(wheelSlotsTable.id, slotId)).limit(1);
      const newAmount = text === "-" ? parseFloat(slot.amount) : parseFloat(text);
      if (isNaN(newAmount) || newAmount <= 0) {
        await bot.sendMessage(chatId, "❌ أدخل رقماً صحيحاً أكبر من 0 أو `-` للإبقاء");
        return true;
      }
      adminConvState.set(userId, { step: "wheel_edit_prob", data: { ...state.data, newAmount } });
      await bot.sendMessage(chatId,
        `💡 المبلغ: *${newAmount} TON*\nأدخل الاحتمالية الجديدة (0–100) أو `-` للإبقاء على *${slot.probability}%*:`,
        { parse_mode: "Markdown" });
      return true;
    }

    if (state.step === "wheel_edit_prob") {
      const { slotId, newAmount, chatId: sChat, msgId: sMsgId } = state.data as {
        slotId: number; newAmount: number; chatId: number; msgId: number;
      };
      const [slot] = await db.select().from(wheelSlotsTable).where(eq(wheelSlotsTable.id, slotId)).limit(1);
      const newProb = text === "-" ? slot.probability : parseInt(text);
      if (isNaN(newProb) || newProb < 0 || newProb > 100) {
        await bot.sendMessage(chatId, "❌ أدخل رقماً بين 0 و 100 أو `-` للإبقاء");
        return true;
      }
      await db.update(wheelSlotsTable)
        .set({ amount: String(newAmount), probability: newProb })
        .where(eq(wheelSlotsTable.id, slotId));
      clearState();
      await bot.sendMessage(chatId,
        `✅ تم التحديث: *${newAmount} TON* — *${newProb}%*`,
        { parse_mode: "Markdown" });
      const tmp = await bot.sendMessage(chatId, "جاري التحميل...");
      await showWheelMenu(bot, chatId, tmp.message_id);
      return true;
    }

    // ── Task flow ──
    if (state.step === "task_title") {
      adminConvState.set(userId, { step: "task_desc", data: { ...state.data, title: text } });
      await bot.sendMessage(chatId, "📝 أدخل *وصف المهمة* (أو `-` للتخطي):", { parse_mode: "Markdown" });
      return true;
    }
    if (state.step === "task_desc") {
      adminConvState.set(userId, { step: "task_url", data: { ...state.data, description: text === "-" ? null : text } });
      await bot.sendMessage(chatId, "🔗 أدخل *رابط المهمة* (مثال: https://t.me/...) أو `-`:", { parse_mode: "Markdown" });
      return true;
    }
    if (state.step === "task_url") {
      adminConvState.set(userId, { step: "task_icon", data: { ...state.data, url: text === "-" ? null : text } });
      await bot.sendMessage(chatId, "🎨 أدخل *أيقونة* (emoji) أو `-`:", { parse_mode: "Markdown" });
      return true;
    }
    if (state.step === "task_icon") {
      const { title, description, url } = state.data as { title: string; description: string | null; url: string | null };
      const icon = text === "-" ? "⭐" : text;
      await db.insert(tasksTable).values({ title, description, url, icon, isActive: true });
      clearState();
      await bot.sendMessage(chatId, `✅ تمت إضافة المهمة: *${title}*`, { parse_mode: "Markdown" });
      const tmp = await bot.sendMessage(chatId, "جاري التحميل...");
      await showTasksMenu(bot, chatId, tmp.message_id);
      return true;
    }

    // ── User search (by ID or @username) ──
    if (state.step === "user_search") {
      clearState();
      let u: typeof usersTable.$inferSelect | undefined;

      if (text.startsWith("@")) {
        const uname = text.replace("@", "");
        const results = await db.select().from(usersTable).where(ilike(usersTable.username, uname)).limit(1);
        u = results[0];
      } else {
        const targetId = parseInt(text);
        if (isNaN(targetId)) {
          await bot.sendMessage(chatId, "❌ أدخل ID رقمي أو @username صحيح");
          return true;
        }
        const results = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
        u = results[0];
      }

      if (!u) {
        await bot.sendMessage(chatId, `❌ لم يُعثر على مستخدم بهذا المعرّف`, { parse_mode: "Markdown" });
        return true;
      }
      await showUserCard(bot, chatId, u);
      return true;
    }

    // ── Add balance ──
    if (state.step === "user_addbal") {
      const { targetId } = state.data as { targetId: number };
      clearState();
      const val = parseFloat(text);
      if (isNaN(val) || val <= 0) {
        await bot.sendMessage(chatId, "❌ أدخل قيمة موجبة صحيحة");
        return true;
      }
      await db.update(usersTable).set({ balance: sql`balance + ${val}` }).where(eq(usersTable.id, targetId));
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      await bot.sendMessage(chatId,
        `✅ تمت إضافة *${val} TON* لـ \`${targetId}\`\nالرصيد الجديد: *${parseFloat(u.balance).toFixed(4)} TON*`,
        { parse_mode: "Markdown" });
      return true;
    }

    // ── Subtract balance ──
    if (state.step === "user_subbal") {
      const { targetId } = state.data as { targetId: number };
      clearState();
      const val = parseFloat(text);
      if (isNaN(val) || val <= 0) {
        await bot.sendMessage(chatId, "❌ أدخل قيمة موجبة صحيحة");
        return true;
      }
      await db.update(usersTable).set({ balance: sql`GREATEST(balance - ${val}, 0)` }).where(eq(usersTable.id, targetId));
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      await bot.sendMessage(chatId,
        `✅ تم خصم *${val} TON* من \`${targetId}\`\nالرصيد الجديد: *${parseFloat(u.balance).toFixed(4)} TON*`,
        { parse_mode: "Markdown" });
      return true;
    }

    // ── Set exact balance ──
    if (state.step === "user_balance") {
      const { targetId } = state.data as { targetId: number };
      clearState();
      const val = parseFloat(text);
      if (isNaN(val) || val < 0) {
        await bot.sendMessage(chatId, "❌ أدخل قيمة صحيحة (0 أو أكبر)");
        return true;
      }
      await db.update(usersTable).set({ balance: String(val) }).where(eq(usersTable.id, targetId));
      await bot.sendMessage(chatId,
        `✅ تم تعيين رصيد \`${targetId}\` إلى *${val} TON*`,
        { parse_mode: "Markdown" });
      return true;
    }

    // ── User spins ──
    if (state.step === "user_spins") {
      const { targetId } = state.data as { targetId: number };
      clearState();
      const isRelative = text.startsWith("+") || text.startsWith("-");
      const val = parseInt(text);
      if (isNaN(val)) {
        await bot.sendMessage(chatId, "❌ قيمة غير صحيحة");
        return true;
      }
      if (isRelative) {
        await db.update(usersTable).set({ spins: sql`spins + ${val}` }).where(eq(usersTable.id, targetId));
      } else {
        await db.update(usersTable).set({ spins: val }).where(eq(usersTable.id, targetId));
      }
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      await bot.sendMessage(chatId,
        `✅ تم تحديث لفات \`${targetId}\`\nاللفات الجديدة: *${u.spins}*`,
        { parse_mode: "Markdown" });
      return true;
    }
  } catch (err) {
    console.error("Admin text handler error:", err);
    clearState();
    await bot.sendMessage(chatId, "❌ حدث خطأ، حاول مرة أخرى.");
  }

  return false;
}
