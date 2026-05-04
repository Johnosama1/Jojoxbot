const BASE_URL = (import.meta.env.VITE_API_URL ?? "") + "/api";

function getTelegramInitData(): string {
  return (window as unknown as { Telegram?: { WebApp?: { initData: string } } })
    .Telegram?.WebApp?.initData || "";
}

// Module-level caches — fetched once, shared across all component mounts
let _slotsCache: Promise<WheelSlot[]> | null = null;
export function getWheelSlotsOnce(): Promise<WheelSlot[]> {
  if (!_slotsCache) _slotsCache = apiCall<WheelSlot[]>("/wheel");
  return _slotsCache;
}

let _tasksCache: Promise<Task[]> | null = null;
export function getTasksOnce(): Promise<Task[]> {
  if (!_tasksCache) _tasksCache = apiCall<Task[]>("/tasks");
  return _tasksCache;
}

const _completedCache = new Map<number, Promise<number[]>>();
export function getCompletedTasksOnce(userId: number): Promise<number[]> {
  if (!_completedCache.has(userId))
    _completedCache.set(userId, apiCall<number[]>(`/tasks/${userId}/completed`));
  return _completedCache.get(userId)!;
}

const _withdrawalsCache = new Map<number, Promise<Withdrawal[]>>();
export function getWithdrawalsOnce(userId: number): Promise<Withdrawal[]> {
  if (!_withdrawalsCache.has(userId))
    _withdrawalsCache.set(userId, apiCall<Withdrawal[]>(`/withdrawals/${userId}`));
  return _withdrawalsCache.get(userId)!;
}

export function invalidateUserCaches(userId: number) {
  _completedCache.delete(userId);
  _withdrawalsCache.delete(userId);
  _tasksCache = null;
}

export async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const initData = getTelegramInitData();
  const baseHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (initData) baseHeaders["x-telegram-init-data"] = initData;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...baseHeaders,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  getConfig: () => apiCall<{ botUsername: string }>("/config"),

  initUser: (data: { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string }) =>
    apiCall<User>("/users/init", { method: "POST", body: JSON.stringify(data) }),

  getUser: (id: number) => apiCall<User>(`/users/${id}`),

  spin: (userId: number) =>
    apiCall<{ winner: WheelSlot; user: User; slotIndex: number }>(`/users/${userId}/spin`, { method: "POST" }),

  getTasks: () => apiCall<Task[]>("/tasks"),
  getUserCompletedTasks: (userId: number) => apiCall<number[]>(`/tasks/${userId}/completed`),
  completeTask: (taskId: number, userId: number) =>
    apiCall<{ success: boolean; user: User }>(`/tasks/${taskId}/complete`, { method: "POST", body: JSON.stringify({ userId }) }),

  getWheelSlots: () => apiCall<WheelSlot[]>("/wheel"),

  requestWithdrawal: (data: { userId: number; amount: string; walletAddress: string }) =>
    apiCall("/withdrawals", { method: "POST", body: JSON.stringify(data) }),
  getUserWithdrawals: (userId: number) => apiCall<Withdrawal[]>(`/withdrawals/${userId}`),

  // Admin
  adminGetUsers: (userId: number) => apiCall<User[]>("/admin/users", { headers: { "Content-Type": "application/json", "x-user-id": String(userId) } }),
  adminGetTasks: (userId: number) => apiCall<Task[]>("/admin/tasks", { headers: { "Content-Type": "application/json", "x-user-id": String(userId) } }),
  adminCreateTask: (userId: number, data: Partial<Task>) => apiCall<Task>("/admin/tasks", { method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json", "x-user-id": String(userId) } }),
  adminDeleteTask: (userId: number, id: number) => apiCall(`/admin/tasks/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json", "x-user-id": String(userId) } }),
  adminGetWheel: (userId: number) => apiCall<WheelSlot[]>("/admin/wheel", { headers: { "Content-Type": "application/json", "x-user-id": String(userId) } }),
  adminUpdateWheel: (userId: number, slots: WheelSlot[]) => apiCall<WheelSlot[]>("/admin/wheel", { method: "PUT", body: JSON.stringify({ slots }), headers: { "Content-Type": "application/json", "x-user-id": String(userId) } }),
  adminGetSettings: (userId: number) => apiCall<Record<string, string>>("/admin/settings", { headers: { "Content-Type": "application/json", "x-user-id": String(userId) } }),
  adminUpdateSetting: (userId: number, key: string, value: string) => apiCall("/admin/settings", { method: "PUT", body: JSON.stringify({ key, value }), headers: { "Content-Type": "application/json", "x-user-id": String(userId) } }),
  adminUpdateUserBalance: (adminId: number, userId: number, balance?: number, spins?: number) =>
    apiCall<User>(`/admin/users/${userId}/balance`, { method: "PUT", body: JSON.stringify({ balance, spins }), headers: { "Content-Type": "application/json", "x-user-id": String(adminId) } }),
  adminGetWithdrawals: (userId: number) => apiCall<Withdrawal[]>("/admin/withdrawals", { headers: { "Content-Type": "application/json", "x-user-id": String(userId) } }),

  verifyDevice: (deviceId: string) =>
    apiCall<{ success: boolean; alreadyVerified?: boolean }>("/verify-device", {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    }),

  getLeaderboard: (userId?: number) =>
    apiCall<{
      top: Array<{
        rank: number;
        id: number;
        username: string | null;
        firstName: string | null;
        lastName: string | null;
        referralCount: number;
      }>;
      myRank: { rank: number; referralCount: number } | null;
    }>(`/leaderboard${userId ? `?userId=${userId}` : ""}`),
};

export interface User {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  balance: string;
  spins: number;
  referralCount: number;
  tasksCompleted: number;
  referredBy: number | null;
  createdAt: string;
  isVerified: boolean;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  url: string | null;
  icon: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface WheelSlot {
  id: number;
  amount: string;
  probability: number;
  displayOrder: number;
}

export interface Withdrawal {
  id: number;
  userId: number;
  amount: string;
  walletAddress: string;
  status: string;
  createdAt: string;
}
