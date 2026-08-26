import { useEffect, useRef } from 'react';

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  drift: number;
  phase: number;
  opacity: number;
}

interface Props {
  /** Live wind speed in km/h — drives horizontal turbulence intensity */
  windSpeedKmh?: number;
  density?: number;
  className?: string;
}

/**
 * High-performance canvas renderer for wind-driven polar snow.
 * Turbulence intensity scales with live station wind telemetry.
 */
export default function AtmosphericSnowCanvas({
  windSpeedKmh = 24,
  density = 0.00012,
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const windRef = useRef(windSpeedKmh);

  useEffect(() => {
    windRef.current = windSpeedKmh;
  }, [windSpeedKmh]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let flakes: Snowflake[] = [];
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const seedFlakes = () => {
      const count = Math.max(60, Math.floor(width * height * density));
      flakes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.6 + Math.random() * 2.2,
        speedY: 18 + Math.random() * 55,
        drift: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.25 + Math.random() * 0.6,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedFlakes();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Wind force normalized: 0 km/h -> calm, 120+ km/h -> blizzard
      const windForce = Math.min(windRef.current / 90, 2.2);
      const gust = 1 + Math.sin(now / 1400) * 0.35;

      ctx.clearRect(0, 0, width, height);

      for (const f of flakes) {
        f.y += f.speedY * dt * (1 + windForce * 0.4);
        f.phase += dt * (0.8 + f.radius * 0.5);
        f.x +=
          (Math.sin(f.phase) * 12 +
            windRef.current * 0.22 * gust * (0.4 + f.radius / 3)) *
          dt;

        if (f.y > height + 4) {
          f.y = -4;
          f.x = Math.random() * width;
        }
        if (f.x > width + 6) f.x = -6;
        if (f.x < -6) f.x = width + 6;

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(214, 234, 255, ${f.opacity})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
}
