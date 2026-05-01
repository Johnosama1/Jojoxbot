import { useRef, useEffect } from "react";
import { WheelSlot } from "../lib/api";

interface WheelCanvasProps {
  slots: WheelSlot[];
  spinning: boolean;
  winnerIndex: number | null;
  onSpinEnd: () => void;
}

const SEGMENT_COLORS = [
  { bg: "#0d0730", border: "rgba(255,215,0,0.35)", text: "#ffd700" },
  { bg: "#15063a", border: "rgba(180,130,255,0.35)", text: "#c9a0ff" },
  { bg: "#0d0730", border: "rgba(255,215,0,0.35)", text: "#ffd700" },
  { bg: "#15063a", border: "rgba(180,130,255,0.35)", text: "#c9a0ff" },
  { bg: "#0d0730", border: "rgba(255,215,0,0.35)", text: "#ffd700" },
  { bg: "#15063a", border: "rgba(180,130,255,0.35)", text: "#c9a0ff" },
  { bg: "#0d0730", border: "rgba(255,215,0,0.35)", text: "#ffd700" },
  { bg: "#15063a", border: "rgba(180,130,255,0.35)", text: "#c9a0ff" },
  { bg: "#0d0730", border: "rgba(255,215,0,0.35)", text: "#ffd700" },
  { bg: "#15063a", border: "rgba(180,130,255,0.35)", text: "#c9a0ff" },
  { bg: "#0d0730", border: "rgba(255,215,0,0.35)", text: "#ffd700" },
  { bg: "#15063a", border: "rgba(180,130,255,0.35)", text: "#c9a0ff" },
];

export default function WheelCanvas({ slots, spinning, winnerIndex, onSpinEnd }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const spinStartRef = useRef<number>(0);
  const isSpinningRef = useRef(false);

  const drawWheel = (rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas || slots.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const outerR = Math.min(cx, cy) - 14;
    const innerR = outerR * 0.18;
    const segAngle = (2 * Math.PI) / slots.length;

    ctx.clearRect(0, 0, W, H);

    // Subtle outer glow
    const glowGrad = ctx.createRadialGradient(cx, cy, outerR - 4, cx, cy, outerR + 16);
    glowGrad.addColorStop(0, "rgba(120,60,220,0.3)");
    glowGrad.addColorStop(1, "rgba(120,60,220,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 14, 0, 2 * Math.PI);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Draw segments
    slots.forEach((slot, i) => {
      const startAngle = rotation + i * segAngle - Math.PI / 2;
      const endAngle = startAngle + segAngle;
      const colors = SEGMENT_COLORS[i % SEGMENT_COLORS.length];

      // Segment fill
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();

      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      grad.addColorStop(0, colors.bg);
      grad.addColorStop(1, colors.bg === "#0d0730" ? "#1a0e50" : "#220a5e");
      ctx.fillStyle = grad;
      ctx.fill();

      // Divider lines
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Amount text
      ctx.save();
      const midAngle = startAngle + segAngle / 2;
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      const textR = outerR * 0.72;
      ctx.translate(textR, 0);
      ctx.rotate(Math.PI / 2);

      const amount = parseFloat(slot.amount);
      const text = amount < 1 ? amount.toFixed(2) : String(amount);

      ctx.fillStyle = colors.text;
      ctx.font = `bold ${outerR * 0.105}px Cairo, sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 3;
      ctx.fillText(text, 0, -1);

      ctx.fillStyle = "rgba(200,170,255,0.7)";
      ctx.font = `${outerR * 0.065}px Cairo, sans-serif`;
      ctx.fillText("TON", 0, outerR * 0.1 + 2);

      ctx.restore();
    });

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,215,0,0.55)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255,215,0,0.4)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner dark circle
    const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR * 3.2);
    innerGrad.addColorStop(0, "#0a0520");
    innerGrad.addColorStop(1, "#150838");
    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 3.2, 0, 2 * Math.PI);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 3.2, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,215,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // X logo center
    ctx.save();
    ctx.font = `bold ${innerR * 3.2}px Arial`;
    ctx.fillStyle = "rgba(255,215,0,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255,215,0,0.5)";
    ctx.shadowBlur = 12;
    ctx.fillText("✕", cx, cy);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Pointer triangle (top)
    ctx.save();
    ctx.translate(cx, cy - outerR - 1);
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.lineTo(-9, -5);
    ctx.lineTo(9, -5);
    ctx.closePath();
    const pGrad = ctx.createLinearGradient(-9, -5, 9, 13);
    pGrad.addColorStop(0, "#ffd700");
    pGrad.addColorStop(1, "#cc8800");
    ctx.fillStyle = pGrad;
    ctx.shadowColor = "rgba(255,215,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  // Initial draw & re-draw on slot change
  useEffect(() => {
    drawWheel(rotationRef.current);
  }, [slots]);

  // Spin animation
  useEffect(() => {
    if (!spinning || winnerIndex === null || slots.length === 0) return;

    const segAngle = (2 * Math.PI) / slots.length;
    const targetSegAngle = winnerIndex * segAngle;
    const extraSpins = 5 * 2 * Math.PI;
    const targetRotation = extraSpins + (2 * Math.PI - targetSegAngle) - segAngle / 2;
    const duration = 4800;

    spinStartRef.current = performance.now();
    isSpinningRef.current = true;

    const animate = (now: number) => {
      const elapsed = now - spinStartRef.current;

      if (elapsed >= duration) {
        rotationRef.current = targetRotation % (2 * Math.PI);
        isSpinningRef.current = false;
        drawWheel(rotationRef.current);
        onSpinEnd();
        return;
      }

      // Ease out quartic — smooth deceleration
      const t = elapsed / duration;
      const eased = 1 - Math.pow(1 - t, 4);
      drawWheel(eased * targetRotation);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [spinning, winnerIndex, slots]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      style={{
        maxWidth: "100%",
        filter: "drop-shadow(0 0 18px rgba(100,60,200,0.45))",
      }}
    />
  );
}
