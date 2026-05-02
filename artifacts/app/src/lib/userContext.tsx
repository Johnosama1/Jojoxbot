import React, { createContext, useContext, useEffect, useState } from "react";
import { api, User } from "./api";
import { getTelegramUser, initTelegramApp, getMockUser } from "./telegram";

interface UserContextType {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  isAdmin: boolean;
  banned: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  isAdmin: false,
  banned: false,
});

const OWNER_USERNAME = "J_O_H_N8";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState(false);

  const init = async () => {
    try {
      initTelegramApp();
      const tgUser = getTelegramUser() ?? getMockUser();

      const u = await api.initUser({
        id: tgUser.id,
        username: tgUser.username ?? undefined,
        first_name: tgUser.first_name ?? undefined,
        last_name: tgUser.last_name ?? undefined,
        photo_url: tgUser.photo_url ?? undefined,
      });
      setUser(u);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "محظور") {
        setBanned(true);
      } else {
        console.error("Failed to init user", e);
      }
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!user) return;
    try {
      const u = await api.getUser(user.id);
      setUser(u);
    } catch (e) {
      console.error("Failed to refresh user", e);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const isAdmin = !!(user && (user.username === OWNER_USERNAME));

  return (
    <UserContext.Provider value={{ user, loading, refresh, isAdmin, banned }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
