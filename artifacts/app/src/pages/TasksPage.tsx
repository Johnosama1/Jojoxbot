import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api, Task } from "../lib/api";
import { CheckCircle, Circle, ExternalLink, Clock, Zap } from "lucide-react";

export default function TasksPage() {
  const { user, refresh } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [message, setMessage] = useState<{ taskId: number; text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.getTasks(), api.getUserCompletedTasks(user.id)]).then(([t, c]) => {
      setTasks(t);
      setCompleted(c);
      setLoading(false);
    });
  }, [user]);

  const handleComplete = async (task: Task) => {
    if (!user || completing !== null) return;
    if (task.url) {
      window.open(task.url, "_blank");
    }
    setCompleting(task.id);
    try {
      const result = await api.completeTask(task.id, user.id);
      setCompleted((prev) => [...prev, task.id]);
      setMessage({ taskId: task.id, text: "تم إكمال المهمة!", type: "success" });
      await refresh();
    } catch (e: unknown) {
      setMessage({ taskId: task.id, text: e instanceof Error ? e.message : "فشل", type: "error" });
    } finally {
      setCompleting(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const nextSpinAt = user ? Math.ceil(user.tasksCompleted / 5) * 5 : 5;
  const progressToNextSpin = user ? (user.tasksCompleted % 5) : 0;

  return (
    <div className="min-h-screen page-content px-4 pt-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black gold-text">المهام</h1>
        <p className="text-purple-400 text-sm mt-1">أكمل 5 مهام واحصل على لفة مجانية</p>
      </div>

      {/* Progress */}
      <div className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-white text-sm font-medium">التقدم نحو اللفة التالية</span>
          <div className="flex items-center gap-1 text-yellow-400">
            <Zap size={14} />
            <span className="text-sm font-bold">{progressToNextSpin}/5</span>
          </div>
        </div>
        <div className="w-full bg-purple-900/50 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(progressToNextSpin / 5) * 100}%`,
              background: "linear-gradient(90deg, #ffd700, #ffaa00)",
              boxShadow: "0 0 10px rgba(255,215,0,0.5)",
            }}
          />
        </div>
        <p className="text-purple-400 text-xs mt-2">
          {5 - progressToNextSpin} مهام متبقية للفة المجانية
        </p>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-purple-400">لا توجد مهام متاحة حالياً</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => {
            const isDone = completed.includes(task.id);
            const isExpiring = task.expiresAt && new Date(task.expiresAt).getTime() - Date.now() < 3600000;

            return (
              <div
                key={task.id}
                className={`rounded-2xl p-4 border transition-all ${
                  isDone
                    ? "border-green-800/50 bg-green-900/20"
                    : "border-purple-700/50 bg-purple-900/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{task.icon || "⭐"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold truncate ${isDone ? "text-green-400" : "text-white"}`}>
                        {task.title}
                      </p>
                      {isExpiring && (
                        <span className="flex items-center gap-1 text-orange-400 text-xs">
                          <Clock size={10} />
                          ينتهي قريباً
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-purple-400 text-xs mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                    {task.expiresAt && (
                      <p className="text-purple-500 text-xs mt-0.5">
                        ينتهي: {new Date(task.expiresAt).toLocaleString("ar")}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {isDone ? (
                      <div className="flex items-center gap-1 text-green-400">
                        <CheckCircle size={22} />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleComplete(task)}
                        disabled={completing === task.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-black transition-all disabled:opacity-60"
                        style={{
                          background: "linear-gradient(135deg, #ffd700, #ffaa00)",
                          boxShadow: "0 0 12px rgba(255,215,0,0.3)",
                        }}
                      >
                        {task.url && <ExternalLink size={12} />}
                        {completing === task.id ? "..." : "أكمل"}
                      </button>
                    )}
                  </div>
                </div>
                {message && message.taskId === task.id && (
                  <p className={`text-xs mt-2 ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
                    {message.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
