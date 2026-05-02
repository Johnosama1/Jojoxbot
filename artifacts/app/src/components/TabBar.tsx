import { useLocation } from "wouter";
import { Home, ListTodo, Users, User } from "lucide-react";

const tabs = [
  { path: "/", icon: Home, label: "الرئيسية" },
  { path: "/tasks", icon: ListTodo, label: "المهام" },
  { path: "/referral", icon: Users, label: "الإحالة" },
  { path: "/account", icon: User, label: "حسابي" },
];

export default function TabBar() {
  const [location, setLocation] = useLocation();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 4px)",
        background: "rgba(0,12,6,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.40)",
      }}
    >
      <div className="flex justify-around items-center h-16 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            location === tab.path ||
            (tab.path !== "/" && location.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => setLocation(tab.path)}
              className="flex flex-col items-center flex-1 py-2 relative transition-all active:scale-90"
              style={{ gap: 4, outline: "none", border: "none", background: "transparent" }}
            >
              {/* Active top indicator */}
              {active && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 28,
                    height: 2.5,
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
                    boxShadow: "0 0 8px rgba(251,191,36,0.70)",
                  }}
                />
              )}

              <div
                style={{
                  width: 40, height: 40,
                  borderRadius: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                  ...(active
                    ? {
                        background: "linear-gradient(135deg, rgba(251,191,36,0.22), rgba(245,158,11,0.10))",
                        border: "1px solid rgba(251,191,36,0.30)",
                        boxShadow: "0 0 16px rgba(251,191,36,0.20)",
                      }
                    : {
                        background: "transparent",
                        border: "1px solid transparent",
                      }),
                }}
              >
                <Icon
                  size={20}
                  color={active ? "#fbbf24" : "rgba(255,255,255,0.38)"}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 800 : 500,
                  letterSpacing: 0.3,
                  color: active ? "#fbbf24" : "rgba(255,255,255,0.35)",
                  transition: "color 0.2s",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
