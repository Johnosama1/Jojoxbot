import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api } from "../lib/api";
import { Users, Copy, CheckCheck, Zap, Gift, Share2, Link2 } from "lucide-react";

export default function ReferralPage() {
  const { user } = useUser();
  const [copied, setCopied] = useState(false);
  const [botUsername, setBotUsername] = useState("jojoxbot");

  useEffect(() => {
    api.getConfig().then((c) => setBotUsername(c.botUsername)).catch(() => {});
  }, []);

  const refLink = user ? `https://t.me/${botUsername}?start=ref_${user.id}` : "";
  const progress = user ? user.referralCount % 5 : 0;

  const handleCopy = async () => {
    if (!refLink) return;
    try {
      await navigator.clipboard.writeText(refLink);
    } catch {
      const el = document.createElement("textarea");
      el.value = refLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    const text = `🎰 العب عجلة الحظ في Jojox واربح TON!\n\n🎡 أربح من 0.05 إلى 4 TON في كل لفة\n🎁 انضم معي:\n${refLink}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="page-content px-4 pt-5 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="text-center slide-up">
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: "0 auto 10px",
          background: "linear-gradient(135deg, rgba(16,185,129,0.20), rgba(0,0,0,0.30))",
          border: "1px solid rgba(16,185,129,0.30)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30, boxShadow: "0 0 24px rgba(16,185,129,0.20)",
        }}>
          🤝
        </div>
        <h1 className="gold-text" style={{ fontWeight: 900, fontSize: 26, margin: 0 }}>الإحالة</h1>
        <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, marginTop: 4 }}>
          ادعُ أصدقاءك واكسب لفات مجانية
        </p>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div
          className="slide-up"
          style={{
            padding: "18px 12px", borderRadius: 20, textAlign: "center",
            background: "linear-gradient(145deg, rgba(16,185,129,0.14), rgba(0,0,0,0.35))",
            border: "1px solid rgba(16,185,129,0.25)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12, margin: "0 auto 8px",
            background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Users size={20} color="#10b981" />
          </div>
          <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 34, lineHeight: 1 }}>
            {user?.referralCount ?? 0}
          </div>
          <div style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, marginTop: 4, letterSpacing: 0.5 }}>
            إجمالي الإحالات
          </div>
        </div>
        <div
          className="slide-up"
          style={{
            padding: "18px 12px", borderRadius: 20, textAlign: "center",
            background: "linear-gradient(145deg, rgba(251,191,36,0.14), rgba(0,0,0,0.35))",
            border: "1px solid rgba(251,191,36,0.25)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12, margin: "0 auto 8px",
            background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={20} color="#fbbf24" />
          </div>
          <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 34, lineHeight: 1 }}>
            {user?.spins ?? 0}
          </div>
          <div style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, marginTop: 4, letterSpacing: 0.5 }}>
            لفاتك المتاحة
          </div>
        </div>
      </div>

      {/* ── Progress ── */}
      <div
        className="slide-up"
        style={{
          padding: "16px 18px", borderRadius: 20,
          background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>نحو اللفة التالية</span>
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.28)",
            borderRadius: 999, padding: "4px 12px",
          }}>
            <Gift size={12} color="#fbbf24" />
            <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 13 }}>{progress}/5</span>
          </div>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${(progress / 5) * 100}%`,
              background: "linear-gradient(90deg, #10b981, #fbbf24)",
            }}
          />
        </div>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 8 }}>
          {5 - progress} إحالات متبقية للفة المجانية 🎡
        </p>
      </div>

      {/* ── How it works ── */}
      <div
        className="slide-up"
        style={{
          padding: "16px 18px", borderRadius: 20,
          background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(16px)",
        }}
      >
        <p style={{ color: "#fff", fontWeight: 800, fontSize: 14, marginBottom: 14, textAlign: "center" }}>
          كيف يعمل؟
        </p>
        {[
          { icon: "🔗", text: "شارك رابط الإحالة مع أصدقائك" },
          { icon: "👥", text: "كل 5 أصدقاء ينضمون = لفة مجانية" },
          { icon: "♾️", text: "لا يوجد حد أقصى — ادعُ أكثر واكسب أكثر 🎡" },
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11, flexShrink: 0,
              background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>
              {step.icon}
            </div>
            <p style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, margin: 0 }}>{step.text}</p>
          </div>
        ))}
      </div>

      {/* ── Link + buttons ── */}
      {user && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Link display */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 14px", borderRadius: 16,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Link2 size={14} color="rgba(251,191,36,0.60)" style={{ flexShrink: 0 }} />
            <p style={{
              color: "rgba(255,255,255,0.50)", fontSize: 12, flex: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              margin: 0, fontFamily: "monospace",
              direction: "ltr", textAlign: "left",
            }}>
              {refLink}
            </p>
            <button
              onClick={handleCopy}
              style={{
                padding: "7px 9px", borderRadius: 10, border: "none", cursor: "pointer",
                background: copied ? "rgba(16,185,129,0.22)" : "rgba(255,255,255,0.10)",
                flexShrink: 0, transition: "all 0.2s",
              }}
            >
              {copied
                ? <CheckCheck size={15} color="#10b981" />
                : <Copy size={15} color="rgba(255,255,255,0.50)" />}
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="btn-gold"
            style={{
              width: "100%", padding: "15px", fontSize: 16,
              border: "none", cursor: "pointer",
              ...(copied ? {
                background: "linear-gradient(135deg, #10b981, #059669)",
                boxShadow: "0 0 22px rgba(16,185,129,0.40)",
              } : {}),
            }}
          >
            {copied ? "✓ تم النسخ!" : "نسخ الرابط"}
          </button>

          <button
            onClick={shareLink}
            style={{
              width: "100%", padding: "14px",
              borderRadius: 18, fontWeight: 700, fontSize: 15,
              cursor: "pointer",
              background: "rgba(59,130,246,0.14)",
              border: "1px solid rgba(59,130,246,0.32)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              backdropFilter: "blur(12px)",
            }}
          >
            <Share2 size={16} /> مشاركة في تيليجرام
          </button>
        </div>
      )}
    </div>
  );
}
