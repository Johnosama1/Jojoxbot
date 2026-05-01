import { useState } from "react";
import { useUser } from "../lib/userContext";
import { Users, Copy, CheckCheck, Zap, Gift } from "lucide-react";

const BOT_USERNAME = "Jojox_bot";

export default function ReferralPage() {
  const { user } = useUser();
  const [copied, setCopied] = useState(false);

  const refLink = user
    ? `https://t.me/${BOT_USERNAME}?start=ref_${user.id}`
    : "";

  const handleCopy = async () => {
    if (!refLink) return;
    try {
      await navigator.clipboard.writeText(refLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = refLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = () => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const text = `🎰 العب عجلة الحظ في Jojox واربح TON!\n\n🎡 أربح من 0.05 إلى 4 TON في كل لفة\n🎁 انضم معي وابدأ الآن:\n${refLink}`;
      window.open(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const nextSpinAt = user ? Math.ceil((user.referralCount + 1) / 5) * 5 : 5;
  const progress = user ? user.referralCount % 5 : 0;

  return (
    <div className="min-h-screen page-content px-4 pt-6">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🤝</div>
        <h1 className="text-2xl font-black gold-text">رابط الإحالة</h1>
        <p className="text-purple-400 text-sm mt-1">ادعُ أصدقاءك واكسب لفات مجانية</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-4 text-center">
          <Users size={24} className="text-purple-400 mx-auto mb-2" />
          <div className="text-3xl font-black text-yellow-400">{user?.referralCount ?? 0}</div>
          <div className="text-purple-400 text-xs mt-1">إجمالي الإحالات</div>
        </div>
        <div className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-4 text-center">
          <Zap size={24} className="text-yellow-400 mx-auto mb-2" />
          <div className="text-3xl font-black text-yellow-400">{user?.spins ?? 0}</div>
          <div className="text-purple-400 text-xs mt-1">لفاتك المتاحة</div>
        </div>
      </div>

      {/* Progress to next spin */}
      <div className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-white text-sm font-medium">نحو اللفة التالية</span>
          <div className="flex items-center gap-1 text-yellow-400">
            <Gift size={14} />
            <span className="text-sm font-bold">{progress}/5</span>
          </div>
        </div>
        <div className="w-full bg-purple-900/50 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(progress / 5) * 100}%`,
              background: "linear-gradient(90deg, #9333ea, #ffd700)",
              boxShadow: "0 0 10px rgba(147,51,234,0.5)",
            }}
          />
        </div>
        <p className="text-purple-400 text-xs mt-2">
          {5 - progress} إحالات متبقية للفة مجانية
        </p>
      </div>

      {/* How it works */}
      <div className="bg-purple-900/20 border border-purple-800/50 rounded-2xl p-4 mb-6">
        <h2 className="text-white font-bold mb-3 text-center">كيف يعمل؟</h2>
        <div className="flex flex-col gap-2">
          {["شارك رابط الإحالة مع أصدقائك", "عند تسجيل 5 أصدقاء جدد، تحصل على لفة", "كل 5 إحالات = لفة مجانية 🎡"].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black text-black flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #ffd700, #ffaa00)" }}
              >
                {i + 1}
              </div>
              <p className="text-purple-300 text-sm">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Link */}
      {user && (
        <div className="flex flex-col gap-3">
          <div className="bg-purple-900/30 border border-purple-700/50 rounded-xl p-3 flex items-center gap-2">
            <p className="text-purple-300 text-xs flex-1 truncate font-mono">{refLink}</p>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg transition-all flex-shrink-0"
              style={{ background: copied ? "rgba(0,200,0,0.2)" : "rgba(147,51,234,0.3)" }}
            >
              {copied ? <CheckCheck size={16} className="text-green-400" /> : <Copy size={16} className="text-purple-400" />}
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="w-full py-4 rounded-2xl font-black text-lg text-black transition-all"
            style={{
              background: copied
                ? "linear-gradient(135deg, #00c853, #00e676)"
                : "linear-gradient(135deg, #ffd700, #ffaa00, #ff8c00)",
              boxShadow: "0 0 25px rgba(255,215,0,0.4)",
            }}
          >
            {copied ? "✓ تم النسخ!" : "نسخ الرابط"}
          </button>

          <button
            onClick={shareLink}
            className="w-full py-3 rounded-2xl font-bold text-white border border-purple-600 bg-purple-900/30 transition-all"
          >
            📤 مشاركة في تيليجرام
          </button>
        </div>
      )}
    </div>
  );
}
