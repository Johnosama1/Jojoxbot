import { useState } from "react";
import { useUser } from "../lib/userContext";
import { api } from "../lib/api";
import WheelCanvas from "../components/WheelCanvas";

export default function HomePage() {
  const { user, refresh, slots } = useUser();
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [winAmount, setWinAmount] = useState("");
  const [error, setError] = useState("");

  const handleSpin = async () => {
    if (!user || spinning || user.spins <= 0) return;
    setError("");
    setShowResult(false);
    setWinnerIndex(null);
    setSpinning(true); // start wheel immediately — don't wait for API
    try {
      const result = await api.spin(user.id);
      setWinnerIndex(result.slotIndex); // wheel lands when API returns
      setWinAmount(result.winner.amount);
      await refresh();
    } catch (e: unknown) {
      setSpinning(false); // stop wheel on error
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
        className="w-full flex items-center justify-between px-4 py-3"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.20) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Avatar + name */}
        <div className="flex items-center gap-3" style={{ direction: "ltr" }}>
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt="avatar"
              style={{
                width: 42, height: 42, borderRadius: "50%", objectFit: "cover",
                border: "2px solid rgba(251,191,36,0.80)",
                boxShadow: "0 0 14px rgba(251,191,36,0.35)",
              }}
            />
          ) : (
            <div
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "linear-gradient(135deg, #0a2e18, #1a6e3a)",
                border: "2px solid rgba(251,191,36,0.80)",
                boxShadow: "0 0 12px rgba(251,191,36,0.30)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, color: "#fbbf24", fontSize: 17,
              }}
            >
              {userDisplay[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>
              {userDisplay}
            </div>
            {user?.username && (
              <div style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, marginTop: 1 }}>
                @{user.username}
              </div>
            )}
          </div>
        </div>

        {/* Balance badge */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.08))",
            border: "1px solid rgba(251,191,36,0.35)",
            borderRadius: 14,
            padding: "6px 14px",
            textAlign: "center",
            boxShadow: "0 0 16px rgba(251,191,36,0.12)",
          }}
        >
          <div style={{ fontSize: 9, color: "rgba(251,191,36,0.60)", letterSpacing: 1.5, textTransform: "uppercase" }}>
            رصيدك
          </div>
          <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 16, letterSpacing: 0.5, lineHeight: 1.2 }}>
            {balance} <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>TON</span>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="w-full grid grid-cols-3 gap-2.5 px-4 mt-4">
        {[
          { label: "لفات", value: spins, color: "#fbbf24", emoji: "⚡", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.22)" },
          { label: "إحالات", value: user?.referralCount ?? 0, color: "#10b981", emoji: "🫂", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.22)" },
          { label: "مهام", value: user?.tasksCompleted ?? 0, color: "#3b82f6", emoji: "🏆", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.22)" },
        ].map(({ label, value, color, emoji, bg, border }) => (
          <div
            key={label}
            className="text-center"
            style={{
              padding: "10px 6px",
              borderRadius: 18,
              background: bg,
              border: `1px solid ${border}`,
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ fontSize: 20, lineHeight: 1, margin: "0 auto 4px" }}>{emoji}</div>
            <div style={{ color, fontWeight: 900, fontSize: 22, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, marginTop: 2, letterSpacing: 0.5 }}>
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
            className="w-full text-sm text-center px-4 py-3 slide-up"
            style={{
              background: "rgba(180,30,30,0.22)",
              border: "1px solid rgba(255,80,80,0.30)",
              color: "#fca5a5",
              borderRadius: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Result */}
        {showResult && (
          <div className="text-center win-pop">
            <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1 }} className="gold-text">
              +{parseFloat(winAmount).toFixed(4)} TON
            </div>
            <div style={{
              color: "#10b981", fontSize: 13, marginTop: 6,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}>
              🎉 مبروك! تمت إضافة الجائزة لرصيدك
            </div>
          </div>
        )}

        {/* Spin button */}
        <button
          onClick={handleSpin}
          disabled={!canSpin}
          className={canSpin ? "btn-gold" : "btn-disabled"}
          style={{
            width: "100%",
            maxWidth: 320,
            padding: "16px 24px",
            fontSize: 16,
            border: "none",
            cursor: canSpin ? "pointer" : "not-allowed",
            position: "relative",
            ...(canSpin ? { animation: "pulse-gold 2.5s ease-in-out infinite" } : {}),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span
              style={{
                width: 30, height: 30, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 14,
                background: canSpin ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.08)",
                color: canSpin ? "#000" : "rgba(255,255,255,0.28)",
              }}
            >
              {spins}
            </span>
            {spinning ? "جاري الدوران..." : spins === 0 ? "لا توجد لفات" : "الِف العجلة"}
          </div>
        </button>

        {spins === 0 && !spinning && (
          <p style={{
            color: "rgba(255,255,255,0.40)", fontSize: 12, textAlign: "center",
            background: "rgba(255,255,255,0.05)", borderRadius: 12,
            padding: "8px 16px", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            ادعُ 5 أصدقاء أو أكمل 5 مهام للحصول على لفة مجانية
          </p>
        )}
      </div>
    </div>
  );
}
