import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api, Task, getTasksOnce, getCompletedTasksOnce, invalidateUserCaches } from "../lib/api";
import { CheckCircle, ExternalLink, Clock, Zap } from "lucide-react";

export default function TasksPage() {
  const { user, refresh } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [urlOpened, setUrlOpened] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ taskId: number; text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([getTasksOnce(), getCompletedTasksOnce(user.id)]).then(([t, c]) => {
      setTasks(t);
      setCompleted(c);
      setLoading(false);
    });
  }, [user]);

  const handleOpenUrl = (task: Task) => {
    window.open(task.url!, "_blank");
    setUrlOpened((prev) => new Set([...prev, task.id]));
  };

  const handleVerify = async (task: Task) => {
    if (!user || completing !== null) return;
    setCompleting(task.id);
    try {
      await api.completeTask(task.id, user.id);
      invalidateUserCaches(user.id);
      setCompleted((prev) => [...prev, task.id]);
      setMessage({ taskId: task.id, text: "✅ تم إكمال المهمة!", type: "success" });
      await refresh();
    } catch (e: unknown) {
      setMessage({ taskId: task.id, text: e instanceof Error ? e.message : "فشل", type: "error" });
    } finally {
      setCompleting(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleComplete = async (task: Task) => {
    if (!user || completing !== null) return;
    if (task.url) {
      if (!urlOpened.has(task.id)) { handleOpenUrl(task); return; }
      await handleVerify(task);
    } else {
      await handleVerify(task);
    }
  };

  const progressToNextSpin = user ? (user.tasksCompleted % 7) : 0;

  return (
    <div className="page-content px-4 pt-5 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="text-center slide-up">
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: "0 auto 10px",
          background: "linear-gradient(135deg, rgba(251,191,36,0.20), rgba(0,0,0,0.30))",
          border: "1px solid rgba(251,191,36,0.30)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30, boxShadow: "0 0 24px rgba(251,191,36,0.20)",
        }}>
          ✍️
        </div>
        <h1 className="gold-text" style={{ fontWeight: 900, fontSize: 26, margin: 0 }}>المهام</h1>
        <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, marginTop: 4 }}>
          أكمل 7 مهام واحصل على لفة مجانية 🎡
        </p>
      </div>

      {/* ── Progress card ── */}
      <div
        className="slide-up"
        style={{
          padding: "16px 18px",
          borderRadius: 20,
          background: "linear-gradient(145deg, rgba(251,191,36,0.12), rgba(0,0,0,0.35))",
          border: "1px solid rgba(251,191,36,0.22)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
            التقدم نحو اللفة التالية
          </span>
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.30)",
            borderRadius: 999, padding: "4px 12px",
          }}>
            <Zap size={12} color="#fbbf24" />
            <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 13 }}>
              {progressToNextSpin}/7
            </span>
          </div>
        </div>

        {/* Milestone dots */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 6 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 28, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 900,
                background: i < progressToNextSpin
                  ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                  : "rgba(255,255,255,0.08)",
                color: i < progressToNextSpin ? "#000" : "rgba(255,255,255,0.25)",
                boxShadow: i < progressToNextSpin ? "0 0 10px rgba(251,191,36,0.5)" : "none",
                transition: "all 0.3s",
              }}
            >
              {i < progressToNextSpin ? "✓" : i + 1}
            </div>
          ))}
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(progressToNextSpin / 7) * 100}%` }} />
        </div>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 8, textAlign: "center" }}>
          {7 - progressToNextSpin} مهام متبقية للفة المجانية 🎡
        </p>
      </div>

      {/* ── Tasks ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "2.5px solid #fbbf24", borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }} />
        </div>
      ) : tasks.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "32px 20px",
          borderRadius: 20, marginTop: 4,
          background: "rgba(255,255,255,0.04)",
          border: "1px dashed rgba(255,255,255,0.12)",
        }}>
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.5 }}>📋</div>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد مهام متاحة حالياً</p>
          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 12, marginTop: 6 }}>تفقّد مجدداً قريباً</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map((task) => {
            const isDone = completed.includes(task.id);
            const isExpiring = task.expiresAt && new Date(task.expiresAt).getTime() - Date.now() < 3600000;
            const isOpened = urlOpened.has(task.id);

            return (
              <div
                key={task.id}
                className="slide-up"
                style={{
                  padding: "14px 16px",
                  borderRadius: 18,
                  backdropFilter: "blur(16px)",
                  border: isDone
                    ? "1px solid rgba(16,185,129,0.35)"
                    : "1px solid rgba(255,255,255,0.10)",
                  background: isDone
                    ? "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(0,0,0,0.30))"
                    : "rgba(0,0,0,0.28)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Channel photo or icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, overflow: "hidden",
                    background: isDone ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.07)",
                    border: isDone ? "2px solid rgba(16,185,129,0.40)" : "2px solid rgba(255,255,255,0.12)",
                    boxShadow: task.channelPhotoUrl ? "0 0 12px rgba(0,0,0,0.40)" : "none",
                  }}>
                    {task.channelPhotoUrl ? (
                      <img
                        src={task.channelPhotoUrl}
                        alt={task.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      task.icon || "⭐"
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        color: isDone ? "#10b981" : "#fff",
                        fontWeight: 700, fontSize: 14,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {task.title}
                      </span>
                      {isExpiring && (
                        <span style={{
                          display: "flex", alignItems: "center", gap: 2,
                          color: "#f97316", fontSize: 10, flexShrink: 0,
                          background: "rgba(249,115,22,0.12)", padding: "1px 6px", borderRadius: 6,
                        }}>
                          <Clock size={9} /> ينتهي
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.description}
                      </p>
                    )}
                    {/* Reward label */}
                    {!isDone && (
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        marginTop: 5, background: "rgba(251,191,36,0.10)",
                        border: "1px solid rgba(251,191,36,0.22)", borderRadius: 6,
                        padding: "2px 8px",
                      }}>
                        <Zap size={9} color="#fbbf24" />
                        <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700 }}>+1 لفة كل 7 مهام</span>
                      </div>
                    )}
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {isDone ? (
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(16,185,129,0.15)",
                      }}>
                        <CheckCircle size={22} color="#10b981" />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleComplete(task)}
                        disabled={completing === task.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "8px 14px", borderRadius: 12, fontWeight: 700, fontSize: 13,
                          border: "none", cursor: "pointer",
                          background: task.url && !isOpened
                            ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                            : "linear-gradient(135deg, #fbbf24, #f59e0b)",
                          color: task.url && !isOpened ? "#fff" : "#000",
                          boxShadow: task.url && !isOpened
                            ? "0 0 12px rgba(59,130,246,0.35)"
                            : "0 0 12px rgba(251,191,36,0.35)",
                          opacity: completing === task.id ? 0.6 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.url && !isOpened
                          ? <><ExternalLink size={11} /> افتح</>
                          : completing === task.id ? "..." : "تحقق"}
                      </button>
                    )}
                  </div>
                </div>

                {message?.taskId === task.id && (
                  <p style={{
                    fontSize: 12, marginTop: 10, padding: "6px 10px", borderRadius: 10,
                    background: message.type === "success" ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)",
                    color: message.type === "success" ? "#10b981" : "#fca5a5",
                    border: `1px solid ${message.type === "success" ? "rgba(16,185,129,0.25)" : "rgba(248,113,113,0.25)"}`,
                  }}>
                    {message.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
