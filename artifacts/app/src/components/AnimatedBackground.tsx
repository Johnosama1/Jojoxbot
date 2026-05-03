import { useEffect, useRef } from "react";

const bgImage = "/bg.jpg";

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

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

    const COUNT = 40;
    const sparks = Array.from({ length: COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: -(Math.random() * 0.4 + 0.1),
      opacity: Math.random(),
      maxOpacity: Math.random() * 0.7 + 0.3,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() > 0.5 ? "255,230,100" : "255,255,255",
    }));

    let frame = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparks.forEach((s) => {
        s.x += s.speedX + Math.sin(frame * 0.015 + s.phase) * 0.25;
        s.y += s.speedY;
        s.opacity = s.maxOpacity * (0.5 + 0.5 * Math.sin(frame * 0.03 + s.phase));

        if (s.y < -10) {
          s.y = canvas.height + 10;
          s.x = Math.random() * canvas.width;
        }
        if (s.x < -10) s.x = canvas.width + 10;
        if (s.x > canvas.width + 10) s.x = -10;

        ctx.save();
        ctx.globalAlpha = s.opacity;
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3);
        grd.addColorStop(0, `rgba(${s.color},1)`);
        grd.addColorStop(1, `rgba(${s.color},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

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
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(to bottom, rgba(0,20,10,0.45) 0%, rgba(0,10,5,0.55) 60%, rgba(0,15,8,0.70) 100%)",
          pointerEvents: "none",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none" }}
      />
    </>
  );
}
