import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api, Withdrawal, getWithdrawalsOnce, invalidateUserCaches } from "../lib/api";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Wallet, Send, CheckCircle, Coins, Clock, ClipboardList, Pencil, Link } from "lucide-react";

const MIN_WITHDRAWAL = 0.1;

function maskWallet(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "•••••" + addr.slice(-5);
}

function statusBadge(status: string) {
  if (status === "completed") return { label: "✅ ناجح",         color: "#10b981", bg: "rgba(16,185,129,0.13)",  border: "rgba(16,185,129,0.30)"  };
  if (status === "approved")  return { label: "تمت الموافقة",    color: "#10b981", bg: "rgba(16,185,129,0.13)",  border: "rgba(16,185,129,0.30)"  };
  if (status === "rejected")  return { label: "❌ مرفوض",        color: "#f87171", bg: "rgba(248,113,113,0.13)", border: "rgba(248,113,113,0.30)" };
  return                             { label: "⏳ قيد المراجعة", color: "#fbbf24", bg: "rgba(251,191,36,0.13)",  border: "rgba(251,191,36,0.30)"  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
}

export default function AccountPage() {
  const { user, refresh } = useUser();

  // ── TON Connect ─────────────────────────────────────────────────────
  const [tonConnectUI] = useTonConnectUI();
  const connectedAddress = useTonAddress(); // raw bounceable address from wallet

  // ── Wallet sync: whenever TON Connect gives us an address, auto-save it ──
  const [syncing, setSyncing]   = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  useEffect(() => {
    if (!connectedAddress || !user) return;
    // Only save if different from what's already stored
    if (connectedAddress === user.savedWalletAddress) return;
    setSyncing(true);
    api.saveWallet(user.id, connectedAddress)
      .then(() => refresh())
      .then(() => { setSyncDone(true); setTimeout(() => setSyncDone(false), 3000); })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [connectedAddress, user?.id]);

  // ── Withdrawal ──────────────────────────────────────────────────────
  const [amount, setAmount]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState("");

  // ── History ─────────────────────────────────────────────────────────
  const [withdrawals, setWithdrawals]       = useState<Withdrawal[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingHistory(true);
    getWithdrawalsOnce(user.id)
      .then(setWithdrawals)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [user?.id, success]);

  const balance     = parseFloat(user?.balance || "0");
  const canWithdraw = balance >= MIN_WITHDRAWAL;
  const savedWallet = user?.savedWalletAddress ?? null;

  // ── Withdrawal submit ────────────────────────────────────────────────
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting || !savedWallet) return;
    setError("");
    setSuccess(false);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < MIN_WITHDRAWAL) { setError(`الحد الأدنى للسحب ${MIN_WITHDRAWAL} TON`); return; }
    if (amt > balance) { setError("الرصيد غير كافٍ"); return; }
    setSubmitting(true);
    try {
      await api.requestWithdrawal({ userId: user.id, amount, walletAddress: savedWallet });
      invalidateUserCaches(user.id);
      setSuccess(true);
      setAmount("");
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
        className="slide-up"
        style={{
          padding: "24px 18px", borderRadius: 24,
          background: "linear-gradient(145deg, rgba(251,191,36,0.14), rgba(0,0,0,0.45))",
          border: "1px solid rgba(251,191,36,0.25)",
          backdropFilter: "blur(20px)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}
      >
        {user?.photoUrl ? (
          <img src={user.photoUrl} alt="" style={{
            width: 72, height: 72, borderRadius: 22, objectFit: "cover",
            border: "2px solid rgba(251,191,36,0.35)", boxShadow: "0 0 24px rgba(251,191,36,0.18)",
          }} />
        ) : (
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: "linear-gradient(135deg, rgba(251,191,36,0.30), rgba(245,158,11,0.12))",
            border: "2px solid rgba(251,191,36,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, color: "#fbbf24", fontWeight: 900,
            boxShadow: "0 0 24px rgba(251,191,36,0.18)",
          }}>
            {userDisplay[0]?.toUpperCase()}
          </div>
        )}

        <div className="text-center">
          <h2 style={{ color: "#fff", fontWeight: 900, fontSize: 20, margin: 0 }}>{userDisplay}</h2>
          {user?.username && (
            <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, marginTop: 2 }}>@{user.username}</p>
          )}
        </div>

        {/* Balance */}
        <div className="text-center" style={{
          background: "rgba(0,0,0,0.25)", borderRadius: 16,
          padding: "14px 32px", border: "1px solid rgba(251,191,36,0.18)",
        }}>
          <div style={{ color: "rgba(251,191,36,0.55)", fontSize: 10, textTransform: "uppercase", letterSpacing: 2 }}>رصيدك</div>
          <div className="gold-text" style={{ fontWeight: 900, fontSize: 40, lineHeight: 1.15 }}>{balance.toFixed(4)}</div>
          <div style={{ color: "rgba(251,191,36,0.60)", fontWeight: 700, fontSize: 13 }}>TON</div>
        </div>

        {/* Stats */}
        <div style={{
          display: "flex", gap: 0, width: "100%",
          borderTop: "1px solid rgba(255,255,255,0.09)", paddingTop: 14, marginTop: 2,
        }}>
          {[
            { label: "لفات",   value: user?.spins ?? 0,         color: "#fbbf24", emoji: "⚡" },
            { label: "إحالات", value: user?.referralCount ?? 0,  color: "#10b981", emoji: "🫂" },
            { label: "مهام",   value: user?.tasksCompleted ?? 0, color: "#3b82f6", emoji: "🏆" },
          ].map(({ label, value, color, emoji }, i, arr) => (
            <div key={label} style={{
              flex: 1, textAlign: "center",
              borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
            }}>
              <div style={{ fontSize: 20, lineHeight: 1, margin: "0 auto 4px" }}>{emoji}</div>
              <div style={{ color, fontWeight: 900, fontSize: 22 }}>{value}</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Wallet Binding via TON Connect ── */}
      <div
        className="slide-up"
        style={{
          padding: "20px 18px", borderRadius: 22,
          background: savedWallet
            ? "linear-gradient(145deg, rgba(16,185,129,0.10), rgba(0,0,0,0.32))"
            : "linear-gradient(145deg, rgba(251,191,36,0.10), rgba(0,0,0,0.35))",
          border: savedWallet
            ? "1px solid rgba(16,185,129,0.28)"
            : "1px solid rgba(251,191,36,0.22)",
          backdropFilter: "blur(18px)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: savedWallet ? "rgba(16,185,129,0.15)" : "rgba(251,191,36,0.14)",
            border: savedWallet ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(251,191,36,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Link size={15} color={savedWallet ? "#10b981" : "#fbbf24"} />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>
            {savedWallet ? "محفظتك المرتبطة" : "ربط محفظة TON"}
          </span>
          {savedWallet && (
            <button
              onClick={() => tonConnectUI.openModal()}
              style={{
                marginRight: "auto",
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10, padding: "5px 12px", cursor: "pointer",
                color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "inherit",
              }}
            >
              <Pencil size={12} /> تغيير
            </button>
          )}
        </div>

        {/* Saved wallet */}
        {savedWallet && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.20)",
            borderRadius: 14, padding: "12px 14px",
          }}>
            <Wallet size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span style={{
              color: "#10b981", fontSize: 13, fontFamily: "monospace",
              direction: "ltr", flex: 1, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {maskWallet(savedWallet)}
            </span>
            <CheckCircle size={15} color="#10b981" style={{ flexShrink: 0 }} />
          </div>
        )}

        {/* Syncing indicator */}
        {syncing && (
          <div style={{
            marginTop: savedWallet ? 10 : 0,
            background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: 12, padding: "10px 14px",
            color: "#fbbf24", fontSize: 13, textAlign: "center",
          }}>
            جاري حفظ المحفظة...
          </div>
        )}

        {/* Sync success toast */}
        {syncDone && !syncing && (
          <div style={{
            marginTop: 10,
            background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.30)",
            borderRadius: 12, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <CheckCircle size={15} color="#10b981" />
            <span style={{ color: "#10b981", fontSize: 13 }}>تم ربط المحفظة بنجاح ✓</span>
          </div>
        )}

        {/* Connect button — shown when no saved wallet */}
        {!savedWallet && !syncing && (
          <button
            onClick={() => tonConnectUI.openModal()}
            style={{
              width: "100%", padding: "15px", borderRadius: 16,
              fontWeight: 800, fontSize: 15, fontFamily: "inherit",
              cursor: "pointer", border: "none",
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              color: "#000",
              boxShadow: "0 0 24px rgba(251,191,36,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            🔗 ربط المحفظة
          </button>
        )}

        {!savedWallet && !syncing && (
          <p style={{
            color: "rgba(255,255,255,0.35)", fontSize: 11,
            textAlign: "center", marginTop: 10, marginBottom: 0, lineHeight: 1.6,
          }}>
            اختر محفظتك (Tonkeeper, MyTonWallet...) وستُحفظ تلقائياً
          </p>
        )}
      </div>

      {/* ── Withdrawal Form ── */}
      <div
        className="slide-up"
        style={{
          padding: "20px 18px", borderRadius: 22,
          background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Send size={15} color="#fbbf24" />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>سحب العملات</span>
          <div style={{ marginRight: "auto" }}>
            <span style={{
              background: canWithdraw ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.07)",
              border: `1px solid ${canWithdraw ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.12)"}`,
              color: canWithdraw ? "#10b981" : "rgba(255,255,255,0.30)",
              fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999,
            }}>
              {canWithdraw ? "✓ مسموح" : `الحد الأدنى ${MIN_WITHDRAWAL} TON`}
            </span>
          </div>
        </div>

        {/* No wallet linked yet */}
        {!savedWallet && (
          <div style={{
            textAlign: "center", padding: "24px 12px",
            color: "rgba(255,255,255,0.35)", fontSize: 13, lineHeight: 1.7,
          }}>
            <Wallet size={32} style={{ color: "rgba(255,255,255,0.15)", marginBottom: 10 }} />
            <p style={{ margin: 0 }}>
              اربط محفظة TON أولاً<br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>اضغط "ربط المحفظة" في القسم أعلاه</span>
            </p>
          </div>
        )}

        {/* Withdrawal form */}
        {savedWallet && (
          <>
            {/* Wallet reference */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 12, padding: "10px 12px", marginBottom: 12,
            }}>
              <Wallet size={13} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }} />
              <span style={{
                color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "monospace",
                direction: "ltr", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {maskWallet(savedWallet)}
              </span>
            </div>

            {success && (
              <div style={{
                background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.30)",
                borderRadius: 14, padding: "12px 14px", marginBottom: 14,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <CheckCircle size={16} color="#10b981" />
                <span style={{ color: "#10b981", fontSize: 13 }}>
                  تم إرسال طلب السحب! سيتم مراجعته قريباً.
                </span>
              </div>
            )}

            <form onSubmit={handleWithdraw} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{
                  color: "rgba(255,255,255,0.45)", fontSize: 11, textTransform: "uppercase",
                  letterSpacing: 1.2, display: "block", marginBottom: 8,
                }}>
                  المبلغ (TON)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`${MIN_WITHDRAWAL}`}
                    step="0.01"
                    min={MIN_WITHDRAWAL}
                    max={balance}
                    disabled={!canWithdraw || submitting}
                    className="ton-input"
                    style={{ paddingLeft: 64 }}
                  />
                  <button
                    type="button"
                    disabled={!canWithdraw || submitting}
                    onClick={() => setAmount(balance.toFixed(4))}
                    style={{
                      position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                      background: "rgba(255,215,0,0.18)", border: "1px solid rgba(255,215,0,0.35)",
                      borderRadius: 8, color: "#ffd700", fontSize: 12, padding: "4px 10px",
                      cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                    }}
                  >
                    الكل
                  </button>
                </div>
              </div>

              {error && (
                <div style={{
                  background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.25)",
                  borderRadius: 12, padding: "10px 12px", color: "#fca5a5", fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canWithdraw || submitting}
                className={canWithdraw ? "btn-gold" : "btn-disabled"}
                style={{
                  width: "100%", padding: "15px", fontSize: 15,
                  border: "none", cursor: canWithdraw ? "pointer" : "not-allowed",
                }}
              >
                {submitting ? "جاري الإرسال..." : "طلب السحب"}
              </button>
            </form>
          </>
        )}
      </div>

      {/* ── Info ── */}
      <div style={{
        padding: "14px 16px", borderRadius: 18,
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(59,130,246,0.09)", border: "1px solid rgba(59,130,246,0.20)",
        backdropFilter: "blur(12px)",
      }}>
        <Coins size={18} color="#3b82f6" style={{ flexShrink: 0 }} />
        <p style={{ color: "rgba(255,255,255,0.50)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          يتم مراجعة طلبات السحب يدوياً من قِبل المالك وإرسال TON لمحفظتك.
        </p>
      </div>

      {/* ── Withdrawal History ── */}
      <div
        className="slide-up"
        style={{
          padding: "20px 18px", borderRadius: 22,
          background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ClipboardList size={15} color="#fbbf24" />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>سجل السحوبات</span>
          {withdrawals.length > 0 && (
            <span style={{
              marginRight: "auto",
              background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.28)",
              color: "#fbbf24", fontSize: 11, fontWeight: 700,
              padding: "3px 12px", borderRadius: 999,
            }}>
              {withdrawals.length}
            </span>
          )}
        </div>

        {loadingHistory ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.30)", fontSize: 13 }}>
            <Clock size={20} style={{ marginBottom: 6, opacity: 0.3 }} />
            <div>جاري التحميل...</div>
          </div>
        ) : withdrawals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <ClipboardList size={32} style={{ color: "rgba(255,255,255,0.12)", marginBottom: 8 }} />
            <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 13, margin: 0 }}>لا توجد سحوبات بعد</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {withdrawals.map((w) => {
              const badge = statusBadge(w.status);
              const shortWallet = w.walletAddress.slice(0, 6) + "..." + w.walletAddress.slice(-5);
              return (
                <div key={w.id} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16, padding: "13px 14px",
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: 18 }}>
                      {parseFloat(w.amount).toFixed(4)}
                      <span style={{ color: "rgba(251,191,36,0.55)", fontSize: 11, fontWeight: 600, marginRight: 5 }}>TON</span>
                    </span>
                    <span style={{
                      background: badge.bg, border: `1px solid ${badge.border}`,
                      color: badge.color, fontSize: 11, fontWeight: 700,
                      padding: "4px 11px", borderRadius: 999,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.30)", fontSize: 11, fontFamily: "monospace" }}>
                      {shortWallet}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
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
