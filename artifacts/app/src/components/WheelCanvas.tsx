import { useRef, useEffect } from "react";
import { WheelSlot } from "../lib/api";

interface WheelCanvasProps {
  slots: WheelSlot[];
  spinning: boolean;
  winnerIndex: number | null;
  onSpinEnd: () => void;
}

const SEGMENT_COLORS = [
  { bg: "#3d0e6e", bgLight: "#5a1fa0", text: "#ffd700" },
  { bg: "#1a0050", bgLight: "#2d0080", text: "#c9a0ff" },
  { bg: "#4a0d7a", bgLight: "#6b1fa8", text: "#ffd700" },
  { bg: "#160040", bgLight: "#280070", text: "#e0c0ff" },
  { bg: "#3d0e6e", bgLight: "#5a1fa0", text: "#ffd700" },
  { bg: "#1a0050", bgLight: "#2d0080", text: "#c9a0ff" },
  { bg: "#4a0d7a", bgLight: "#6b1fa8", text: "#ffd700" },
  { bg: "#160040", bgLight: "#280070", text: "#e0c0ff" },
  { bg: "#3d0e6e", bgLight: "#5a1fa0", text: "#ffd700" },
  { bg: "#1a0050", bgLight: "#2d0080", text: "#c9a0ff" },
  { bg: "#4a0d7a", bgLight: "#6b1fa8", text: "#ffd700" },
  { bg: "#160040", bgLight: "#280070", text: "#e0c0ff" },
];

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
  grad.addColorStop(0, "#ffe566");
  grad.addColorStop(0.5, "#ffd700");
  grad.addColorStop(1, "#8b6000");
  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(255,215,0,0.8)";
  ctx.shadowBlur = 5;
  ctx.fill();
  ctx.restore();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.6, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.6, 0);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-size, -size, size, size);
  grad.addColorStop(0, "#e0d0ff");
  grad.addColorStop(0.3, "#c084fc");
  grad.addColorStop(0.7, "#9333ea");
  grad.addColorStop(1, "#6b21a8");
  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(192,132,252,0.9)";
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
}

export default function WheelCanvas({ slots, spinning, winnerIndex, onSpinEnd }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const spinStartRef = useRef<number>(0);
  const isSpinningRef = useRef(false);
  const glowFrameRef = useRef(0);

  const drawWheel = (rotation: number, glowFrame = 0) => {
    const canvas = canvasRef.current;
    if (!canvas || slots.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const outerR = Math.min(cx, cy) - 16;
    const segAngle = (2 * Math.PI) / slots.length;

    ctx.clearRect(0, 0, W, H);

    // Outer ambient glow
    const glowPulse = 0.3 + 0.15 * Math.sin(glowFrame * 0.06);
    const glowGrad = ctx.createRadialGradient(cx, cy, outerR - 5, cx, cy, outerR + 22);
    glowGrad.addColorStop(0, `rgba(147,51,234,${glowPulse})`);
    glowGrad.addColorStop(0.5, `rgba(255,215,0,${glowPulse * 0.3})`);
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 22, 0, 2 * Math.PI);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Draw segments
    slots.forEach((slot, i) => {
      const startAngle = rotation + i * segAngle - Math.PI / 2;
      const endAngle = startAngle + segAngle;
      const colors = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      const midAngle = startAngle + segAngle / 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();

      const gx = cx + Math.cos(midAngle) * outerR * 0.45;
      const gy = cy + Math.sin(midAngle) * outerR * 0.45;
      const grad = ctx.createRadialGradient(gx, gy, 0, cx, cy, outerR);
      grad.addColorStop(0, colors.bgLight);
      grad.addColorStop(0.7, colors.bg);
      grad.addColorStop(1, "#06001a");
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = "rgba(255,215,0,0.2)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();

      // Draw icon (coin or diamond)
      const iconDist = outerR * 0.52;
      const iconX = cx + Math.cos(midAngle) * iconDist * 0.55;
      const iconY = cy + Math.sin(midAngle) * iconDist * 0.55;
      const iconSz = outerR * 0.052;
      if (i % 2 === 0) {
        drawCoin(ctx, iconX, iconY, iconSz);
      } else {
        drawDiamond(ctx, iconX, iconY, iconSz * 1.15);
      }

      // Amount text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      ctx.translate(outerR * 0.7, 0);
      ctx.rotate(Math.PI / 2);

      const amount = parseFloat(slot.amount);
      const text = amount < 1 ? amount.toFixed(2) : amount % 1 === 0 ? String(amount) : amount.toFixed(1);

      ctx.shadowColor = colors.text === "#ffd700" ? "rgba(255,215,0,0.9)" : "rgba(192,132,252,0.9)";
      ctx.shadowBlur = 5;
      ctx.fillStyle = colors.text;
      ctx.font = `900 ${outerR * 0.115}px Cairo, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(text, 0, 0);

      ctx.shadowBlur = 2;
      ctx.fillStyle = "rgba(210,190,255,0.8)";
      ctx.font = `700 ${outerR * 0.066}px Cairo, sans-serif`;
      ctx.fillText("TON", 0, outerR * 0.115 + 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Outer gold ring
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 1, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,215,0,0.75)";
    ctx.lineWidth = 3.5;
    ctx.shadowColor = "rgba(255,215,0,0.6)";
    ctx.shadowBlur = 10 + 5 * Math.sin(glowFrame * 0.07);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Decorative dot ring
    const dotCount = slots.length * 2;
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2 + rotation;
      const dx = cx + Math.cos(angle) * (outerR + 4);
      const dy = cy + Math.sin(angle) * (outerR + 4);
      ctx.beginPath();
      ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? "#ffd700" : "#a855f7";
      ctx.shadowColor = i % 2 === 0 ? "#ffd700" : "#a855f7";
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Hub center
    const hubR = outerR * 0.22;
    const hubGrad = ctx.createRadialGradient(cx - hubR * 0.15, cy - hubR * 0.15, 0, cx, cy, hubR * 1.5);
    hubGrad.addColorStop(0, "#1e0060");
    hubGrad.addColorStop(0.5, "#0e0035");
    hubGrad.addColorStop(1, "#050015");
    ctx.beginPath();
    ctx.arc(cx, cy, hubR * 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, hubR * 1.5, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(255,215,0,${0.5 + 0.2 * Math.sin(glowFrame * 0.08)})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,215,0,0.5)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // X logo
    ctx.save();
    ctx.font = `900 ${hubR * 1.6}px Arial`;
    ctx.fillStyle = "rgba(255,215,0,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255,215,0,0.7)";
    ctx.shadowBlur = 14;
    ctx.fillText("✕", cx, cy);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Pointer arrow
    ctx.save();
    ctx.translate(cx, cy - outerR - 2);
    ctx.beginPath();
    ctx.moveTo(0, 17);
    ctx.lineTo(-12, -6);
    ctx.lineTo(12, -6);
    ctx.closePath();
    const pGrad = ctx.createLinearGradient(-12, -6, 12, 17);
    pGrad.addColorStop(0, "#ffe566");
    pGrad.addColorStop(0.5, "#ffd700");
    pGrad.addColorStop(1, "#cc7700");
    ctx.fillStyle = pGrad;
    ctx.shadowColor = "rgba(255,215,0,0.9)";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  // Idle glow animation
  useEffect(() => {
    if (spinning) return;
    let frame = 0;
    const idle = () => {
      frame++;
      glowFrameRef.current = frame;
      drawWheel(rotationRef.current, frame);
      animFrameRef.current = requestAnimationFrame(idle);
    };
    animFrameRef.current = requestAnimationFrame(idle);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [slots, spinning]);

  // Spin animation
  useEffect(() => {
    if (!spinning || winnerIndex === null || slots.length === 0) return;
    cancelAnimationFrame(animFrameRef.current);

    const segAngle = (2 * Math.PI) / slots.length;
    const targetSegAngle = winnerIndex * segAngle;
    const extraSpins = (6 + Math.random()) * 2 * Math.PI;
    const targetRotation = extraSpins + (2 * Math.PI - targetSegAngle) - segAngle / 2;
    const duration = 5000;

    spinStartRef.current = performance.now();
    isSpinningRef.current = true;
    let frame = 0;

    const animate = (now: number) => {
      const elapsed = now - spinStartRef.current;
      frame++;
      glowFrameRef.current = frame;

      if (elapsed >= duration) {
        rotationRef.current = targetRotation % (2 * Math.PI);
        isSpinningRef.current = false;
        drawWheel(rotationRef.current, frame);
        onSpinEnd();
        return;
      }

      const t = elapsed / duration;
      const eased = 1 - Math.pow(1 - t, 4);
      drawWheel(eased * targetRotation, frame);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [spinning, winnerIndex, slots]);

  const size = Math.min((typeof window !== "undefined" ? window.innerWidth : 380) - 48, 340);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          background: "conic-gradient(from 0deg, #ffd700 0%, #9333ea 20%, #c084fc 40%, #ffd700 60%, #ff8c00 80%, #9333ea 100%)",
          opacity: spinning ? 0.65 : 0.35,
          filter: "blur(2px)",
          animation: "rotate-slow 3s linear infinite",
          transition: "opacity 0.5s",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: "50%",
          background: "#06001a",
        }}
      />
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ position: "relative", zIndex: 1, maxWidth: "100%" }}
      />
    </div>
  );
}
