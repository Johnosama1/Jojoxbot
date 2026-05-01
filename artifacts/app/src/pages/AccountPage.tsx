import { useState } from "react";
import { useUser } from "../lib/userContext";
import { api } from "../lib/api";
import { Wallet, Send, CheckCircle, History } from "lucide-react";

const MIN_WITHDRAWAL = 0.1;

export default function AccountPage() {
  const { user, refresh } = useUser();
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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
    if (amt > balance) {
      setError("الرصيد غير كافٍ");
      return;
    }
    if (!walletAddress.trim()) {
      setError("أدخل عنوان المحفظة");
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
  const username = user?.username ? `@${user.username}` : "";

  return (
    <div className="min-h-screen page-content px-4 pt-6">
      {/* Profile */}
      <div className="flex flex-col items-center gap-3 mb-8">
        {user?.photoUrl ? (
          <img
            src={user.photoUrl}
            alt="avatar"
            className="w-20 h-20 rounded-full object-cover border-2 border-yellow-400"
            style={{ boxShadow: "0 0 25px rgba(255,215,0,0.5)" }}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black border-2 border-yellow-400"
            style={{
              background: "linear-gradient(135deg, #1a0a2e, #3d1a6e)",
              boxShadow: "0 0 25px rgba(255,215,0,0.5)",
            }}
          >
            <span className="gold-text">{userDisplay[0]?.toUpperCase()}</span>
          </div>
        )}
        <div className="text-center">
          <h2 className="text-xl font-black text-white">{userDisplay}</h2>
          {username && <p className="text-purple-400 text-sm">{username}</p>}
        </div>
      </div>

      {/* Balance Card */}
      <div
        className="rounded-3xl p-6 mb-6 text-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a0a2e 0%, #3d1a6e 50%, #1a0a2e 100%)",
          border: "1px solid rgba(255,215,0,0.3)",
          boxShadow: "0 0 30px rgba(147,51,234,0.3)",
        }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #ffd700 0%, transparent 60%)" }} />
        <Wallet size={28} className="text-yellow-400 mx-auto mb-2" />
        <p className="text-purple-300 text-sm mb-1">رصيدك</p>
        <p className="text-4xl font-black gold-text">{balance.toFixed(4)}</p>
        <p className="text-yellow-600 text-sm font-bold mt-1">TON</p>
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-purple-700/50">
          <div className="text-center">
            <p className="text-white font-bold">{user?.spins ?? 0}</p>
            <p className="text-purple-400 text-xs">لفات</p>
          </div>
          <div className="w-px bg-purple-700/50" />
          <div className="text-center">
            <p className="text-white font-bold">{user?.referralCount ?? 0}</p>
            <p className="text-purple-400 text-xs">إحالات</p>
          </div>
          <div className="w-px bg-purple-700/50" />
          <div className="text-center">
            <p className="text-white font-bold">{user?.tasksCompleted ?? 0}</p>
            <p className="text-purple-400 text-xs">مهام</p>
          </div>
        </div>
      </div>

      {/* Withdrawal Form */}
      <div className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-4 mb-4">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Send size={18} className="text-yellow-400" />
          سحب العملات
        </h3>

        {success && (
          <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-3 mb-4 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
            <p className="text-green-400 text-sm">تم إرسال طلب السحب! سيتم مراجعته قريباً.</p>
          </div>
        )}

        {!canWithdraw && !success && (
          <div className="bg-orange-900/20 border border-orange-700/50 rounded-xl p-3 mb-4">
            <p className="text-orange-400 text-sm">
              الحد الأدنى للسحب هو {MIN_WITHDRAWAL} TON. رصيدك الحالي: {balance.toFixed(4)} TON
            </p>
          </div>
        )}

        <form onSubmit={handleWithdraw} className="flex flex-col gap-3">
          <div>
            <label className="text-purple-300 text-sm mb-1 block">عنوان محفظة TON</label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="UQ..."
              disabled={!canWithdraw || submitting}
              className="w-full bg-purple-900/40 border border-purple-700/50 rounded-xl px-3 py-2.5 text-white text-sm placeholder-purple-600 focus:outline-none focus:border-yellow-400/50 disabled:opacity-50"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-purple-300 text-sm mb-1 block">
              المبلغ (TON) — الحد الأدنى: {MIN_WITHDRAWAL}
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
              className="w-full bg-purple-900/40 border border-purple-700/50 rounded-xl px-3 py-2.5 text-white text-sm placeholder-purple-600 focus:outline-none focus:border-yellow-400/50 disabled:opacity-50"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={!canWithdraw || submitting}
            className="w-full py-3.5 rounded-xl font-black text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: canWithdraw
                ? "linear-gradient(135deg, #ffd700, #ffaa00)"
                : "#333",
              boxShadow: canWithdraw ? "0 0 20px rgba(255,215,0,0.4)" : "none",
            }}
          >
            {submitting ? "جاري الإرسال..." : "طلب السحب"}
          </button>
        </form>
      </div>
    </div>
  );
}
