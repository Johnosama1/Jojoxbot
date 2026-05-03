import React, { createContext, useContext, useEffect, useState } from "react";
import { api, User, WheelSlot, getWheelSlotsOnce, getTasksOnce, getCompletedTasksOnce, getWithdrawalsOnce } from "./api";
import { getTelegramUser, initTelegramApp, getMockUser } from "./telegram";

interface UserContextType {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  isAdmin: boolean;
  banned: boolean;
  slots: WheelSlot[];
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  isAdmin: false,
  banned: false,
  slots: [],
});

const OWNER_USERNAME = "J_O_H_N8";

// ── LocalStorage cache helpers ──────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: T };
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* storage full — silently skip */ }
}

// ────────────────────────────────────────────────────────────────────

const hideSplash = () => {
  const splash = document.getElementById("splash");
  if (splash && !splash.classList.contains("hidden")) {
    splash.classList.add("hidden");
    setTimeout(() => splash.remove(), 600);
  }
};

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState(false);
  const [slots, setSlots] = useState<WheelSlot[]>([]);

  const init = async () => {
    try {
      initTelegramApp();
      const tgUser = getTelegramUser() ?? getMockUser();

      // ── Step 1: Show cached data INSTANTLY (< 1 ms) ──────────────
      const cachedUser = readCache<User>(`user:${tgUser.id}`);
      const cachedSlots = readCache<WheelSlot[]>("slots");

      if (cachedUser && cachedSlots) {
        setUser(cachedUser);
        setSlots(cachedSlots);
        setLoading(false);
      }

      // ── Hide splash NOW — don't wait for API ──────────────────────
      // User sees the wheel UI immediately; data fills in from cache or network.
      hideSplash();

      // ── Step 2: Kick off all network requests in parallel ─────────
      const slotsPromise = getWheelSlotsOnce();
      getTasksOnce().catch(() => {});   // warm cache silently

      const freshUser = await api.initUser({
        id: tgUser.id,
        username: tgUser.username ?? undefined,
        first_name: tgUser.first_name ?? undefined,
        last_name: tgUser.last_name ?? undefined,
        photo_url: tgUser.photo_url ?? undefined,
      });

      const freshSlots = await slotsPromise.catch(() => cachedSlots ?? [] as WheelSlot[]);

      // Update UI & cache
      setUser(freshUser);
      setSlots(freshSlots as WheelSlot[]);
      writeCache(`user:${freshUser.id}`, freshUser);
      writeCache("slots", freshSlots);

      // ── Step 3: Hide splash if not already hidden ─────────────────
      hideSplash();
      setLoading(false);

      // ── Step 4: Pre-warm secondary caches in background ──────────
      getCompletedTasksOnce(freshUser.id).catch(() => {});
      getWithdrawalsOnce(freshUser.id).catch(() => {});

    } catch (e: unknown) {
      if (e instanceof Error && e.message === "محظور") {
        setBanned(true);
      } else {
        console.error("Failed to init user", e);
      }
      setLoading(false);
      hideSplash();
    }
  };

  const refresh = async () => {
    if (!user) return;
    try {
      const u = await api.getUser(user.id);
      setUser(u);
      writeCache(`user:${u.id}`, u);
    } catch (e) {
      console.error("Failed to refresh user", e);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const isAdmin = !!(user && (user.username === OWNER_USERNAME));

  return (
    <UserContext.Provider value={{ user, loading, refresh, isAdmin, banned, slots }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
