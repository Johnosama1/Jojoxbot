import { useRef, useEffect } from "react";
import { WheelSlot } from "../lib/api";

interface WheelCanvasProps {
  slots: WheelSlot[];
  spinning: boolean;
  winnerIndex: number | null;
  onSpinEnd: () => void;
}

const SEGMENT_COLORS = [
  { bg: "rgba(180,140,0,0.38)",  bgLight: "rgba(255,220,80,0.55)",  text: "#ffe9a0" }, // muted gold
  { bg: "rgba(255,255,255,0.12)", bgLight: "rgba(255,255,255,0.28)", text: "#f5e6b8" }, // frosted white
  { bg: "rgba(160,120,0,0.35)",  bgLight: "rgba(255,210,60,0.50)",  text: "#ffe9a0" }, // warm gold
  { bg: "rgba(255,255,255,0.10)", bgLight: "rgba(240,235,210,0.26)", text: "#e8d99a" }, // soft ivory
  { bg: "rgba(140,100,0,0.40)",  bgLight: "rgba(230,180,40,0.52)",  text: "#ffe9a0" }, // amber muted
  { bg: "rgba(255,255,255,0.13)", bgLight: "rgba(255,250,230,0.30)", text: "#e8d99a" }, // frosted ivory
  { bg: "rgba(170,130,0,0.36)",  bgLight: "rgba(255,215,70,0.50)",  text: "#ffe9a0" }, // gold
  { bg: "rgba(255,255,255,0.11)", bgLight: "rgba(245,240,220,0.27)", text: "#f0e0a8" }, // white glass
  { bg: "rgba(150,110,0,0.38)",  bgLight: "rgba(240,200,60,0.50)",  text: "#ffe9a0" }, // deep amber
  { bg: "rgba(255,255,255,0.12)", bgLight: "rgba(255,248,225,0.28)", text: "#e8d99a" }, // soft white
  { bg: "rgba(165,125,0,0.37)",  bgLight: "rgba(255,212,65,0.52)",  text: "#ffe9a0" }, // amber
  { bg: "rgba(255,255,255,0.10)", bgLight: "rgba(250,242,215,0.26)", text: "#f0e0a8" }, // glass
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

  const drawSkeleton = (glowFrame = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
    const outerR = Math.min(cx, cy) - 16;
    ctx.clearRect(0, 0, W, H);

    // Ambient glow
    const glowPulse = 0.25 + 0.12 * Math.sin(glowFrame * 0.06);
    const glowGrad = ctx.createRadialGradient(cx, cy, outerR - 5, cx, cy, outerR + 22);
    glowGrad.addColorStop(0, `rgba(34,197,94,${glowPulse})`);
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath(); ctx.arc(cx, cy, outerR + 22, 0, 2 * Math.PI);
    ctx.fillStyle = glowGrad; ctx.fill();

    // Skeleton disc
    const discGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
    discGrad.addColorStop(0, "rgba(20,60,30,0.55)");
    discGrad.addColorStop(1, "rgba(5,20,10,0.70)");
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
    ctx.fillStyle = discGrad; ctx.fill();

    // Outer ring
    ctx.beginPath(); ctx.arc(cx, cy, outerR + 1, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(34,197,94,0.65)"; ctx.lineWidth = 3.5;
    ctx.shadowColor = "rgba(34,197,94,0.5)";
    ctx.shadowBlur = 10 + 5 * Math.sin(glowFrame * 0.07);
    ctx.stroke(); ctx.shadowBlur = 0;

    // Hub
    const hubR = outerR * 0.22;
    const hubGrad = ctx.createRadialGradient(cx - hubR * 0.15, cy - hubR * 0.15, 0, cx, cy, hubR * 1.5);
    hubGrad.addColorStop(0, "#0a2e18"); hubGrad.addColorStop(1, "#020e06");
    ctx.beginPath(); ctx.arc(cx, cy, hubR * 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad; ctx.fill();
    ctx.strokeStyle = `rgba(34,197,94,${0.4 + 0.2 * Math.sin(glowFrame * 0.08)})`;
    ctx.lineWidth = 2; ctx.shadowColor = "rgba(34,197,94,0.5)"; ctx.shadowBlur = 8;
    ctx.stroke(); ctx.shadowBlur = 0;

    // X logo
    ctx.save();
    ctx.font = `900 ${hubR * 1.6}px Arial`;
    ctx.fillStyle = "rgba(251,191,36,0.90)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(251,191,36,0.7)"; ctx.shadowBlur = 12;
    ctx.fillText("✕", cx, cy); ctx.shadowBlur = 0; ctx.restore();

    // Pointer arrow
    ctx.save(); ctx.translate(cx, cy - outerR - 2);
    ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(-12, -6); ctx.lineTo(12, -6); ctx.closePath();
    const pGrad = ctx.createLinearGradient(-12, -6, 12, 17);
    pGrad.addColorStop(0, "#fcd34d"); pGrad.addColorStop(1, "#b45309");
    ctx.fillStyle = pGrad; ctx.shadowColor = "rgba(251,191,36,0.8)"; ctx.shadowBlur = 12;
    ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
  };

  const drawWheel = (rotation: number, glowFrame = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (slots.length === 0) { drawSkeleton(glowFrame); return; }
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

      ctx.strokeStyle = "rgba(255,220,100,0.30)";
      ctx.lineWidth = 1.2;
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
      // Show the exact value — no rounding (e.g. 0.025 stays 0.025, not 0.03)
      const text = parseFloat(amount.toPrecision(6)).toString();

      ctx.shadowColor = "rgba(255,200,50,0.55)";
      ctx.shadowBlur = 6;
      ctx.fillStyle = colors.text;
      // Shrink font if text is long (e.g. 0.025 = 5 chars)
      const fontSize = text.length <= 4 ? outerR * 0.115 : outerR * 0.090;
      ctx.font = `900 ${fontSize}px Cairo, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(text, 0, 0);

      ctx.shadowBlur = 3;
      ctx.shadowColor = "rgba(200,160,0,0.4)";
      ctx.fillStyle = "rgba(255,230,140,0.80)";
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

  // Free-spin phase: wheel spinning fast while waiting for API result
  useEffect(() => {
    if (!spinning || winnerIndex !== null || slots.length === 0) return;
    cancelAnimationFrame(animFrameRef.current);

    const SPEED = (2 * Math.PI * 3) / 1000; // 3 full rotations per second
    let last = performance.now();
    let frame = glowFrameRef.current;

    const animate = (now: number) => {
      const delta = Math.min(now - last, 50);
      last = now;
      frame++;
      rotationRef.current = (rotationRef.current + SPEED * delta) % (2 * Math.PI);
      glowFrameRef.current = frame;
      drawWheel(rotationRef.current, frame);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [spinning, winnerIndex, slots]);

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

  // Responsive size: fits small phones (320px) up to large ones (430px+)
  const vw = typeof window !== "undefined" ? window.innerWidth : 380;
  const vh = typeof window !== "undefined" ? window.innerHeight : 700;
  // On short screens (< 660px tall), shrink the wheel to leave room for controls
  const maxByHeight = vh < 660 ? vh * 0.38 : 340;
  const size = Math.min(vw - 40, maxByHeight, 340);

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
