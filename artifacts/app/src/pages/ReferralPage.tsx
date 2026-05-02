import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { api } from "../lib/api";
import { Users, Copy, CheckCheck, Zap, Gift, Share2 } from "lucide-react";

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
        <div style={{ fontSize: 48, lineHeight: 1 }}>🤝</div>
        <h1 className="gold-text" style={{ fontWeight: 900, fontSize: 26, margin: "8px 0 0" }}>الإحالة</h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 4 }}>
          ادعُ أصدقاءك واكسب لفات مجانية
        </p>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div
          className="glass text-center slide-up"
          style={{
            padding: "18px 12px",
            background: "linear-gradient(145deg, rgba(16,185,129,0.12), rgba(0,0,0,0.35))",
            border: "1px solid rgba(16,185,129,0.22)",
          }}
        >
          <Users size={22} color="#10b981" style={{ margin: "0 auto 6px" }} />
          <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 32 }}>
            {user?.referralCount ?? 0}
          </div>
          <div style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
            إجمالي الإحالات
          </div>
        </div>
        <div
          className="glass text-center slide-up"
          style={{
            padding: "18px 12px",
            background: "linear-gradient(145deg, rgba(251,191,36,0.12), rgba(0,0,0,0.35))",
            border: "1px solid rgba(251,191,36,0.22)",
          }}
        >
          <Zap size={22} color="#fbbf24" style={{ margin: "0 auto 6px" }} />
          <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 32 }}>
            {user?.spins ?? 0}
          </div>
          <div style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
            لفاتك المتاحة
          </div>
        </div>
      </div>

      {/* ── Progress ── */}
      <div className="glass slide-up" style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>نحو اللفة التالية</span>
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.28)",
            borderRadius: 999, padding: "3px 10px",
          }}>
            <Gift size={12} color="#fbbf24" />
            <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 13 }}>{progress}/5</span>
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
        <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, marginTop: 8 }}>
          {5 - progress} إحالات متبقية للفة المجانية
        </p>
      </div>

      {/* ── How it works ── */}
      <div className="glass slide-up" style={{ padding: "16px 18px" }}>
        <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 12, textAlign: "center" }}>
          كيف يعمل؟
        </p>
        {[
          "شارك رابط الإحالة مع أصدقائك",
          "كل 5 أصدقاء ينضمون = لفة مجانية",
          "لا يوجد حد أقصى — ادعُ أكثر واكسب أكثر 🎡",
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 12, color: "#000",
            }}>
              {i + 1}
            </div>
            <p style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, margin: 0, paddingTop: 4 }}>{step}</p>
          </div>
        ))}
      </div>

      {/* ── Link + buttons ── */}
      {user && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            className="glass"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
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
                padding: "6px 8px", borderRadius: 10, border: "none", cursor: "pointer",
                background: copied ? "rgba(16,185,129,0.20)" : "rgba(255,255,255,0.10)",
                flexShrink: 0,
              }}
            >
              {copied
                ? <CheckCheck size={16} color="#10b981" />
                : <Copy size={16} color="rgba(255,255,255,0.50)" />}
            </button>
          </div>

          <button
            onClick={handleCopy}
            style={{
              width: "100%", padding: "15px",
              borderRadius: 18, fontWeight: 900, fontSize: 16,
              border: "none", cursor: "pointer",
              background: copied
                ? "linear-gradient(135deg, #10b981, #059669)"
                : "linear-gradient(135deg, #fbbf24, #f59e0b)",
              color: "#000",
              boxShadow: copied
                ? "0 0 22px rgba(16,185,129,0.40)"
                : "0 0 22px rgba(251,191,36,0.45)",
            }}
          >
            {copied ? "✓ تم النسخ!" : "نسخ الرابط"}
          </button>

          <button
            onClick={shareLink}
            style={{
              width: "100%", padding: "13px",
              borderRadius: 18, fontWeight: 700, fontSize: 15,
              cursor: "pointer",
              background: "rgba(59,130,246,0.15)",
              border: "1px solid rgba(59,130,246,0.35)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Share2 size={16} /> مشاركة في تيليجرام
          </button>
        </div>
      )}
    </div>
  );
}
