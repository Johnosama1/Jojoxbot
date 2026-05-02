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
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(0,20,10,0.70)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            location === tab.path ||
            (tab.path !== "/" && location.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => setLocation(tab.path)}
              className="flex flex-col items-center gap-1 flex-1 py-2 relative transition-all active:scale-95"
            >
              <div
                className="p-1.5 rounded-xl transition-all"
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(135deg, #fbbf24, #f59e0b)",
                        boxShadow: "0 0 12px rgba(251,191,36,0.5)",
                      }
                    : {}
                }
              >
                <Icon
                  size={20}
                  color={active ? "#000" : "rgba(255,255,255,0.45)"}
                  strokeWidth={active ? 2.5 : 1.5}
                />
              </div>
              <span
                className="text-xs font-semibold transition-all"
                style={{
                  color: active ? "#fbbf24" : "rgba(255,255,255,0.40)",
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
