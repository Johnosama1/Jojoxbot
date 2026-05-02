import { useState, useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { decompress } from "fflate";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

type Format = "tgs" | "webm" | "failed" | "loading";

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
        const fmt = res.headers.get("X-Sticker-Format") ?? "webp";
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        if (fmt === "webm") {
          const blob = new Blob([buf], { type: "video/webm" });
          setVideoUrl(URL.createObjectURL(blob));
          setFormat("webm");
        } else if (fmt === "tgs") {
          decompress(new Uint8Array(buf), (err, data) => {
            if (cancelled) return;
            if (err) { setFormat("failed"); return; }
            try {
              const json = JSON.parse(new TextDecoder().decode(data));
              setLottieData(json);
              setFormat("tgs");
            } catch {
              setFormat("failed");
            }
          });
        } else {
          setFormat("failed");
        }
      })
      .catch(() => { if (!cancelled) setFormat("failed"); });

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (format !== "tgs" || !lottieData || !containerRef.current) return;
    animRef.current?.destroy();
    animRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
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
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  if (format === "failed") {
    return (
      <span style={{ fontSize: size * 0.85, lineHeight: 1, display: "inline-block", ...style }}>
        {fallback}
      </span>
    );
  }

  if (format === "webm" && videoUrl) {
    return (
      <video
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        width={size}
        height={size}
        style={{ display: "inline-block", objectFit: "contain", ...style }}
      />
    );
  }

  if (format === "tgs") {
    return (
      <div
        ref={containerRef}
        style={{ width: size, height: size, display: "inline-block", ...style }}
      />
    );
  }

  // Loading — show fallback emoji
  return (
    <span style={{ fontSize: size * 0.85, lineHeight: 1, display: "inline-block", ...style }}>
      {fallback}
    </span>
  );
}
