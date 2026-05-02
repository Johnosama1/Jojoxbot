import { useState, useEffect, useLayoutEffect, useRef } from "react";
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
        const ct = res.headers.get("Content-Type") ?? "";

        if (ct.includes("video/webm")) {
          const buf = await res.arrayBuffer();
          if (cancelled) return;
          const blob = new Blob([buf], { type: "video/webm" });
          setVideoUrl(URL.createObjectURL(blob));
          setFormat("webm");
        } else if (ct.includes("application/json")) {
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

  // useLayoutEffect runs synchronously AFTER DOM mutations — guarantees
  // containerRef.current is set before we try to mount lottie into it.
  useLayoutEffect(() => {
    if (format !== "lottie" || !lottieData || !containerRef.current) return;

    animRef.current?.destroy();
    animRef.current = null;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",      // SVG is more reliable in Android WebView than canvas
      loop: true,
      autoplay: false,       // we call play() manually below
      animationData: lottieData,
    });

    // Explicit play() after a tick — ensures WebView has finished layout
    const t = setTimeout(() => { anim.play(); }, 0);
    animRef.current = anim;

    return () => {
      clearTimeout(t);
      anim.destroy();
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
        style={{ width: size, height: size, display: "inline-block", lineHeight: 0, ...style }}
      />
    );
  }

  return fallbackEl;
}
