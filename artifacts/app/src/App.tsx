import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserProvider } from "./lib/userContext";
import TabBar from "./components/TabBar";
import AnimatedBackground from "./components/AnimatedBackground";
import HomePage from "./pages/HomePage";
import TasksPage from "./pages/TasksPage";
import ReferralPage from "./pages/ReferralPage";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient();

function Router() {
  return (
    <>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/referral" component={ReferralPage} />
        <Route path="/account" component={AccountPage} />
        <Route path="/admin" component={AdminPage} />
      </Switch>
      <TabBar />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <AnimatedBackground />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
