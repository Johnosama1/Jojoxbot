import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api, Withdrawal } from "../lib/api";
import { Wallet, Send, CheckCircle, Coins, Clock, ClipboardList } from "lucide-react";

const MIN_WITHDRAWAL = 0.1;
const TON_ADDRESS_REGEX = /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;
function isValidTonAddress(addr: string): boolean {
  return TON_ADDRESS_REGEX.test(addr.trim());
}

function statusBadge(status: string) {
  if (status === "approved") return { label: "تمت الموافقة", color: "#10b981", bg: "rgba(16,185,129,0.13)", border: "rgba(16,185,129,0.35)" };
  if (status === "rejected") return { label: "مرفوض", color: "#f87171", bg: "rgba(248,113,113,0.13)", border: "rgba(248,113,113,0.35)" };
  return { label: "قيد المراجعة", color: "#fbbf24", bg: "rgba(251,191,36,0.13)", border: "rgba(251,191,36,0.35)" };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
}

export default function AccountPage() {
  const { user, refresh } = useUser();
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingHistory(true);
    api.getUserWithdrawals(user.id)
      .then(setWithdrawals)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [user?.id, success]);

  const balance = parseFloat(user?.balance || "0");
  const canWithdraw = balance >= MIN_WITHDRAWAL;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    setError("");
    setSuccess(false);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < MIN_WITHDRAWAL) {
      setError(`الحد الأدنى للسحب ${MIN_WITHDRAWAL} TON`);
      return;
    }
    if (amt > balance) { setError("الرصيد غير كافٍ"); return; }
    if (!walletAddress.trim()) { setError("أدخل عنوان المحفظة"); return; }
    if (!isValidTonAddress(walletAddress)) {
      setError("عنوان المحفظة غير صحيح — يجب أن يبدأ بـ EQ أو UQ");
      return;
    }

    setSubmitting(true);
    try {
      await api.requestWithdrawal({ userId: user.id, amount, walletAddress: walletAddress.trim() });
      setSuccess(true);
      setAmount("");
      setWalletAddress("");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "فشل طلب السحب");
    } finally {
      setSubmitting(false);
    }
  };

  const userDisplay = user ? (user.firstName || user.username || "مستخدم") : "...";

  return (
    <div className="page-content px-4 pt-5 flex flex-col gap-4">

      {/* ── Profile hero ── */}
      <div
        className="glass flex flex-col items-center gap-3 py-6 slide-up"
        style={{
          background: "linear-gradient(145deg, rgba(251,191,36,0.12), rgba(0,0,0,0.40))",
          border: "1px solid rgba(251,191,36,0.22)",
        }}
      >
        {user?.photoUrl ? (
          <img
            src={user.photoUrl}
            alt="avatar"
            style={{
              width: 72, height: 72, borderRadius: "50%", objectFit: "cover",
              border: "3px solid rgba(251,191,36,0.7)",
              boxShadow: "0 0 24px rgba(251,191,36,0.40)",
            }}
          />
        ) : (
          <div
            style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "linear-gradient(135deg, #0a2e18, #1a6e3a)",
              border: "3px solid rgba(251,191,36,0.7)",
              boxShadow: "0 0 24px rgba(251,191,36,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 28, color: "#fbbf24",
            }}
          >
            {userDisplay[0]?.toUpperCase()}
          </div>
        )}
        <div className="text-center">
          <h2 style={{ color: "#fff", fontWeight: 900, fontSize: 20, margin: 0 }}>{userDisplay}</h2>
          {user?.username && (
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2 }}>@{user.username}</p>
          )}
        </div>

        {/* Balance */}
        <div className="text-center mt-1">
          <div style={{ color: "rgba(251,191,36,0.60)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5 }}>
            رصيدك
          </div>
          <div className="gold-text" style={{ fontWeight: 900, fontSize: 38, lineHeight: 1.1 }}>
            {balance.toFixed(4)}
          </div>
          <div style={{ color: "rgba(251,191,36,0.65)", fontWeight: 700, fontSize: 13 }}>TON</div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex", gap: 0,
            borderTop: "1px solid rgba(255,255,255,0.10)",
            marginTop: 8, paddingTop: 14, width: "100%",
          }}
        >
          {[
            { label: "لفات", value: user?.spins ?? 0, color: "#fbbf24" },
            { label: "إحالات", value: user?.referralCount ?? 0, color: "#10b981" },
            { label: "مهام", value: user?.tasksCompleted ?? 0, color: "#3b82f6" },
          ].map(({ label, value, color }, i, arr) => (
            <div
              key={label}
              style={{
                flex: 1, textAlign: "center",
                borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.10)" : "none",
              }}
            >
              <div style={{ color, fontWeight: 900, fontSize: 22 }}>{value}</div>
              <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Withdrawal Form ── */}
      <div className="glass slide-up" style={{ padding: "20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Send size={16} color="#fbbf24" />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>سحب العملات</span>
          <div style={{ marginRight: "auto" }}>
            <span
              style={{
                background: canWithdraw ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.07)",
                border: `1px solid ${canWithdraw ? "rgba(16,185,129,0.40)" : "rgba(255,255,255,0.12)"}`,
                color: canWithdraw ? "#10b981" : "rgba(255,255,255,0.35)",
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
              }}
            >
              {canWithdraw ? "مسموح" : `الحد الأدنى ${MIN_WITHDRAWAL} TON`}
            </span>
          </div>
        </div>

        {success && (
          <div
            style={{
              background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)",
              borderRadius: 14, padding: "10px 14px", marginBottom: 14,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <CheckCircle size={16} color="#10b981" />
            <span style={{ color: "#10b981", fontSize: 13 }}>تم إرسال طلب السحب! سيتم مراجعته قريباً.</span>
          </div>
        )}

        <form onSubmit={handleWithdraw} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>
              عنوان محفظة TON
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="UQ..."
              disabled={!canWithdraw || submitting}
              dir="ltr"
              style={{
                width: "100%", background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
                padding: "11px 14px", color: "#fff", fontSize: 13,
                outline: "none", fontFamily: "monospace",
              }}
            />
          </div>
          <div>
            <label style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>
              المبلغ (TON)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`${MIN_WITHDRAWAL}`}
              step="0.01"
              min={MIN_WITHDRAWAL}
              max={balance}
              disabled={!canWithdraw || submitting}
              style={{
                width: "100%", background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
                padding: "11px 14px", color: "#fff", fontSize: 13, outline: "none",
              }}
            />
          </div>

          {error && (
            <p style={{ color: "#fca5a5", fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={!canWithdraw || submitting}
            style={{
              width: "100%", padding: "14px",
              borderRadius: 16, fontWeight: 900, fontSize: 15,
              border: "none", cursor: canWithdraw ? "pointer" : "not-allowed",
              ...(canWithdraw
                ? {
                    background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                    color: "#000",
                    boxShadow: "0 0 20px rgba(251,191,36,0.40)",
                  }
                : {
                    background: "rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.28)",
                  }),
            }}
          >
            {submitting ? "جاري الإرسال..." : "طلب السحب"}
          </button>
        </form>
      </div>

      {/* ── TON info ── */}
      <div
        className="glass"
        style={{
          padding: "14px 18px",
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(59,130,246,0.10)",
          border: "1px solid rgba(59,130,246,0.22)",
        }}
      >
        <Coins size={18} color="#3b82f6" style={{ flexShrink: 0 }} />
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, margin: 0 }}>
          يتم مراجعة طلبات السحب يدوياً من قِبل المالك وإرسال TON لمحفظتك.
        </p>
      </div>

      {/* ── Withdrawal History ── */}
      <div className="glass slide-up" style={{ padding: "20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <ClipboardList size={16} color="#fbbf24" />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>سجل السحوبات</span>
          {withdrawals.length > 0 && (
            <span style={{
              marginRight: "auto",
              background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.30)",
              color: "#fbbf24", fontSize: 11, fontWeight: 700,
              padding: "2px 10px", borderRadius: 999,
            }}>
              {withdrawals.length} طلب
            </span>
          )}
        </div>

        {loadingHistory ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            <Clock size={20} style={{ marginBottom: 6, opacity: 0.4 }} />
            <div>جاري التحميل...</div>
          </div>
        ) : withdrawals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <ClipboardList size={32} style={{ color: "rgba(255,255,255,0.15)", marginBottom: 8 }} />
            <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 13, margin: 0 }}>لا توجد سحوبات بعد</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {withdrawals.map((w) => {
              const badge = statusBadge(w.status);
              const shortWallet = w.walletAddress.slice(0, 6) + "..." + w.walletAddress.slice(-5);
              return (
                <div
                  key={w.id}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 14, padding: "12px 14px",
                    display: "flex", flexDirection: "column", gap: 7,
                  }}
                >
                  {/* Top row: amount + status */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 17 }}>
                      {parseFloat(w.amount).toFixed(4)}
                      <span style={{ color: "rgba(251,191,36,0.60)", fontSize: 11, fontWeight: 600, marginRight: 4 }}>TON</span>
                    </span>
                    <span style={{
                      background: badge.bg, border: `1px solid ${badge.border}`,
                      color: badge.color, fontSize: 11, fontWeight: 700,
                      padding: "3px 10px", borderRadius: 999,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                  {/* Bottom row: wallet + date */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "monospace" }}>
                      {shortWallet}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>
                      {formatDate(w.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
