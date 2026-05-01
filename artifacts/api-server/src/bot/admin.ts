import TelegramBot from "node-telegram-bot-api";
import { db } from "@workspace/db";
import {
  usersTable,
  tasksTable,
  wheelSlotsTable,
  botSettingsTable,
  withdrawalsTable,
  userTasksTable,
} from "@workspace/db/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";

export const OWNER_USERNAME = "J_O_H_N8";

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
  const text =
    "🎛 *لوحة التحكم — JojoX Lucky Wheel*\n\nمرحباً بك أيها الأدمن، اختر من القائمة:";
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

async function showWheelMenu(bot: TelegramBot, chatId: number, messageId?: number) {
  const slots = await db.select().from(wheelSlotsTable).orderBy(wheelSlotsTable.displayOrder);
  const total = slots.reduce((s, r) => s + r.probability, 0);
  let text = `🎡 *إعدادات العجلة*\n\nإجمالي الاحتمالات: *${total}%*\n\n`;
  slots.forEach((s) => {
    const icon = s.probability > 0 ? "🟢" : "⚫";
    text += `${icon} ${parseFloat(s.amount).toFixed(2)} TON → ${s.probability}%\n`;
  });
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      ...slots.map((s) => [
        {
          text: `✏️ ${parseFloat(s.amount).toFixed(2)} TON (${s.probability}%)`,
          callback_data: `adm:w:e:${s.id}`,
        },
      ]),
      [
        { text: "⚫ صفّر الكل", callback_data: "adm:w:zero" },
        { text: "🧪 اختبار 0.05=100%", callback_data: "adm:w:test" },
      ],
      [{ text: "◀️ رجوع", callback_data: "adm:main" }],
    ],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

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

async function showUsersMenu(bot: TelegramBot, chatId: number, messageId?: number) {
  const [res] = await db.select({ c: count() }).from(usersTable);
  const total = res?.c ?? 0;
  const text = `👥 *إدارة المستخدمين*\n\nإجمالي المستخدمين: *${total}*\n\nاضغط "بحث بالـ ID" لعرض بيانات أي مستخدم وتعديلها:`;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "🔍 بحث بالـ ID", callback_data: "adm:u:search" }],
      [{ text: "◀️ رجوع", callback_data: "adm:main" }],
    ],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

async function showWithdrawalsMenu(bot: TelegramBot, chatId: number, messageId?: number) {
  const pending = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "pending"))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(10);
  let text = `💸 *طلبات السحب المعلقة*\nعدد الطلبات: *${pending.length}*\n\n`;
  if (pending.length === 0) text += "لا توجد طلبات معلقة.";
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      ...pending.map((w) => [
        {
          text: `#${w.id} — ${parseFloat(w.amount).toFixed(2)} TON (ID: ${w.userId})`,
          callback_data: `adm:wd:v:${w.id}`,
        },
      ]),
      [{ text: "◀️ رجوع", callback_data: "adm:main" }],
    ],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

async function showSettingsMenu(bot: TelegramBot, chatId: number, messageId?: number) {
  const mode = (await getSetting("withdraw_mode")) || "manual";
  const modeLabel = mode === "auto" ? "🟢 تلقائي" : "🔴 يدوي";
  const text = `⚙️ *إعدادات البوت*\n\nوضع السحب الحالي: ${modeLabel}\n\n*يدوي* → تأكيد يدوي من المالك، التحويل يدوي.\n*تلقائي* → يتم الموافقة وتسجيل التحويل تلقائياً.`;
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

async function showStats(bot: TelegramBot, chatId: number, messageId?: number) {
  const [users] = await db.select({ c: count() }).from(usersTable);
  const [pending] = await db
    .select({ c: count() })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "pending"));
  const [approved] = await db
    .select({ c: count() })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "approved"));
  const [tasks] = await db.select({ c: count() }).from(tasksTable);
  const text =
    `📊 *الإحصائيات*\n\n` +
    `👥 المستخدمون: *${users?.c ?? 0}*\n` +
    `📋 المهام: *${tasks?.c ?? 0}*\n` +
    `💸 سحوبات معلقة: *${pending?.c ?? 0}*\n` +
    `✅ سحوبات موافق عليها: *${approved?.c ?? 0}*`;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: "◀️ رجوع", callback_data: "adm:main" }]],
  };
  await editOrSend(bot, chatId, text, keyboard, messageId);
}

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
  // parts[0] = "adm"
  const sec = parts[1];
  const act = parts[2];
  const p1 = parts[3];
  const p2 = parts[4];

  try {
    if (data === "adm:main") {
      await showAdminMenu(bot, chatId, msgId);
    } else if (data === "adm:wheel") {
      await showWheelMenu(bot, chatId, msgId);
    } else if (data === "adm:tasks") {
      await showTasksMenu(bot, chatId, msgId);
    } else if (data === "adm:users") {
      await showUsersMenu(bot, chatId, msgId);
    } else if (data === "adm:wd") {
      await showWithdrawalsMenu(bot, chatId, msgId);
    } else if (data === "adm:settings") {
      await showSettingsMenu(bot, chatId, msgId);
    } else if (data === "adm:stats") {
      await showStats(bot, chatId, msgId);
    }

    // === Wheel ===
    else if (data === "adm:w:zero") {
      await db.update(wheelSlotsTable).set({ probability: 0 });
      await showWheelMenu(bot, chatId, msgId);
    } else if (data === "adm:w:test") {
      await db.update(wheelSlotsTable).set({ probability: 0 });
      const first = await db
        .select()
        .from(wheelSlotsTable)
        .orderBy(wheelSlotsTable.displayOrder)
        .limit(1);
      if (first[0]) {
        await db
          .update(wheelSlotsTable)
          .set({ probability: 100 })
          .where(eq(wheelSlotsTable.id, first[0].id));
      }
      await showWheelMenu(bot, chatId, msgId);
    } else if (sec === "w" && act === "e" && p1) {
      const slotId = parseInt(p1);
      const [slot] = await db
        .select()
        .from(wheelSlotsTable)
        .where(eq(wheelSlotsTable.id, slotId))
        .limit(1);
      if (slot) {
        adminConvState.set(userId, {
          step: "wheel_prob",
          data: { slotId, chatId, msgId },
        });
        await bot.sendMessage(
          chatId,
          `✏️ تعديل احتمالية *${parseFloat(slot.amount).toFixed(2)} TON*\n\nأدخل النسبة الجديدة (0–100):`,
          { parse_mode: "Markdown" }
        );
      }
    }

    // === Tasks ===
    else if (sec === "t" && act === "v" && p1) {
      const taskId = parseInt(p1);
      const [t] = await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.id, taskId))
        .limit(1);
      if (t) {
        const text =
          `📋 *مهمة #${t.id}*\n\n` +
          `العنوان: *${t.title}*\n` +
          `الوصف: ${t.description || "—"}\n` +
          `الرابط: ${t.url || "—"}\n` +
          `الأيقونة: ${t.icon || "—"}\n` +
          `الحالة: ${t.isActive ? "✅ نشطة" : "❌ معطلة"}`;
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t.isActive ? "❌ تعطيل" : "✅ تفعيل",
                  callback_data: `adm:t:tog:${t.id}`,
                },
                { text: "🗑️ حذف", callback_data: `adm:t:del:${t.id}` },
              ],
              [{ text: "◀️ رجوع للمهام", callback_data: "adm:tasks" }],
            ],
          },
        });
      }
    } else if (sec === "t" && act === "tog" && p1) {
      const taskId = parseInt(p1);
      const [t] = await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.id, taskId))
        .limit(1);
      if (t) {
        await db
          .update(tasksTable)
          .set({ isActive: !t.isActive })
          .where(eq(tasksTable.id, taskId));
      }
      await showTasksMenu(bot, chatId, msgId);
    } else if (sec === "t" && act === "del" && p1) {
      const taskId = parseInt(p1);
      await db.delete(tasksTable).where(eq(tasksTable.id, taskId));
      await showTasksMenu(bot, chatId, msgId);
    } else if (sec === "t" && act === "add") {
      adminConvState.set(userId, { step: "task_title", data: { chatId, msgId } });
      await bot.sendMessage(chatId, "📝 أدخل *عنوان المهمة*:", {
        parse_mode: "Markdown",
      });
    }

    // === Users ===
    else if (sec === "u" && act === "search") {
      adminConvState.set(userId, { step: "user_search", data: {} });
      await bot.sendMessage(chatId, "🔍 أدخل *Telegram ID* للمستخدم:", {
        parse_mode: "Markdown",
      });
    } else if (sec === "u" && act === "bal" && p1) {
      const targetId = parseInt(p1);
      adminConvState.set(userId, { step: "user_balance", data: { targetId } });
      await bot.sendMessage(
        chatId,
        `💰 أدخل الرصيد الجديد لـ \`${targetId}\`\n_(مثال: 5.5 أو +2 أو -1)_`,
        { parse_mode: "Markdown" }
      );
    } else if (sec === "u" && act === "spins" && p1) {
      const targetId = parseInt(p1);
      adminConvState.set(userId, { step: "user_spins", data: { targetId } });
      await bot.sendMessage(
        chatId,
        `🎰 أدخل عدد اللفات لـ \`${targetId}\`\n_(مثال: 10 أو +5 أو -2)_`,
        { parse_mode: "Markdown" }
      );
    }

    // === Withdrawals ===
    else if (sec === "wd" && act === "v" && p1) {
      const wdId = parseInt(p1);
      const [w] = await db
        .select()
        .from(withdrawalsTable)
        .where(eq(withdrawalsTable.id, wdId))
        .limit(1);
      if (w) {
        const [u] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, w.userId))
          .limit(1);
        const text =
          `💸 *طلب سحب #${w.id}*\n\n` +
          `👤 الاسم: ${u?.firstName || "—"} ${u?.lastName || ""}\n` +
          `🔗 اليوزر: @${u?.username || "—"}\n` +
          `🆔 ID: \`${w.userId}\`\n` +
          `💰 المبلغ: *${parseFloat(w.amount).toFixed(4)} TON*\n` +
          `📍 المحفظة:\n\`${w.walletAddress}\`\n` +
          `📅 التاريخ: ${new Date(w.createdAt).toLocaleString("ar")}\n` +
          `الحالة: *${w.status}*`;
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ قبول", callback_data: `withdraw_approve_${w.id}` },
                { text: "❌ رفض", callback_data: `withdraw_reject_${w.id}` },
              ],
              [{ text: "◀️ رجوع للسحوبات", callback_data: "adm:wd" }],
            ],
          },
        });
      }
    }

    // === Settings ===
    else if (sec === "set" && act === "mode" && p1) {
      await setSetting("withdraw_mode", p1);
      await showSettingsMenu(bot, chatId, msgId);
    }
  } catch (err) {
    console.error("Admin callback error:", err);
    try {
      await bot.sendMessage(chatId, "❌ حدث خطأ، حاول مرة أخرى.");
    } catch { /* ignore */ }
  }

  return true;
}

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
    // === Wheel probability ===
    if (state.step === "wheel_prob") {
      const prob = parseInt(text);
      if (isNaN(prob) || prob < 0 || prob > 100) {
        await bot.sendMessage(chatId, "❌ أدخل رقماً بين 0 و 100");
        return true;
      }
      await db
        .update(wheelSlotsTable)
        .set({ probability: prob })
        .where(eq(wheelSlotsTable.id, state.data.slotId as number));
      clearState();
      await bot.sendMessage(chatId, `✅ تم تحديث الاحتمالية إلى *${prob}%*`, {
        parse_mode: "Markdown",
      });
      const tmp = await bot.sendMessage(chatId, "جاري التحميل...");
      await showWheelMenu(bot, chatId, tmp.message_id);
      return true;
    }

    // === Add Task flow ===
    if (state.step === "task_title") {
      adminConvState.set(userId, {
        step: "task_desc",
        data: { ...state.data, title: text },
      });
      await bot.sendMessage(
        chatId,
        "📝 أدخل *وصف المهمة* (أو أرسل `-` للتخطي):",
        { parse_mode: "Markdown" }
      );
      return true;
    }
    if (state.step === "task_desc") {
      adminConvState.set(userId, {
        step: "task_url",
        data: { ...state.data, description: text === "-" ? null : text },
      });
      await bot.sendMessage(
        chatId,
        "🔗 أدخل *رابط المهمة* (مثال: https://t.me/channel)\nأو أرسل `-` للتخطي:",
        { parse_mode: "Markdown" }
      );
      return true;
    }
    if (state.step === "task_url") {
      adminConvState.set(userId, {
        step: "task_icon",
        data: { ...state.data, url: text === "-" ? null : text },
      });
      await bot.sendMessage(
        chatId,
        "🎨 أدخل *أيقونة* المهمة (emoji) أو `-` للتخطي:",
        { parse_mode: "Markdown" }
      );
      return true;
    }
    if (state.step === "task_icon") {
      const { title, description, url } = state.data as {
        title: string;
        description: string | null;
        url: string | null;
      };
      const icon = text === "-" ? "⭐" : text;
      await db.insert(tasksTable).values({
        title,
        description,
        url,
        icon,
        isActive: true,
      });
      clearState();
      await bot.sendMessage(chatId, `✅ تمت إضافة المهمة: *${title}*`, {
        parse_mode: "Markdown",
      });
      const tmp = await bot.sendMessage(chatId, "جاري التحميل...");
      await showTasksMenu(bot, chatId, tmp.message_id);
      return true;
    }

    // === User search ===
    if (state.step === "user_search") {
      const targetId = parseInt(text);
      clearState();
      if (isNaN(targetId)) {
        await bot.sendMessage(chatId, "❌ ID غير صحيح");
        return true;
      }
      const [u] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, targetId))
        .limit(1);
      if (!u) {
        await bot.sendMessage(chatId, `❌ لا يوجد مستخدم بـ ID: \`${targetId}\``, {
          parse_mode: "Markdown",
        });
        return true;
      }
      const info =
        `👤 *المستخدم #${u.id}*\n\n` +
        `الاسم: *${u.firstName || "—"} ${u.lastName || ""}*\n` +
        `اليوزر: @${u.username || "—"}\n` +
        `💰 الرصيد: *${parseFloat(u.balance).toFixed(4)} TON*\n` +
        `🎰 اللفات: *${u.spins}*\n` +
        `👥 الإحالات: ${u.referralCount}\n` +
        `✅ المهام المكتملة: ${u.tasksCompleted}`;
      await bot.sendMessage(chatId, info, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "💰 تعديل الرصيد", callback_data: `adm:u:bal:${u.id}` },
              { text: "🎰 تعديل اللفات", callback_data: `adm:u:spins:${u.id}` },
            ],
            [{ text: "◀️ رجوع للمستخدمين", callback_data: "adm:users" }],
          ],
        },
      });
      return true;
    }

    // === User balance ===
    if (state.step === "user_balance") {
      const { targetId } = state.data as { targetId: number };
      clearState();
      let isRelative = text.startsWith("+") || text.startsWith("-");
      const val = parseFloat(text);
      if (isNaN(val)) {
        await bot.sendMessage(chatId, "❌ قيمة غير صحيحة");
        return true;
      }
      if (isRelative) {
        await db
          .update(usersTable)
          .set({ balance: sql`balance + ${val}` })
          .where(eq(usersTable.id, targetId));
      } else {
        await db
          .update(usersTable)
          .set({ balance: String(val) })
          .where(eq(usersTable.id, targetId));
      }
      const [u] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, targetId))
        .limit(1);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث رصيد المستخدم \`${targetId}\`\nالرصيد الجديد: *${parseFloat(u.balance).toFixed(4)} TON*`,
        { parse_mode: "Markdown" }
      );
      return true;
    }

    // === User spins ===
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
        await db
          .update(usersTable)
          .set({ spins: sql`spins + ${val}` })
          .where(eq(usersTable.id, targetId));
      } else {
        await db
          .update(usersTable)
          .set({ spins: val })
          .where(eq(usersTable.id, targetId));
      }
      const [u] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, targetId))
        .limit(1);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث لفات المستخدم \`${targetId}\`\nاللفات الجديدة: *${u.spins}*`,
        { parse_mode: "Markdown" }
      );
      return true;
    }
  } catch (err) {
    console.error("Admin text handler error:", err);
    clearState();
    await bot.sendMessage(chatId, "❌ حدث خطأ، حاول مرة أخرى.");
  }

  return true;
}

export async function checkChannelMembership(
  bot: TelegramBot,
  userId: number,
  channelUsername: string
): Promise<boolean> {
  try {
    const handle = channelUsername.startsWith("@")
      ? channelUsername
      : `@${channelUsername}`;
    const member = await bot.getChatMember(handle, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}
