import { useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserProvider, useUser } from "./lib/userContext";
import TabBar from "./components/TabBar";
import AnimatedBackground from "./components/AnimatedBackground";
import HomePage from "./pages/HomePage";
import TasksPage from "./pages/TasksPage";
import ReferralPage from "./pages/ReferralPage";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient();

function BannedScreen() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #0a0f0a 0%, #0e1a10 100%)",
      padding: "32px 24px", textAlign: "center", gap: 20,
    }}>
      <div style={{ fontSize: 72 }}>🚫</div>
      <div style={{
        background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
        borderRadius: 20, padding: "28px 24px", maxWidth: 320,
      }}>
        <h2 style={{ color: "#f87171", fontWeight: 900, fontSize: 22, margin: "0 0 12px" }}>
          تم حظر حسابك
        </h2>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, margin: 0, lineHeight: 1.7 }}>
          لا يمكنك الوصول إلى هذا التطبيق.
          <br />للاستفسار تواصل مع الدعم.
        </p>
      </div>
    </div>
  );
}

const ROUTES = [
  { path: "/", Component: HomePage },
  { path: "/tasks", Component: TasksPage },
  { path: "/referral", Component: ReferralPage },
  { path: "/account", Component: AccountPage },
  { path: "/admin", Component: AdminPage },
];

function PersistentRouter() {
  const [location] = useLocation();
  const { banned } = useUser();
  if (banned) return <BannedScreen />;
  return (
    <>
      {ROUTES.map(({ path, Component }) => {
        const isActive =
          path === "/"
            ? location === "/" || location === ""
            : location === path || location.startsWith(path + "/");
        return (
          <div
            key={path}
            style={{
              display: isActive ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              overflow: "hidden",
            }}
          >
            <Component />
          </div>
        );
      })}
      <TabBar />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <AnimatedBackground />
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <PersistentRouter />
          </WouterRouter>
        </div>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
