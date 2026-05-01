import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  type: "gold" | "purple" | "white" | "diamond";
  delay: number;
  duration: number;
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const PARTICLE_COUNT = 60;
    const colors = {
      gold: ["rgba(255,215,0,", "rgba(255,170,0,", "rgba(255,140,0,"],
      purple: ["rgba(147,51,234,", "rgba(168,85,247,", "rgba(192,132,252,"],
      white: ["rgba(255,255,255,", "rgba(220,210,255,"],
      diamond: ["rgba(196,181,253,", "rgba(167,139,250,"],
    };

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight + window.innerHeight,
      size: Math.random() * 3 + 0.5,
      speedY: Math.random() * 0.8 + 0.3,
      speedX: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.7 + 0.2,
      type: (["gold", "purple", "white", "diamond"] as const)[Math.floor(Math.random() * 4)],
      delay: Math.random() * 200,
      duration: Math.random() * 100 + 80,
    }));

    let frame = 0;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background gradient
      const grad = ctx.createRadialGradient(
        canvas.width * 0.3, canvas.height * 0.3, 0,
        canvas.width * 0.3, canvas.height * 0.3, canvas.width * 0.7
      );
      grad.addColorStop(0, "rgba(40, 10, 100, 0.15)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const grad2 = ctx.createRadialGradient(
        canvas.width * 0.7, canvas.height * 0.7, 0,
        canvas.width * 0.7, canvas.height * 0.7, canvas.width * 0.6
      );
      grad2.addColorStop(0, "rgba(80, 20, 180, 0.12)");
      grad2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      particlesRef.current.forEach((p) => {
        if (frame < p.delay) return;

        p.y -= p.speedY;
        p.x += p.speedX + Math.sin(frame * 0.02 + p.x) * 0.2;

        if (p.y < -20) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
          p.delay = 0;
        }

        const colorArr = colors[p.type];
        const col = colorArr[Math.floor(Math.random() * colorArr.length)];
        const pulsingOpacity = p.opacity * (0.7 + 0.3 * Math.sin(frame * 0.05 + p.x));

        ctx.save();
        ctx.globalAlpha = pulsingOpacity;

        if (p.type === "diamond") {
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.PI / 4 + frame * 0.01);
          ctx.fillStyle = `${col}${pulsingOpacity})`;
          ctx.shadowColor = col + "0.8)";
          ctx.shadowBlur = 8;
          ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `${col}${pulsingOpacity})`;
          ctx.shadowColor = col + "0.9)";
          ctx.shadowBlur = p.size * 3;
          ctx.fill();
        }

        ctx.restore();
      });

      // Draw subtle connection lines between nearby gold particles
      const goldParticles = particlesRef.current.filter(p => p.type === "gold" && frame >= p.delay);
      for (let i = 0; i < goldParticles.length; i++) {
        for (let j = i + 1; j < goldParticles.length; j++) {
          const dx = goldParticles[i].x - goldParticles[j].x;
          const dy = goldParticles[i].y - goldParticles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.save();
            ctx.globalAlpha = (1 - dist / 80) * 0.08;
            ctx.strokeStyle = "rgba(255,215,0,1)";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(goldParticles[i].x, goldParticles[i].y);
            ctx.lineTo(goldParticles[j].x, goldParticles[j].y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      {/* Deep dark base */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: "radial-gradient(ellipse at 25% 25%, #140040 0%, #06001a 40%, #020008 100%)",
        }}
      />
      {/* Canvas particles */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
      {/* Ambient glows */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse 60% 40% at 20% 80%, rgba(147,51,234,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 80% 20%, rgba(255,215,0,0.05) 0%, transparent 60%)
          `,
          animation: "bgPulse 10s ease-in-out infinite alternate",
        }}
      />
    </>
  );
}
