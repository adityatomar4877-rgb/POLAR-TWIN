import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface GSAPWindStreamProps {
  speedKmh?: number;
  directionDeg?: number;
}

/**
 * GSAP-powered atmospheric polar wind streamline & particle visualizer.
 */
export default function GSAPWindStream({
  speedKmh = 18.5,
  directionDeg = 215,
}: GSAPWindStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!needleRef.current) return;
    gsap.to(needleRef.current, {
      rotation: directionDeg,
      transformOrigin: '50% 50%',
      duration: 1.2,
      ease: 'back.out(1.5)',
    });
  }, [directionDeg]);

  useEffect(() => {
    if (!containerRef.current) return;
    const lines = containerRef.current.querySelectorAll('.wind-stream-line');

    lines.forEach((line, i) => {
      const speed = Math.max(0.6, 2.5 - (speedKmh / 50));
      gsap.fromTo(
        line,
        { x: -120, opacity: 0 },
        {
          x: 280,
          opacity: 0.85,
          duration: speed + (i * 0.2),
          repeat: -1,
          ease: 'power1.inOut',
          delay: (i * 0.35) % 1.5,
        }
      );
    });
  }, [speedKmh]);

  return (
    <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 text-white shadow-sm">
      {/* Background animated particle vectors */}
      <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        {[20, 35, 50, 65, 80].map((y, idx) => (
          <div
            key={idx}
            className="wind-stream-line absolute h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
            style={{ top: `${y}%` }}
          />
        ))}
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
            Atmospheric Wind Vector
          </span>
        </div>
        <p className="mt-1 font-mono text-2xl font-extrabold text-white">
          {speedKmh.toFixed(1)} <span className="text-sm font-normal text-slate-300">km/h</span>
        </p>
        <p className="text-xs text-slate-400">
          Heading: <span className="font-semibold text-cyan-200">{directionDeg}°</span> SSW · Katabatic Stream
        </p>
      </div>

      {/* Compass dial */}
      <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-slate-800/80 shadow-inner">
        <span className="absolute top-1 text-[9px] font-bold text-slate-400">N</span>
        <span className="absolute bottom-1 text-[9px] font-bold text-slate-400">S</span>
        <span className="absolute left-1 text-[9px] font-bold text-slate-400">W</span>
        <span className="absolute right-1 text-[9px] font-bold text-slate-400">E</span>
        <svg viewBox="0 0 40 40" className="h-10 w-10">
          <g ref={needleRef}>
            <polygon points="20,4 23,20 20,18 17,20" fill="#ef4444" />
            <polygon points="20,36 23,20 20,22 17,20" fill="#94a3b8" />
            <circle cx="20" cy="20" r="2.5" fill="#ffffff" />
          </g>
        </svg>
      </div>
    </div>
  );
}
