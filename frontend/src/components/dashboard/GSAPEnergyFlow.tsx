import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Sun, Wind, Flame, Battery, Cpu, Home } from 'lucide-react';
import type { EnergyTelemetry } from '../../api/types';
import GSAPNumberTicker from './GSAPNumberTicker';

export default function GSAPEnergyFlow({ energy }: { energy?: EnergyTelemetry }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const genKw = energy?.diesel_generation_kw ?? (energy?.generation_kw ? energy.generation_kw * 0.6 : 24.5);
  const solarKw = energy?.solar_generation_kw ?? (energy?.generation_kw ? energy.generation_kw * 0.25 : 8.2);
  const windKw =
    energy?.generation_kw !== undefined
      ? Math.max(0, energy.generation_kw - (energy.diesel_generation_kw ?? 0) - (energy.solar_generation_kw ?? 0))
      : 4.1;
  const totalGen = energy?.generation_kw ?? 36.8;
  const loadKw = energy?.consumption_kw ?? 29.4;
  const battKw = energy?.battery_power_kw ?? 4.2;

  useEffect(() => {
    if (!containerRef.current) return;
    const paths = containerRef.current.querySelectorAll('.flow-path');

    paths.forEach((p) => {
      gsap.to(p, {
        strokeDashoffset: -40,
        duration: 1.8,
        repeat: -1,
        ease: 'none',
      });
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Live Energy Dispatch Bus
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          SYNCHRONIZED
        </span>
      </div>

      {/* SVG Energy Flow lines */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {/* Source: Solar */}
        <div className="flex flex-col items-center rounded-lg bg-white p-2 shadow-xs border border-slate-100">
          <Sun size={15} className="text-amber-500" />
          <span className="mt-1 text-[10px] font-semibold text-slate-400">Solar</span>
          <span className="text-xs font-bold text-slate-800">
            <GSAPNumberTicker value={solarKw} decimals={1} suffix=" kW" />
          </span>
        </div>

        {/* Source: Wind */}
        <div className="flex flex-col items-center rounded-lg bg-white p-2 shadow-xs border border-slate-100">
          <Wind size={15} className="text-cyan-500" />
          <span className="mt-1 text-[10px] font-semibold text-slate-400">Wind</span>
          <span className="text-xs font-bold text-slate-800">
            <GSAPNumberTicker value={windKw} decimals={1} suffix=" kW" />
          </span>
        </div>

        {/* Source: Diesel Gen */}
        <div className="flex flex-col items-center rounded-lg bg-white p-2 shadow-xs border border-slate-100">
          <Flame size={15} className="text-orange-500" />
          <span className="mt-1 text-[10px] font-semibold text-slate-400">Diesel</span>
          <span className="text-xs font-bold text-slate-800">
            <GSAPNumberTicker value={genKw} decimals={1} suffix=" kW" />
          </span>
        </div>
      </div>

      {/* Center Bus */}
      <div className="relative my-3 flex items-center justify-between rounded-lg bg-slate-900 px-3.5 py-2 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-cyan-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Main Microgrid Bus</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-mono font-bold text-cyan-300">
          <GSAPNumberTicker value={totalGen} decimals={1} suffix=" kW Total" />
        </div>
      </div>

      {/* Downstream: Battery Storage + Habitat Consumption */}
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="flex items-center justify-between rounded-lg bg-white p-2 shadow-xs border border-slate-100">
          <div className="flex items-center gap-2">
            <Battery size={15} className="text-emerald-500" />
            <span className="text-[11px] font-semibold text-slate-600">Storage</span>
          </div>
          <span className="text-xs font-bold text-emerald-600">
            <GSAPNumberTicker value={battKw} decimals={1} prefix={battKw >= 0 ? '+' : ''} suffix=" kW" />
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white p-2 shadow-xs border border-slate-100">
          <div className="flex items-center gap-2">
            <Home size={15} className="text-blue-500" />
            <span className="text-[11px] font-semibold text-slate-600">Load</span>
          </div>
          <span className="text-xs font-bold text-blue-600">
            <GSAPNumberTicker value={loadKw} decimals={1} suffix=" kW" />
          </span>
        </div>
      </div>
    </div>
  );
}
