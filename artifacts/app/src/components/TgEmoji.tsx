import { useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

interface TgEmojiProps {
  id: string;
  fallback: string;
  size?: number;
  style?: React.CSSProperties;
}

export default function TgEmoji({ id, fallback, size = 24, style }: TgEmojiProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", ...style }}>{fallback}</span>;
  }

  return (
    <img
      src={`${API_BASE}/sticker/${id}`}
      alt={fallback}
      width={size}
      height={size}
      style={{ objectFit: "contain", display: "inline-block", verticalAlign: "middle", ...style }}
      onError={() => setFailed(true)}
    />
  );
}
