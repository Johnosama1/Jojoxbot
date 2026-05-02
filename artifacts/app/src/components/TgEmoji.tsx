import { useState, useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

type Format = "lottie" | "webm" | "failed" | "loading";

interface TgEmojiProps {
  id: string;
  fallback: string;
  size?: number;
  style?: React.CSSProperties;
}

export default function TgEmoji({ id, fallback, size = 24, style }: TgEmojiProps) {
  const [format, setFormat] = useState<Format>("loading");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [lottieData, setLottieData] = useState<object | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFormat("loading");
    setVideoUrl(null);
    setLottieData(null);

    fetch(`${API_BASE}/sticker/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Not ok");

        // Use Content-Type (always CORS-safe) to detect format
        // instead of a custom header that may be blocked by CORS
        const ct = res.headers.get("Content-Type") ?? "";

        if (ct.includes("video/webm")) {
          const buf = await res.arrayBuffer();
          if (cancelled) return;
          const blob = new Blob([buf], { type: "video/webm" });
          setVideoUrl(URL.createObjectURL(blob));
          setFormat("webm");
        } else if (ct.includes("application/json")) {
          // Server already decompressed TGS → plain Lottie JSON
          const json = await res.json();
          if (cancelled) return;
          setLottieData(json);
          setFormat("lottie");
        } else {
          if (!cancelled) setFormat("failed");
        }
      })
      .catch(() => { if (!cancelled) setFormat("failed"); });

    return () => { cancelled = true; };
  }, [id]);

  // Mount lottie animation once container div exists in DOM
  useEffect(() => {
    if (format !== "lottie" || !lottieData || !containerRef.current) return;
    animRef.current?.destroy();
    animRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "canvas",   // canvas is faster & more compatible on mobile
      loop: true,
      autoplay: true,
      animationData: lottieData,
    });
    return () => {
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [format, lottieData]);

  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl); };
  }, [videoUrl]);

  const fallbackEl = (
    <span style={{ fontSize: size * 0.85, lineHeight: 1, display: "inline-block", ...style }}>
      {fallback}
    </span>
  );

  if (format === "failed") return fallbackEl;

  if (format === "webm" && videoUrl) {
    return (
      <video
        src={videoUrl}
        autoPlay loop muted playsInline
        width={size} height={size}
        style={{ display: "inline-block", objectFit: "contain", ...style }}
      />
    );
  }

  if (format === "lottie") {
    return (
      <div
        ref={containerRef}
        style={{ width: size, height: size, display: "inline-block", ...style }}
      />
    );
  }

  // Loading → show fallback emoji until sticker is ready
  return fallbackEl;
}
