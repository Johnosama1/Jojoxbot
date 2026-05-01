import { useRef, useEffect, useState } from "react";
import { WheelSlot } from "../lib/api";

interface WheelCanvasProps {
  slots: WheelSlot[];
  spinning: boolean;
  winnerIndex: number | null;
  onSpinEnd: () => void;
}

const COLORS = [
  ["#1a0a2e", "#7b2d8b"],
  ["#0a0a1a", "#4a1a7a"],
  ["#2d0a0a", "#8b2d2d"],
  ["#0a1a0a", "#1a5c1a"],
  ["#1a1a0a", "#7a6a00"],
  ["#0a1a2e", "#1a4a8b"],
  ["#2e1a0a", "#8b5c1a"],
  ["#1a0a1a", "#6b1a6b"],
  ["#0a2e1a", "#1a7a4a"],
  ["#2e2e0a", "#7a7a00"],
  ["#0a0a2e", "#1a1a8b"],
  ["#2e0a1a", "#8b1a4a"],
];

const GOLD = "#ffd700";
const GOLD2 = "#ffaa00";

export default function WheelCanvas({ slots, spinning, winnerIndex, onSpinEnd }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const spinStartRef = useRef<number>(0);
  const spinDurationRef = useRef(4500);
  const totalRotationRef = useRef(0);
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
    const outerR = Math.min(cx, cy) - 10;
    const innerR = outerR * 0.15;
    const segAngle = (2 * Math.PI) / slots.length;

    ctx.clearRect(0, 0, W, H);

    // Outer glow ring
    const glowGrad = ctx.createRadialGradient(cx, cy, outerR - 10, cx, cy, outerR + 10);
    glowGrad.addColorStop(0, "rgba(147,51,234,0.6)");
    glowGrad.addColorStop(1, "rgba(147,51,234,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 8, 0, 2 * Math.PI);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Draw segments
    slots.forEach((slot, i) => {
      const startAngle = rotation + i * segAngle - Math.PI / 2;
      const endAngle = startAngle + segAngle;
      const colors = COLORS[i % COLORS.length];

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();

      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.strokeStyle = "rgba(255,215,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Diamond decoration on segment
      ctx.save();
      const midAngle = startAngle + segAngle / 2;
      const dR = outerR * 0.65;
      const dx = cx + dR * Math.cos(midAngle);
      const dy = cy + dR * Math.sin(midAngle);

      ctx.translate(dx, dy);
      ctx.rotate(midAngle + Math.PI / 2);

      // Draw small diamond
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? "#9333ea" : GOLD;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.restore();

      // Text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      const textR = outerR * 0.78;
      ctx.translate(textR, 0);
      ctx.rotate(Math.PI / 2);

      const amount = parseFloat(slot.amount);
      const text = amount >= 1 ? `${amount}` : `${amount}`;
      const subText = "TON";

      ctx.fillStyle = GOLD;
      ctx.font = `bold ${outerR * 0.1}px Cairo, sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(text, 0, -2);

      ctx.fillStyle = "rgba(255,215,0,0.7)";
      ctx.font = `${outerR * 0.065}px Cairo, sans-serif`;
      ctx.fillText(subText, 0, outerR * 0.1 + 1);

      ctx.restore();
    });

    // Outer gold ring
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
    ctx.strokeStyle = `${GOLD}`;
    ctx.lineWidth = 4;
    ctx.shadowColor = GOLD2;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // LED bulbs on outer ring
    const numBulbs = slots.length * 2;
    for (let i = 0; i < numBulbs; i++) {
      const angle = (i / numBulbs) * 2 * Math.PI + rotation;
      const bx = cx + (outerR - 3) * Math.cos(angle);
      const by = cy + (outerR - 3) * Math.sin(angle);
      const isOn = Math.floor(Date.now() / 200 + i) % 3 !== 0;
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = isOn ? GOLD : "#4a3a00";
      ctx.shadowColor = isOn ? GOLD : "transparent";
      ctx.shadowBlur = isOn ? 6 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Inner black circle
    const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR * 3);
    innerGrad.addColorStop(0, "#1a0a2e");
    innerGrad.addColorStop(1, "#0d0618");
    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 3, 0, 2 * Math.PI);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 3, 0, 2 * Math.PI);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.stroke();

    // X logo in center
    ctx.save();
    ctx.font = `bold ${innerR * 3.5}px Arial`;
    ctx.fillStyle = GOLD;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = GOLD2;
    ctx.shadowBlur = 15;
    ctx.fillText("✕", cx, cy);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Pointer (top indicator)
    ctx.save();
    ctx.translate(cx, cy - outerR - 2);
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(-10, -6);
    ctx.lineTo(10, -6);
    ctx.closePath();
    const pGrad = ctx.createLinearGradient(-10, -6, 10, 14);
    pGrad.addColorStop(0, GOLD);
    pGrad.addColorStop(1, GOLD2);
    ctx.fillStyle = pGrad;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  // Continuous LED blink loop
  useEffect(() => {
    let frameId: number;
    const blink = () => {
      if (!isSpinningRef.current) {
        drawWheel(rotationRef.current);
      }
      frameId = requestAnimationFrame(blink);
    };
    frameId = requestAnimationFrame(blink);
    return () => cancelAnimationFrame(frameId);
  }, [slots]);

  useEffect(() => {
    if (!spinning || winnerIndex === null || slots.length === 0) return;

    const segAngle = (2 * Math.PI) / slots.length;
    const targetSegAngle = winnerIndex * segAngle;
    const extraSpins = 5 * 2 * Math.PI;
    const targetRotation = extraSpins + (2 * Math.PI - targetSegAngle) - segAngle / 2;

    totalRotationRef.current = targetRotation;
    spinStartRef.current = performance.now();
    isSpinningRef.current = true;

    const animate = (now: number) => {
      const elapsed = now - spinStartRef.current;
      const duration = spinDurationRef.current;

      if (elapsed >= duration) {
        rotationRef.current = targetRotation % (2 * Math.PI);
        isSpinningRef.current = false;
        drawWheel(rotationRef.current);
        onSpinEnd();
        return;
      }

      // Ease out cubic
      const t = elapsed / duration;
      const eased = 1 - Math.pow(1 - t, 3);
      rotationRef.current = eased * targetRotation;
      drawWheel(rotationRef.current);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [spinning, winnerIndex, slots]);

  return (
    <canvas
      ref={canvasRef}
      width={340}
      height={340}
      style={{ maxWidth: "100%", filter: "drop-shadow(0 0 20px rgba(147,51,234,0.5))" }}
    />
  );
}
