import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Ship, Anchor, Warehouse, MapPin } from 'lucide-react';

interface GSAPShipTransitProps {
  progress?: number;
  origin?: string;
  destination?: string;
}

/**
 * GSAP-powered animated Antarctic maritime convoy transit route.
 */
export default function GSAPShipTransit({
  progress = 68,
  origin = 'Mormugao Port, Goa',
  destination = 'Larsemann Hills Ice Edge',
}: GSAPShipTransitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shipMarkerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shipMarkerRef.current) return;
    gsap.fromTo(
      shipMarkerRef.current,
      { left: '10%' },
      {
        left: `${progress}%`,
        duration: 1.8,
        ease: 'power2.out',
      }
    );
  }, [progress]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Active Maritime Resupply Voyage
          </span>
          <h3 className="text-sm font-bold text-slate-800">
            R/V Bharati Polar Expedition Vessel · Voyage #44
          </h3>
        </div>
        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700 border border-cyan-200">
          TRANSIT {progress}% COMPLETE
        </span>
      </div>

      {/* Interactive Transit Progress Line */}
      <div className="relative my-8 px-4">
        {/* Track Line */}
        <div className="relative h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Origin Stop */}
        <div className="absolute -top-3 left-3 flex flex-col items-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-xs ring-2 ring-white">
            <Anchor size={14} />
          </span>
          <span className="mt-2 text-[10px] font-bold text-slate-600 whitespace-nowrap">{origin}</span>
        </div>

        {/* Moving Ship Beacon */}
        <div
          ref={shipMarkerRef}
          className="absolute -top-4.5 -translate-x-1/2 flex flex-col items-center"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-cyan-300 shadow-md ring-2 ring-cyan-400">
            <Ship size={17} />
          </span>
          <span className="mt-1.5 rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-300 whitespace-nowrap shadow-xs">
            48°12'S · 52.4°E
          </span>
        </div>

        {/* Destination Stop */}
        <div className="absolute -top-3 right-3 flex flex-col items-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-xs ring-2 ring-white">
            <Warehouse size={14} />
          </span>
          <span className="mt-2 text-[10px] font-bold text-slate-600 whitespace-nowrap">{destination}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <MapPin size={13} className="text-slate-400" />
          Distance Traveled: <span className="font-semibold text-slate-700">6,420 / 9,450 km</span>
        </span>
        <span className="font-semibold text-emerald-600">
          Estimated Offload Window: 14 Days
        </span>
      </div>
    </div>
  );
}
