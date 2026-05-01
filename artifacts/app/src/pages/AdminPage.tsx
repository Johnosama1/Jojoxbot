import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api, Task, WheelSlot, User } from "../lib/api";
import { Shield, Plus, Trash2, Settings, Users, Sliders, ListTodo, ChevronDown, ChevronUp, CreditCard } from "lucide-react";

export default function AdminPage() {
  const { user, isAdmin } = useUser();
  const [activeTab, setActiveTab] = useState<"tasks" | "wheel" | "users" | "settings" | "withdrawals">("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wheelSlots, setWheelSlots] = useState<WheelSlot[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Task form
  const [newTask, setNewTask] = useState({ title: "", description: "", url: "", icon: "⭐", expiresAt: "" });
  const [showTaskForm, setShowTaskForm] = useState(false);

  // User edit
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const [editSpins, setEditSpins] = useState("");

  // Wheel edit
  const [editedSlots, setEditedSlots] = useState<WheelSlot[]>([]);

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [t, w, u, s] = await Promise.all([
        api.adminGetTasks(user.id),
        api.adminGetWheel(user.id),
        api.adminGetUsers(user.id),
        api.adminGetSettings(user.id),
      ]);
      setTasks(t);
      setWheelSlots(w);
      setEditedSlots(w);
      setUsers(u);
      setSettings(s);
    } catch (e) {
      showMsg("خطأ في تحميل البيانات - تأكد من صلاحيات الأدمن");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center page-content px-4">
        <Shield size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-red-400">ممنوع الوصول</h2>
        <p className="text-purple-400 text-sm mt-2 text-center">هذه الصفحة للأدمن فقط</p>
      </div>
    );
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTask.title) return;
    try {
      await api.adminCreateTask(user.id, {
        title: newTask.title,
        description: newTask.description || undefined,
        url: newTask.url || undefined,
        icon: newTask.icon,
        expiresAt: newTask.expiresAt ? newTask.expiresAt : undefined,
      });
      setNewTask({ title: "", description: "", url: "", icon: "⭐", expiresAt: "" });
      setShowTaskForm(false);
      await loadData();
      showMsg("تم إضافة المهمة بنجاح!");
    } catch (e) {
      showMsg("فشل إضافة المهمة");
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!user) return;
    try {
      await api.adminDeleteTask(user.id, id);
      await loadData();
      showMsg("تم حذف المهمة");
    } catch (e) {
      showMsg("فشل الحذف");
    }
  };

  const handleSaveWheel = async () => {
    if (!user) return;
    try {
      await api.adminUpdateWheel(user.id, editedSlots);
      await loadData();
      showMsg("تم حفظ إعدادات العجلة!");
    } catch (e) {
      showMsg("فشل الحفظ");
    }
  };

  const handleUpdateUser = async (userId: number) => {
    if (!user) return;
    try {
      const b = editBalance !== "" ? parseFloat(editBalance) : undefined;
      const s = editSpins !== "" ? parseInt(editSpins) : undefined;
      await api.adminUpdateUserBalance(user.id, userId, b, s);
      setEditUserId(null);
      setEditBalance("");
      setEditSpins("");
      await loadData();
      showMsg("تم تحديث المستخدم!");
    } catch (e) {
      showMsg("فشل التحديث");
    }
  };

  const handleSaveSetting = async (key: string, value: string) => {
    if (!user) return;
    try {
      await api.adminUpdateSetting(user.id, key, value);
      await loadData();
      showMsg("تم الحفظ!");
    } catch (e) {
      showMsg("فشل الحفظ");
    }
  };

  const totalProbability = editedSlots.reduce((s, sl) => s + sl.probability, 0);

  const tabs = [
    { id: "tasks", label: "المهام", icon: ListTodo },
    { id: "wheel", label: "العجلة", icon: Sliders },
    { id: "users", label: "المستخدمين", icon: Users },
    { id: "settings", label: "الإعدادات", icon: Settings },
    { id: "withdrawals", label: "السحوبات", icon: CreditCard },
  ] as const;

  return (
    <div className="min-h-screen page-content">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={24} className="text-yellow-400" />
          <h1 className="text-2xl font-black gold-text">لوحة التحكم</h1>
        </div>
        <p className="text-purple-400 text-sm">مرحباً @{user?.username}</p>
      </div>

      {msg && (
        <div className="mx-4 mb-4 bg-green-900/30 border border-green-700/50 rounded-xl px-3 py-2">
          <p className="text-green-400 text-sm">{msg}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 px-4 pb-3 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: activeTab === tab.id ? "linear-gradient(135deg, #ffd700, #ffaa00)" : "rgba(147,51,234,0.2)",
                color: activeTab === tab.id ? "#000" : "#a78bfa",
                border: activeTab === tab.id ? "none" : "1px solid rgba(147,51,234,0.4)",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="px-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* Tasks Tab */}
            {activeTab === "tasks" && (
              <div>
                <button
                  onClick={() => setShowTaskForm(!showTaskForm)}
                  className="w-full py-3 rounded-xl font-bold text-black mb-4 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #ffd700, #ffaa00)" }}
                >
                  <Plus size={18} />
                  إضافة مهمة جديدة
                  {showTaskForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showTaskForm && (
                  <form onSubmit={handleCreateTask} className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-4 mb-4 flex flex-col gap-3">
                    {[
                      { label: "عنوان المهمة *", key: "title", type: "text", placeholder: "اسم المهمة" },
                      { label: "الوصف", key: "description", type: "text", placeholder: "وصف اختياري" },
                      { label: "الرابط", key: "url", type: "url", placeholder: "https://" },
                      { label: "الأيقونة", key: "icon", type: "text", placeholder: "⭐" },
                      { label: "ينتهي في (اختياري)", key: "expiresAt", type: "datetime-local", placeholder: "" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="text-purple-300 text-xs mb-1 block">{f.label}</label>
                        <input
                          type={f.type}
                          value={(newTask as Record<string, string>)[f.key]}
                          onChange={(e) => setNewTask((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          required={f.key === "title"}
                          className="w-full bg-purple-900/40 border border-purple-700/50 rounded-xl px-3 py-2 text-white text-sm placeholder-purple-600 focus:outline-none"
                        />
                      </div>
                    ))}
                    <button type="submit" className="w-full py-3 rounded-xl font-bold text-black" style={{ background: "linear-gradient(135deg, #ffd700, #ffaa00)" }}>
                      إضافة
                    </button>
                  </form>
                )}

                <div className="flex flex-col gap-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-purple-900/20 border border-purple-700/40 rounded-xl p-3 flex items-start gap-3">
                      <span className="text-2xl">{task.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">{task.title}</p>
                        {task.description && <p className="text-purple-400 text-xs">{task.description}</p>}
                        {task.expiresAt && (
                          <p className="text-orange-400 text-xs mt-1">
                            ينتهي: {new Date(task.expiresAt).toLocaleString("ar")}
                          </p>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${task.isActive ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                          {task.isActive ? "نشط" : "معطل"}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wheel Tab */}
            {activeTab === "wheel" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-white font-bold">إعدادات العجلة</h2>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${totalProbability === 100 ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                    مجموع النسب: {totalProbability}%
                  </span>
                </div>
                <p className="text-purple-400 text-xs mb-4">
                  مجموع النسب يجب أن يساوي 100%. 0% يعني الخانة لن تظهر أبداً.
                </p>
                <div className="flex flex-col gap-3 mb-4">
                  {editedSlots.map((slot, i) => (
                    <div key={slot.id} className="bg-purple-900/30 border border-purple-700/50 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-black flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #ffd700, #ffaa00)" }}
                        >
                          #{i + 1}
                        </div>
                        <div className="flex-1 flex gap-2">
                          <div className="flex-1">
                            <label className="text-purple-400 text-xs">المبلغ (TON)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={slot.amount}
                              onChange={(e) => setEditedSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, amount: e.target.value } : s))}
                              className="w-full bg-purple-900/40 border border-purple-700/50 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                            />
                          </div>
                          <div className="w-24">
                            <label className="text-purple-400 text-xs">النسبة %</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={slot.probability}
                              onChange={(e) => setEditedSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, probability: parseInt(e.target.value) || 0 } : s))}
                              className="w-full bg-purple-900/40 border border-purple-700/50 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleSaveWheel}
                  disabled={totalProbability !== 100}
                  className="w-full py-3 rounded-xl font-bold text-black disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #ffd700, #ffaa00)" }}
                >
                  {totalProbability !== 100 ? `مجموع النسب = ${totalProbability}% (يجب أن يكون 100%)` : "حفظ إعدادات العجلة"}
                </button>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === "users" && (
              <div>
                <div className="bg-purple-900/30 border border-purple-700/50 rounded-xl p-3 mb-4 text-center">
                  <p className="text-3xl font-black text-yellow-400">{users.length}</p>
                  <p className="text-purple-400 text-sm">إجمالي المستخدمين</p>
                </div>
                <div className="flex flex-col gap-2">
                  {users.map((u) => (
                    <div key={u.id} className="bg-purple-900/20 border border-purple-700/40 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-800 flex items-center justify-center text-sm font-bold text-yellow-400">
                          {(u.firstName || u.username || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-bold truncate">{u.firstName || "بدون اسم"}</p>
                          <p className="text-purple-400 text-xs">{u.username ? `@${u.username}` : u.id}</p>
                          <p className="text-yellow-400 text-xs">{parseFloat(u.balance).toFixed(4)} TON | {u.spins} لفات</p>
                        </div>
                        <button
                          onClick={() => setEditUserId(editUserId === u.id ? null : u.id)}
                          className="p-2 text-yellow-400 hover:bg-yellow-900/20 rounded-lg text-xs font-bold"
                        >
                          تعديل
                        </button>
                      </div>
                      {editUserId === u.id && (
                        <div className="mt-3 flex flex-col gap-2">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-purple-400 text-xs">الرصيد (TON)</label>
                              <input
                                type="number"
                                step="0.0001"
                                value={editBalance}
                                onChange={(e) => setEditBalance(e.target.value)}
                                placeholder={u.balance}
                                className="w-full bg-purple-900/40 border border-purple-700/50 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-purple-400 text-xs">عدد اللفات</label>
                              <input
                                type="number"
                                value={editSpins}
                                onChange={(e) => setEditSpins(e.target.value)}
                                placeholder={String(u.spins)}
                                className="w-full bg-purple-900/40 border border-purple-700/50 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleUpdateUser(u.id)}
                            className="py-2 rounded-lg font-bold text-black text-sm"
                            style={{ background: "linear-gradient(135deg, #ffd700, #ffaa00)" }}
                          >
                            حفظ
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="flex flex-col gap-4">
                <div className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-4">
                  <h3 className="text-white font-bold mb-3">معرف المالك (للإشعارات)</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={settings["owner_telegram_id"] || ""}
                      id="owner-id-input"
                      placeholder="Telegram User ID"
                      className="flex-1 bg-purple-900/40 border border-purple-700/50 rounded-xl px-3 py-2 text-white text-sm focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const val = (document.getElementById("owner-id-input") as HTMLInputElement).value;
                        handleSaveSetting("owner_telegram_id", val);
                      }}
                      className="px-4 py-2 rounded-xl font-bold text-black text-sm"
                      style={{ background: "linear-gradient(135deg, #ffd700, #ffaa00)" }}
                    >
                      حفظ
                    </button>
                  </div>
                </div>

                <div className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-4">
                  <h3 className="text-white font-bold mb-3">إظهار عدد المستخدمين</h3>
                  <div className="flex items-center justify-between">
                    <p className="text-purple-300 text-sm">إظهار عدد المستخدمين للجميع</p>
                    <button
                      onClick={() => handleSaveSetting("show_user_count", settings["show_user_count"] === "true" ? "false" : "true")}
                      className={`relative w-12 h-6 rounded-full transition-all ${settings["show_user_count"] === "true" ? "bg-yellow-400" : "bg-purple-800"}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings["show_user_count"] === "true" ? "right-1" : "left-1"}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Withdrawals Tab */}
            {activeTab === "withdrawals" && (
              <WithdrawalsTab userId={user!.id} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function WithdrawalsTab({ userId }: { userId: number }) {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminGetWithdrawals(userId).then(setWithdrawals).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="flex justify-center py-8"><div className="w-8 h-8 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" /></div>;

  return (
    <div>
      <h2 className="text-white font-bold mb-4">طلبات السحب ({withdrawals.length})</h2>
      <div className="flex flex-col gap-2">
        {withdrawals.length === 0 && <p className="text-purple-400 text-center py-8">لا توجد طلبات سحب</p>}
        {withdrawals.map((w) => (
          <div key={w.id} className="bg-purple-900/20 border border-purple-700/40 rounded-xl p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-yellow-400 font-bold text-sm">{parseFloat(w.amount).toFixed(4)} TON</p>
                <p className="text-purple-400 text-xs font-mono mt-1">{w.walletAddress.slice(0, 20)}...</p>
                <p className="text-purple-500 text-xs">{new Date(w.createdAt).toLocaleString("ar")}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                w.status === "approved" ? "bg-green-900/40 text-green-400" :
                w.status === "rejected" ? "bg-red-900/40 text-red-400" :
                "bg-orange-900/40 text-orange-400"
              }`}>
                {w.status === "approved" ? "✓ موافق" : w.status === "rejected" ? "✗ مرفوض" : "⏳ انتظار"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
