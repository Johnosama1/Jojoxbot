import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { apiCall } from "../lib/api";
import { Trophy, Users, Medal } from "lucide-react";

interface LeaderEntry {
  rank: number;
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  referralCount: number;
}

interface LeaderboardData {
  top: LeaderEntry[];
  myRank: { rank: number; referralCount: number } | null;
}

function displayName(entry: LeaderEntry): string {
  if (entry.username) return "@" + entry.username;
  const full = [entry.firstName, entry.lastName].filter(Boolean).join(" ");
  return full || "مستخدم";
}

function rankMedal(rank: number) {
  if (rank === 1) return { emoji: "🥇", color: "#FFD700" };
  if (rank === 2) return { emoji: "🥈", color: "#C0C0C0" };
  if (rank === 3) return { emoji: "🥉", color: "#CD7F32" };
  return { emoji: `#${rank}`, color: "rgba(255,255,255,0.35)" };
}

export default function LeaderboardPage() {
  const { user } = useUser();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = user ? `/leaderboard?userId=${user.id}` : "/leaderboard";
    apiCall<LeaderboardData>(url)
      .then(setData)
      .catch(() => setError("تعذّر تحميل الترتيب"))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const myRankInTop = data?.top.find((u) => u.id === user?.id);

  return (
    <div className="page-content px-4 pt-5 flex flex-col gap-4">

      {/* Header */}
      <div className="text-center slide-up">
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: "0 auto 10px",
          background: "linear-gradient(135deg, rgba(251,191,36,0.22), rgba(0,0,0,0.30))",
          border: "1px solid rgba(251,191,36,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, boxShadow: "0 0 28px rgba(251,191,36,0.22)",
        }}>
          🏆
        </div>
        <h1 className="gold-text" style={{ fontWeight: 900, fontSize: 26, margin: 0 }}>
          المتصدرون
        </h1>
        <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, marginTop: 4 }}>
          أكثر المستخدمين إحالةً
        </p>
      </div>

      {/* My rank card — always shown if user exists */}
      {user && data && (
        <div
          className="slide-up"
          style={{
            padding: "14px 18px", borderRadius: 18,
            background: myRankInTop
              ? "linear-gradient(135deg, rgba(251,191,36,0.16), rgba(0,0,0,0.35))"
              : "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(0,0,0,0.35))",
            border: myRankInTop
              ? "1px solid rgba(251,191,36,0.35)"
              : "1px solid rgba(59,130,246,0.30)",
            display: "flex", alignItems: "center", gap: 14,
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Users size={22} color="#fbbf24" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.50)", fontSize: 12, margin: "0 0 2px" }}>
              ترتيبك
            </p>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 15, margin: 0 }}>
              {data.myRank
                ? `المركز #${data.myRank.rank} — ${data.myRank.referralCount} إحالة`
                : "لم تُحِل أحداً بعد"}
            </p>
          </div>
          {myRankInTop && (
            <span style={{ fontSize: 22 }}>
              {rankMedal(myRankInTop.rank).emoji}
            </span>
          )}
        </div>
      )}

      {/* List */}
      <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.30)", fontSize: 14 }}>
            جارٍ التحميل...
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#f87171", fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && !error && data && data.top.length === 0 && (
          <div style={{
            textAlign: "center", padding: "48px 24px",
            color: "rgba(255,255,255,0.35)", fontSize: 14,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            كن أول المتصدرين!<br />
            <span style={{ fontSize: 12, opacity: 0.6 }}>ادعُ أصدقاءك لتصعد في الترتيب</span>
          </div>
        )}

        {!loading && data && data.top.map((entry) => {
          const medal = rankMedal(entry.rank);
          const isMe = entry.id === user?.id;
          const isTop3 = entry.rank <= 3;

          return (
            <div
              key={entry.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 16,
                background: isMe
                  ? "linear-gradient(135deg, rgba(251,191,36,0.14), rgba(0,0,0,0.35))"
                  : isTop3
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,255,255,0.03)",
                border: isMe
                  ? "1px solid rgba(251,191,36,0.38)"
                  : isTop3
                    ? "1px solid rgba(255,255,255,0.10)"
                    : "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.2s",
              }}
            >
              {/* Rank */}
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isTop3 ? 22 : 13,
                fontWeight: 800,
                color: medal.color,
                background: isTop3 ? "rgba(255,255,255,0.06)" : "transparent",
                border: isTop3 ? "1px solid rgba(255,255,255,0.10)" : "none",
              }}>
                {medal.emoji}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: isMe ? "#fbbf24" : "#fff",
                  fontWeight: isMe ? 800 : 600,
                  fontSize: 14,
                  margin: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {displayName(entry)} {isMe && "· أنت"}
                </p>
              </div>

              {/* Count */}
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                background: isMe ? "rgba(251,191,36,0.14)" : "rgba(255,255,255,0.07)",
                border: isMe ? "1px solid rgba(251,191,36,0.28)" : "1px solid rgba(255,255,255,0.10)",
                borderRadius: 999, padding: "5px 11px",
                flexShrink: 0,
              }}>
                <Users size={12} color={isMe ? "#fbbf24" : "rgba(255,255,255,0.50)"} />
                <span style={{
                  color: isMe ? "#fbbf24" : "rgba(255,255,255,0.60)",
                  fontSize: 13, fontWeight: 700,
                }}>
                  {entry.referralCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      {!loading && data && data.top.length > 0 && (
        <p style={{
          textAlign: "center", color: "rgba(255,255,255,0.22)",
          fontSize: 11, paddingBottom: 8, margin: 0,
        }}>
          يتحدّث الترتيب كل 10 ثوانٍ
        </p>
      )}
    </div>
  );
}
