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
    <div className="tab-bar">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = location === tab.path || (tab.path !== "/" && location.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => setLocation(tab.path)}
              className="flex flex-col items-center gap-1 flex-1 py-2 relative transition-all"
            >
              {active && (
                <div className="absolute inset-0 rounded-xl mx-1 bg-purple-900/30" />
              )}
              <div className={`relative z-10 p-1.5 rounded-lg transition-all ${active ? "bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg" : ""}`}>
                <Icon
                  size={20}
                  className={active ? "text-black" : "text-purple-300"}
                  strokeWidth={active ? 2.5 : 1.5}
                />
              </div>
              <span className={`text-xs relative z-10 font-medium ${active ? "text-yellow-400" : "text-purple-400"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
