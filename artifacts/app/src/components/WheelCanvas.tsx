import { useRef, useEffect } from "react";
import { WheelSlot } from "../lib/api";

interface WheelCanvasProps {
  slots: WheelSlot[];
  spinning: boolean;
  winnerIndex: number | null;
  onSpinEnd: () => void;
}

const SEGMENT_COLORS = [
  { bg: "#7c5c00", bgLight: "#ffd700", text: "#ffffff" }, // deep gold
  { bg: "#e8e8e8", bgLight: "#ffffff", text: "#7c5c00" }, // pure white → gold text
  { bg: "#9a7200", bgLight: "#ffe44d", text: "#ffffff" }, // warm gold
  { bg: "#d4d4d4", bgLight: "#f9f9f9", text: "#8a6500" }, // soft white → gold text
  { bg: "#6b4e00", bgLight: "#ffc000", text: "#ffffff" }, // dark amber
  { bg: "#ebebeb", bgLight: "#ffffff", text: "#6b4e00" }, // white → amber text
  { bg: "#8a6500", bgLight: "#ffd700", text: "#ffffff" }, // gold
  { bg: "#e0e0e0", bgLight: "#f8f8f8", text: "#7c5c00" }, // white
  { bg: "#b38900", bgLight: "#ffe566", text: "#ffffff" }, // light gold
  { bg: "#d8d8d8", bgLight: "#ffffff", text: "#9a7200" }, // white → deep gold text
  { bg: "#7c5c00", bgLight: "#ffc62b", text: "#ffffff" }, // amber
  { bg: "#e6e6e6", bgLight: "#ffffff", text: "#7c5c00" }, // white
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
    glowGrad.addColorStop(0, `rgba(34,197,94,${glowPulse})`);
    glowGrad.addColorStop(0.5, `rgba(251,191,36,${glowPulse * 0.35})`);
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
      grad.addColorStop(0.6, colors.bg);
      grad.addColorStop(1, colors.bg);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
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

      const isWhiteSeg = colors.text !== "#ffffff";
      ctx.shadowColor = isWhiteSeg ? "rgba(180,130,0,0.6)" : "rgba(255,215,0,0.7)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = colors.text;
      ctx.font = `900 ${outerR * 0.115}px Cairo, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(text, 0, 0);

      ctx.shadowBlur = 0;
      ctx.fillStyle = isWhiteSeg ? "rgba(140,100,0,0.85)" : "rgba(255,230,100,0.85)";
      ctx.font = `700 ${outerR * 0.066}px Cairo, sans-serif`;
      ctx.fillText("TON", 0, outerR * 0.115 + 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Outer ring — green forest glow
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 1, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(34,197,94,0.80)";
    ctx.lineWidth = 3.5;
    ctx.shadowColor = "rgba(34,197,94,0.55)";
    ctx.shadowBlur = 10 + 5 * Math.sin(glowFrame * 0.07);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Decorative dot ring — alternating green & amber
    const dotCount = slots.length * 2;
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2 + rotation;
      const dx = cx + Math.cos(angle) * (outerR + 4);
      const dy = cy + Math.sin(angle) * (outerR + 4);
      ctx.beginPath();
      ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? "#fbbf24" : "#22c55e";
      ctx.shadowColor = i % 2 === 0 ? "#fbbf24" : "#22c55e";
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Hub center — deep forest
    const hubR = outerR * 0.22;
    const hubGrad = ctx.createRadialGradient(cx - hubR * 0.15, cy - hubR * 0.15, 0, cx, cy, hubR * 1.5);
    hubGrad.addColorStop(0, "#0a2e18");
    hubGrad.addColorStop(0.5, "#052010");
    hubGrad.addColorStop(1, "#020e06");
    ctx.beginPath();
    ctx.arc(cx, cy, hubR * 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, hubR * 1.5, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(34,197,94,${0.5 + 0.2 * Math.sin(glowFrame * 0.08)})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(34,197,94,0.6)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // X logo — amber on dark green
    ctx.save();
    ctx.font = `900 ${hubR * 1.6}px Arial`;
    ctx.fillStyle = "rgba(251,191,36,0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(251,191,36,0.8)";
    ctx.shadowBlur = 14;
    ctx.fillText("✕", cx, cy);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Pointer arrow — amber
    ctx.save();
    ctx.translate(cx, cy - outerR - 2);
    ctx.beginPath();
    ctx.moveTo(0, 17);
    ctx.lineTo(-12, -6);
    ctx.lineTo(12, -6);
    ctx.closePath();
    const pGrad = ctx.createLinearGradient(-12, -6, 12, 17);
    pGrad.addColorStop(0, "#fcd34d");
    pGrad.addColorStop(0.5, "#fbbf24");
    pGrad.addColorStop(1, "#b45309");
    ctx.fillStyle = pGrad;
    ctx.shadowColor = "rgba(251,191,36,0.9)";
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
    // Whole extra rotations ensure the pointer lands EXACTLY on the winner
    const extraSpins = (6 + Math.floor(Math.random() * 4)) * 2 * Math.PI;
    // Final resting angle (always lands winner at pointer)
    const finalAngle = (2 * Math.PI - targetSegAngle) - segAngle / 2;
    const startAngle = rotationRef.current % (2 * Math.PI);
    const totalTravel = extraSpins + finalAngle - startAngle;
    const duration = 5000;

    spinStartRef.current = performance.now();
    isSpinningRef.current = true;
    let frame = 0;

    const animate = (now: number) => {
      const elapsed = now - spinStartRef.current;
      frame++;
      glowFrameRef.current = frame;

      if (elapsed >= duration) {
        rotationRef.current = finalAngle;
        isSpinningRef.current = false;
        drawWheel(rotationRef.current, frame);
        onSpinEnd();
        return;
      }

      const t = elapsed / duration;
      const eased = 1 - Math.pow(1 - t, 4);
      drawWheel(startAngle + eased * totalTravel, frame);
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
          background: "conic-gradient(from 0deg, #fbbf24 0%, #22c55e 20%, #38bdf8 40%, #fbbf24 55%, #84cc16 70%, #f59e0b 85%, #22c55e 100%)",
          opacity: spinning ? 0.70 : 0.40,
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
          background: "#020e06",
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
