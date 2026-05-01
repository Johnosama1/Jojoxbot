declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      photo_url?: string;
    };
    start_param?: string;
  };
  ready(): void;
  expand(): void;
  close(): void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
  };
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
  };
  colorScheme: "dark" | "light";
  themeParams: Record<string, string>;
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp || null;
}

export function getTelegramUser() {
  const tg = getTelegramWebApp();
  if (!tg) return null;
  return tg.initDataUnsafe?.user || null;
}

export function getStartParam(): string | null {
  const tg = getTelegramWebApp();
  if (!tg) return null;
  return tg.initDataUnsafe?.start_param || null;
}

export function initTelegramApp() {
  const tg = getTelegramWebApp();
  if (tg) {
    tg.ready();
    tg.expand();
  }
}

// For testing in browser without Telegram
export function getMockUser() {
  return {
    id: 123456789,
    username: "testuser",
    first_name: "Test",
    last_name: "User",
    photo_url: undefined as string | undefined,
  };
}
