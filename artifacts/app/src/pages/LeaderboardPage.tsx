import { useState, useEffect } from "react";
import { useUser } from "../lib/userContext";
import { apiCall } from "../lib/api";
import { Users } from "lucide-react";

interface LeaderEntry {
  rank: number;
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: 22 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 22 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 22 }}>🥉</span>;
  return (
    <span style={{
      color: "rgba(255,255,255,0.45)", fontWeight: 800, fontSize: 13,
      minWidth: 28, textAlign: "center", display: "inline-block",
    }}>
      #{rank}
    </span>
  );
}

function Avatar({ entry }: { entry: LeaderEntry }) {
  const [imgErr, setImgErr] = useState(false);
  const initial = (entry.firstName?.[0] || entry.username?.[0] || "؟").toUpperCase();

  return (
    <div style={{
      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
      overflow: "hidden", border: "2px solid rgba(255,255,255,0.15)",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(0,0,0,0.40))",
      fontSize: 16, fontWeight: 900, color: "#fbbf24",
    }}>
      {entry.photoUrl && !imgErr ? (
        <img
          src={entry.photoUrl}
          alt={initial}
          onError={() => setImgErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : initial}
    </div>
  );
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
          const isMe = entry.id === user?.id;
          const isTop3 = entry.rank <= 3;

          return (
            <div
              key={entry.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 14px", borderRadius: 18,
                background: isMe
                  ? "linear-gradient(135deg, rgba(251,191,36,0.14), rgba(0,0,0,0.38))"
                  : isTop3
                    ? "rgba(255,255,255,0.055)"
                    : "rgba(255,255,255,0.03)",
                border: isMe
                  ? "1px solid rgba(251,191,36,0.40)"
                  : isTop3
                    ? "1px solid rgba(255,255,255,0.10)"
                    : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Rank */}
              <div style={{ width: 32, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <RankBadge rank={entry.rank} />
              </div>

              {/* Avatar */}
              <Avatar entry={entry} />

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: isMe ? "#fbbf24" : "#fff",
                  fontWeight: isMe ? 800 : 600,
                  fontSize: 14, margin: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {displayName(entry)}{isMe ? " · أنت" : ""}
                </p>
              </div>

              {/* Referral count */}
              <div style={{
                display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                background: isMe ? "rgba(251,191,36,0.14)" : "rgba(255,255,255,0.07)",
                border: isMe ? "1px solid rgba(251,191,36,0.30)" : "1px solid rgba(255,255,255,0.10)",
                borderRadius: 999, padding: "5px 12px",
              }}>
                <Users size={12} color={isMe ? "#fbbf24" : "rgba(255,255,255,0.50)"} />
                <span style={{
                  color: isMe ? "#fbbf24" : "rgba(255,255,255,0.70)",
                  fontSize: 13, fontWeight: 700,
                }}>
                  {entry.referralCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
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
