import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api, WheelSlot } from "../lib/api";
import WheelCanvas from "../components/WheelCanvas";
import Confetti from "../components/Confetti";
import { Zap, RotateCcw } from "lucide-react";

export default function HomePage() {
  const { user, refresh } = useUser();
  const [slots, setSlots] = useState<WheelSlot[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [winAmount, setWinAmount] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getWheelSlots().then(setSlots).catch(console.error);
  }, []);

  const handleSpin = async () => {
    if (!user || spinning || user.spins <= 0) return;
    setError("");
    setShowResult(false);
    setShowConfetti(false);

    try {
      const result = await api.spin(user.id);
      setWinnerIndex(result.slotIndex);
      setWinAmount(result.winner.amount);
      setSpinning(true);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "فشل الدوران");
    }
  };

  const handleSpinEnd = () => {
    setSpinning(false);
    setShowResult(true);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  };

  const userDisplay = user ? (user.firstName || user.username || "مستخدم") : "...";
  const username = user?.username ? `@${user.username}` : "";

  return (
    <div className="min-h-screen flex flex-col items-center page-content">
      {/* Header */}
      <div className="w-full px-4 pt-8 pb-4 text-center">
        <div className="text-2xl font-black gold-text tracking-wider mb-1">JOJOX</div>
        <div className="text-xs text-purple-400">SPIN • WIN • ENJOY</div>
      </div>

      {/* User Profile */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="relative">
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt="avatar"
              className="w-16 h-16 rounded-full object-cover border-2 border-yellow-400"
              style={{ boxShadow: "0 0 20px rgba(255,215,0,0.5)" }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-yellow-400"
              style={{
                background: "linear-gradient(135deg, #1a0a2e, #3d1a6e)",
                boxShadow: "0 0 20px rgba(255,215,0,0.5)",
              }}
            >
              <span className="gold-text">{userDisplay[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background" />
        </div>
        <div className="text-center">
          <div className="text-white font-bold text-base">{userDisplay}</div>
          {username && <div className="text-purple-400 text-sm">{username}</div>}
        </div>
      </div>

      {/* Wheel */}
      <div className="flex flex-col items-center gap-4 w-full px-4">
        <WheelCanvas
          slots={slots}
          spinning={spinning}
          winnerIndex={winnerIndex}
          onSpinEnd={handleSpinEnd}
        />

        {/* Spin Count */}
        <div className="flex items-center gap-2 bg-purple-900/40 border border-purple-700/50 rounded-full px-5 py-2">
          <Zap size={16} className="text-yellow-400" />
          <span className="text-white text-sm font-medium">
            عدد اللفات: <span className="text-yellow-400 font-bold">{user?.spins ?? 0}</span>
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        {/* Result */}
        {showResult && (
          <div className="text-center animate-bounce-once">
            <div className="text-4xl font-black gold-text">{parseFloat(winAmount)} TON</div>
            <div className="text-green-400 text-sm mt-1">مبروك! تم إضافة الجائزة لرصيدك 🎉</div>
          </div>
        )}

        {/* Spin Button */}
        <button
          onClick={handleSpin}
          disabled={spinning || !user || user.spins <= 0}
          className="w-full max-w-xs py-4 rounded-2xl font-black text-lg text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
          style={{
            background: spinning ? "#666" : "linear-gradient(135deg, #ffd700, #ffaa00, #ff8c00)",
            boxShadow: spinning ? "none" : "0 0 25px rgba(255,215,0,0.5), 0 4px 15px rgba(0,0,0,0.3)",
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <RotateCcw size={20} className={spinning ? "animate-spin" : ""} />
            {spinning ? "جاري الدوران..." : user?.spins === 0 ? "لا لفات متاحة" : "الف الآن!"}
          </span>
        </button>

        {/* Info */}
        {user && user.spins === 0 && (
          <p className="text-purple-400 text-xs text-center">
            ادعُ 5 أصدقاء أو أكمل 5 مهام للحصول على لفة مجانية
          </p>
        )}
      </div>

      <Confetti active={showConfetti} />
    </div>
  );
}
