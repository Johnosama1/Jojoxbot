import { TonConnectUI } from "@tonconnect/ui-react";

// Manifest URL — must be publicly reachable
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const MANIFEST_URL = `${window.location.origin}${BASE}/tonconnect-manifest.json`;

// Singleton instance shared across the app
let _ui: TonConnectUI | null = null;

export function getTonConnectUI(): TonConnectUI {
  if (!_ui) {
    _ui = new TonConnectUI({ manifestUrl: MANIFEST_URL });
  }
  return _ui;
}
