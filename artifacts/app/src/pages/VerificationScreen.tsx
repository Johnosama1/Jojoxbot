import { useState } from "react";
import { api } from "../lib/api";

async function collectDeviceFingerprint(): Promise<string> {
  const signals: string[] = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency || 0),
    String((navigator as unknown as { deviceMemory?: number }).deviceMemory || 0),
    String(navigator.maxTouchPoints || 0),
  ];

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 30;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "alphabetic";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#7c6eff";
      ctx.fillRect(0, 0, 10, 10);
      ctx.fillStyle = "rgba(0,200,120,0.8)";
      ctx.fillText("JojoxVerify🎰2025", 2, 20);
      signals.push(canvas.toDataURL().slice(-64));
    }
  } catch { /* ignore canvas error */ }

  const combined = signals.join("|||");
  const data = new TextEncoder().encode(combined);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

interface Props {
  firstName: string;
  onVerified: () => void;
  onBanned: () => void;
}

export default function VerificationScreen({ firstName, onVerified, onBanned }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleVerify = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const deviceId = await collectDeviceFingerprint();
      await api.verifyDevice(deviceId);
      setStatus("idle");
      // Close the mini app so the bot welcome message appears
      const tg = (window as unknown as { Telegram?: { WebApp?: { close(): void } } }).Telegram?.WebApp;
      if (tg) {
        tg.close();
      } else {
        onVerified();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
      if (msg === "محظور") {
        onBanned();
        return;
      }
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #0a0a14 0%, #0d0d1e 100%)",
      padding: "32px 24px",
    }}>
      <div style={{
        background: "rgba(20,20,40,0.95)",
        border: "1px solid rgba(124,110,255,0.3)",
        borderRadius: 24,
        padding: "36px 28px",
        maxWidth: 340,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎰</div>

        <h2 style={{
          color: "#fff",
          fontSize: 22,
          fontWeight: 800,
          margin: "0 0 10px",
        }}>
          مرحباً {firstName}!
        </h2>

        <p style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: 14,
          lineHeight: 1.8,
          margin: "0 0 28px",
        }}>
          خطوة سريعة للتحقق من حسابك<br />
          وضمان أمان منصة Jo-jokes.
        </p>

        <div style={{
          background: "rgba(124,110,255,0.08)",
          border: "1px solid rgba(124,110,255,0.2)",
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 24,
          textAlign: "right",
        }}>
          {[
            { icon: "✅", text: "حساب واحد لكل جهاز" },
            { icon: "🔒", text: "لا يتم مشاركة بياناتك" },
            { icon: "⚡", text: "التحقق يستغرق ثانية واحدة" },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.75)",
            }}>
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {status === "error" && (
          <div style={{
            background: "rgba(255,100,100,0.1)",
            border: "1px solid rgba(255,100,100,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 16,
            color: "#ff8080",
            fontSize: 13,
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={status === "loading"}
          style={{
            width: "100%",
            padding: "15px 20px",
            background: status === "loading"
              ? "rgba(124,110,255,0.4)"
              : "linear-gradient(135deg,#7c6eff,#5a4ee0)",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 700,
            cursor: status === "loading" ? "not-allowed" : "pointer",
            transition: "opacity 0.2s",
            letterSpacing: 0.3,
          }}
        >
          {status === "loading" ? "⏳ جاري التحقق..." : "🔐 تحقق والدخول الآن"}
        </button>
      </div>
    </div>
  );
}
