import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api, WheelSlot } from "../lib/api";
import WheelCanvas from "../components/WheelCanvas";
import bgImage from "@assets/ChatGPT_Image_May_1,_2026,_01_40_56_AM_1777647705132.png";

export default function HomePage() {
  const { user, refresh } = useUser();
  const [slots, setSlots] = useState<WheelSlot[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [winAmount, setWinAmount] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.getWheelSlots().then(setSlots).catch(console.error);
  }, []);

  const handleSpin = async () => {
    if (!user || spinning || user.spins <= 0) return;
    setError("");
    setShowResult(false);

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
  };

  const userDisplay = user ? (user.firstName || user.username || "مستخدم") : "...";
  const balance = user ? parseFloat(user.balance).toFixed(2) : "0.00";
  const spins = user?.spins ?? 0;

  return (
    <div
      className="min-h-screen flex flex-col page-content"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay so text is readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "rgba(5, 0, 20, 0.55)", zIndex: 0 }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full h-full">

        {/* Top Bar */}
        <div
          className="w-full flex items-center justify-between px-4 py-3"
          style={{
            background: "rgba(10, 5, 30, 0.75)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255, 215, 0, 0.2)",
            direction: "ltr",
          }}
        >
          {/* Left: User info */}
          <div className="flex items-center gap-3">
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt="avatar"
                className="rounded-full object-cover flex-shrink-0"
                style={{
                  width: 42,
                  height: 42,
                  border: "2px solid rgba(255,215,0,0.6)",
                }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center font-bold text-base flex-shrink-0"
                style={{
                  width: 42,
                  height: 42,
                  background: "linear-gradient(135deg, #1a0a40, #4a1a9e)",
                  border: "2px solid rgba(255,215,0,0.6)",
                  color: "#ffd700",
                }}
              >
                {userDisplay[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-white font-semibold text-sm leading-tight">{userDisplay}</div>
              {user?.username && (
                <div className="text-xs" style={{ color: "rgba(180,150,255,0.8)" }}>
                  @{user.username}
                </div>
              )}
            </div>
          </div>

          {/* Right: Balance */}
          <div className="flex flex-col items-end">
            <div className="text-xs mb-0.5" style={{ color: "rgba(255,215,0,0.7)" }}>الرصيد</div>
            <div className="font-bold text-base" style={{ color: "#ffd700", letterSpacing: "0.02em" }}>
              {balance} <span className="text-xs font-normal" style={{ color: "rgba(255,215,0,0.7)" }}>TON</span>
            </div>
          </div>
        </div>

        {/* Wheel Area */}
        <div className="flex flex-col items-center gap-5 w-full px-4 mt-6">

          <WheelCanvas
            slots={slots}
            spinning={spinning}
            winnerIndex={winnerIndex}
            onSpinEnd={handleSpinEnd}
          />

          {/* Error */}
          {error && (
            <div
              className="text-sm text-center px-4 py-2 rounded-xl"
              style={{
                background: "rgba(180,30,30,0.25)",
                border: "1px solid rgba(255,80,80,0.4)",
                color: "#ff9999",
              }}
            >
              {error}
            </div>
          )}

          {/* Result */}
          {showResult && (
            <div className="text-center">
              <div
                className="text-3xl font-black"
                style={{
                  background: "linear-gradient(135deg, #ffd700, #ffaa00)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                +{parseFloat(winAmount)} TON
              </div>
              <div className="text-sm mt-1" style={{ color: "rgba(100,255,150,0.9)" }}>
                مبروك! تم إضافة الجائزة لرصيدك
              </div>
            </div>
          )}

          {/* Spin Button — shows spin count, triggers spin */}
          <button
            onClick={handleSpin}
            disabled={spinning || !user || spins <= 0}
            className="w-full max-w-xs rounded-2xl font-bold text-base transition-all"
            style={{
              padding: "14px 24px",
              background:
                spinning || spins <= 0
                  ? "rgba(60,60,80,0.6)"
                  : "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,160,0,0.25))",
              border:
                spinning || spins <= 0
                  ? "1px solid rgba(100,100,120,0.4)"
                  : "1px solid rgba(255,215,0,0.5)",
              color: spinning || spins <= 0 ? "rgba(180,180,200,0.6)" : "#ffd700",
              boxShadow:
                spinning || spins <= 0
                  ? "none"
                  : "0 0 20px rgba(255,215,0,0.15), inset 0 0 20px rgba(255,215,0,0.05)",
              cursor: spinning || spins <= 0 ? "not-allowed" : "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="flex items-center justify-center gap-3">
              <span
                className="rounded-full flex items-center justify-center text-sm font-black"
                style={{
                  width: 32,
                  height: 32,
                  background:
                    spins <= 0
                      ? "rgba(100,100,120,0.4)"
                      : "linear-gradient(135deg, #ffd700, #ffaa00)",
                  color: spins <= 0 ? "rgba(180,180,200,0.5)" : "#0a0520",
                }}
              >
                {spins}
              </span>
              <span>
                {spinning ? "جاري الدوران..." : spins === 0 ? "لا توجد لفات" : "الف العجلة"}
              </span>
            </div>
          </button>

          {spins === 0 && (
            <p className="text-xs text-center" style={{ color: "rgba(160,130,255,0.8)" }}>
              ادعُ 5 أصدقاء أو أكمل 5 مهام للحصول على لفة مجانية
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
