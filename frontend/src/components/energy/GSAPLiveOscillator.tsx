import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface GSAPLiveOscillatorProps {
  frequency?: number;
  amplitude?: number;
  color?: string;
  className?: string;
  nominalHz?: number;
}

/**
 * High-tech GSAP animated microgrid AC waveform oscillator.
 * Simulates 50.0 Hz electrical grid frequency in real-time.
 */
export default function GSAPLiveOscillator({
  nominalHz = 50.0,
  color = '#06b6d4',
  className = '',
}: GSAPLiveOscillatorProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const phaseRef = useRef({ phase: 0 });

  useEffect(() => {
    const width = 240;
    const height = 40;
    const midY = height / 2;
    const points = 40;

    const tween = gsap.to(phaseRef.current, {
      phase: Math.PI * 2,
      duration: 1.2,
      repeat: -1,
      ease: 'none',
      onUpdate: () => {
        if (!pathRef.current) return;
        const currentPhase = phaseRef.current.phase;
        let d = '';

        for (let i = 0; i <= points; i++) {
          const x = (i / points) * width;
          const y = midY + Math.sin((i / points) * Math.PI * 4 + currentPhase) * 12;
          d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }

        pathRef.current.setAttribute('d', d);
      },
    });

    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-xs ${className}`}>
      <div className="flex flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Microgrid AC Sync</span>
        <span className="font-mono text-xs font-bold text-slate-800">{nominalHz.toFixed(1)} Hz</span>
      </div>
      <div className="relative h-10 w-44 overflow-hidden rounded-lg bg-slate-950 p-1">
        <svg viewBox="0 0 240 40" className="h-full w-full">
          <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 3" />
          <path
            ref={pathRef}
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
