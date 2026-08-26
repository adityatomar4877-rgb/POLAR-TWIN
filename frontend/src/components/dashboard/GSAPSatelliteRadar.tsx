import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Satellite } from 'lucide-react';

interface GSAPSatelliteRadarProps {
  connected?: boolean;
  pingMs?: number;
}

/**
 * GSAP-powered satellite telemetry uplink and radio wave beacon.
 */
export default function GSAPSatelliteRadar({
  connected = true,
  pingMs = 38,
}: GSAPSatelliteRadarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const satRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const rings = containerRef.current.querySelectorAll('.radio-ring');

    const ctx = gsap.context(() => {
      gsap.fromTo(
        rings,
        { scale: 0.2, opacity: 0.9 },
        {
          scale: 1.6,
          opacity: 0,
          duration: 2.2,
          stagger: 0.55,
          repeat: -1,
          ease: 'power1.out',
        }
      );

      if (satRef.current) {
        gsap.to(satRef.current, {
          rotation: 360,
          duration: 16,
          repeat: -1,
          ease: 'none',
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [connected]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0 opacity-20 polar-grid-bg" />

      {/* Orbit ring and rotating satellite */}
      <div
        ref={satRef}
        className="pointer-events-none absolute h-52 w-52 rounded-full border border-dashed border-cyan-400/30"
      >
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-400/20 p-1 text-cyan-300 shadow-md ring-1 ring-cyan-400">
          <Satellite size={14} className="rotate-45" />
        </div>
      </div>

      {/* Center antenna hub with pulsing radio waves */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        {[1, 2, 3].map((ring) => (
          <div
            key={ring}
            className="radio-ring absolute inset-0 rounded-full border-2 border-cyan-400"
          />
        ))}
        <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg ring-4 ring-cyan-400/30">
          <span className="font-mono text-[11px] font-extrabold text-white">
            {connected ? 'UPLINK' : 'SYNC'}
          </span>
        </div>
      </div>

      {/* Status telemetry banner */}
      <div className="relative z-10 mt-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
          Iridium Constellation Orbit 4A
        </p>
        <p className="mt-1 font-mono text-sm text-slate-300">
          Latency: <span className="font-bold text-emerald-400">{pingMs} ms</span> · Signal SNR: +18.4 dB
        </p>
      </div>
    </div>
  );
}
