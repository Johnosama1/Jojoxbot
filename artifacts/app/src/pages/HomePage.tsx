import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api, WheelSlot } from "../lib/api";
import WheelCanvas from "../components/WheelCanvas";

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
  const balance = user ? parseFloat(user.balance).toFixed(4) : "0.0000";
  const spins = user?.spins ?? 0;
  const canSpin = !spinning && !!user && spins > 0;

  return (
    <div className="page-content flex flex-col items-center w-full">

      {/* ── Top Bar ── */}
      <div
        className="w-full flex items-center justify-between px-4 py-3 slide-up"
        style={{
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        {/* Avatar + name */}
        <div className="flex items-center gap-2.5" style={{ direction: "ltr" }}>
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt="avatar"
              style={{
                width: 40, height: 40, borderRadius: "50%", objectFit: "cover",
                border: "2px solid rgba(251,191,36,0.7)",
                boxShadow: "0 0 10px rgba(251,191,36,0.4)",
              }}
            />
          ) : (
            <div
              style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "linear-gradient(135deg, #0a2e18, #1a6e3a)",
                border: "2px solid rgba(251,191,36,0.7)",
                boxShadow: "0 0 10px rgba(251,191,36,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, color: "#fbbf24", fontSize: 16,
              }}
            >
              {userDisplay[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
              {userDisplay}
            </div>
            {user?.username && (
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                @{user.username}
              </div>
            )}
          </div>
        </div>

        {/* Balance badge */}
        <div
          style={{
            background: "rgba(251,191,36,0.12)",
            border: "1px solid rgba(251,191,36,0.30)",
            borderRadius: 12,
            padding: "5px 12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 10, color: "rgba(251,191,36,0.65)", letterSpacing: 1, textTransform: "uppercase" }}>
            رصيدك
          </div>
          <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 15, letterSpacing: 0.5 }}>
            {balance} <span style={{ fontSize: 10, fontWeight: 600 }}>TON</span>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="w-full grid grid-cols-3 gap-2 px-4 mt-4">
        {[
          { label: "لفات", value: spins, color: "#fbbf24" },
          { label: "إحالات", value: user?.referralCount ?? 0, color: "#10b981" },
          { label: "مهام", value: user?.tasksCompleted ?? 0, color: "#3b82f6" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="glass text-center"
            style={{ padding: "10px 6px", borderRadius: 16 }}
          >
            <div style={{ color, fontWeight: 900, fontSize: 20, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ color: "rgba(255,255,255,0.40)", fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Wheel ── */}
      <div className="flex flex-col items-center w-full px-4 mt-5 gap-4">
        <div className="wheel-ring">
          <WheelCanvas
            slots={slots}
            spinning={spinning}
            winnerIndex={winnerIndex}
            onSpinEnd={handleSpinEnd}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            className="w-full text-sm text-center px-4 py-2.5 slide-up"
            style={{
              background: "rgba(180,30,30,0.25)",
              border: "1px solid rgba(255,80,80,0.35)",
              color: "#fca5a5",
              borderRadius: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Result */}
        {showResult && (
          <div className="text-center win-pop">
            <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1 }} className="gold-text">
              +{parseFloat(winAmount).toFixed(4)} TON
            </div>
            <div style={{ color: "#10b981", fontSize: 13, marginTop: 4 }}>
              🎉 مبروك! تمت إضافة الجائزة لرصيدك
            </div>
          </div>
        )}

        {/* Spin button */}
        <button
          onClick={handleSpin}
          disabled={!canSpin}
          className="w-full"
          style={{
            maxWidth: 320,
            padding: "15px 24px",
            fontSize: 16,
            ...(canSpin
              ? {
                  background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                  color: "#000",
                  fontWeight: 900,
                  borderRadius: 18,
                  boxShadow: "0 0 24px rgba(251,191,36,0.50)",
                  border: "none",
                  cursor: "pointer",
                }
              : {
                  background: "rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.28)",
                  fontWeight: 700,
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.10)",
                  cursor: "not-allowed",
                }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span
              style={{
                width: 30, height: 30, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 14,
                background: canSpin ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.08)",
                color: canSpin ? "#000" : "rgba(255,255,255,0.28)",
              }}
            >
              {spins}
            </span>
            {spinning ? "جاري الدوران..." : spins === 0 ? "لا توجد لفات" : "الِف العجلة"}
          </div>
        </button>

        {spins === 0 && (
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textAlign: "center" }}>
            ادعُ 5 أصدقاء أو أكمل 5 مهام للحصول على لفة مجانية
          </p>
        )}
      </div>
    </div>
  );
}
