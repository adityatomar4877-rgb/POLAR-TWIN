import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import {
  Layers,
  Maximize2,
  Minimize2,
  Zap,
  Fuel,
  Home,
  Building2,
  Droplets,
  RadioTower,
  Mouse,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DigitalTwinScene } from '../3d/DigitalTwinScene';
import { getFuelPrediction } from '../../api/predictions';
import type { StationDashboardOut } from '../../api/types';
import { useStation } from '../../context/StationContext';
import GSAPNumberTicker from './GSAPNumberTicker';

type Health = 'ok' | 'bad';

function FloatingPinCard({
  icon: Icon,
  iconClass,
  title,
  status,
  statusTone = 'ok',
  value,
  className,
  connector = 'none',
  visible = true,
}: {
  icon: typeof Zap;
  iconClass: string;
  title: string;
  status: string;
  statusTone?: Health;
  value: React.ReactNode;
  className: string;
  connector?: 'below' | 'above' | 'none';
  visible?: boolean;
}) {
  if (!visible) return null;

  return (
    <div className={clsx('twin-floating-label pointer-events-none absolute z-20 flex flex-col items-center transition-opacity duration-300', className)}>
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md transition-transform duration-300">
        <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg shadow-2xs', iconClass)}>
          <Icon size={14} />
        </span>
        <div className="leading-tight text-left">
          <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{title}</span>
          <span
            className={clsx(
              'block text-[11px] font-bold',
              statusTone === 'ok' ? 'text-emerald-700' : 'text-red-600'
            )}
          >
            {status}
          </span>
          <span className="block text-[10px] text-slate-500 font-medium">{value}</span>
        </div>
      </div>
      {connector === 'below' && <span className="h-6 w-0.5 border-l border-dashed border-cyan-400/80 shadow-xs" />}
      {connector === 'above' && <span className="h-6 w-0.5 border-l border-dashed border-cyan-400/80 shadow-xs order-first" />}
    </div>
  );
}

export default function TwinOverviewCard({ dashboard }: { dashboard: StationDashboardOut }) {
  const { selectedStationId } = useStation();
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'all' | 'power' | 'habitat'>('all');
  const viewportRef = useRef<HTMLDivElement>(null);

  const { data: fuelForecast } = useQuery({
    queryKey: ['fuel-forecast', selectedStationId],
    queryFn: () => getFuelPrediction(selectedStationId),
  });

  const energy = dashboard.energy;
  const equipment = dashboard.equipment ?? [];
  const gen1 = equipment.find((e) => e.name === 'Generator 1');
  const gen2 = equipment.find((e) => e.name === 'Generator 2');
  const powerOnline =
    gen1?.status === 'RUNNING' || gen2?.status === 'RUNNING' || (energy?.diesel_generation_kw ?? 0) > 0;
  const occupancy =
    dashboard.station?.capacity > 0
      ? Math.round((dashboard.station.current_population / dashboard.station.capacity) * 100)
      : 84;
  const gridOk = !['EMERGENCY', 'CRITICAL', 'DEFICIT'].includes(
    (energy?.grid_status ?? 'NOMINAL').toUpperCase()
  );

  useEffect(() => {
    if (!viewportRef.current) return;
    const labels = viewportRef.current.querySelectorAll('.twin-floating-label');
    if (labels.length === 0) return;

    const ctx = gsap.context(() => {
      labels.forEach((label, i) => {
        gsap.to(label, {
          y: -4,
          duration: 2.4 + (i % 3) * 0.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: i * 0.12,
        });
      });
    }, viewportRef);

    return () => ctx.revert();
  }, [view]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
        <div>
          <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-800">
            STATION DIGITAL TWIN
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400 font-medium">
            Live overview of all station systems
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Layers"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 cursor-pointer"
          >
            <Layers size={14} />
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? 'Collapse' : 'Expand'}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 cursor-pointer"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as typeof view)}
            className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 cursor-pointer shadow-2xs"
          >
            <option value="all">View: All Systems</option>
            <option value="power">View: Power Systems</option>
            <option value="habitat">View: Habitat Systems</option>
          </select>
        </div>
      </div>

      {/* 3D Visual Viewport with station backdrop */}
      <div
        ref={viewportRef}
        className={clsx(
          'twin-viewport relative overflow-hidden rounded-xl border border-slate-200 transition-all duration-500 group',
          expanded ? 'h-[720px]' : 'h-[500px] lg:h-[540px]'
        )}
      >
        {/* Realistic Polar Station Canvas Backdrop */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-[1.01]"
          style={{ backgroundImage: "url('/polar-bg.jpg')" }}
        >
          {/* Subtle cyan wireframe overlay effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent" />
        </div>

        {/* Interactive 3D layer on top */}
        <div className="absolute inset-0 opacity-80 pointer-events-auto">
          <DigitalTwinScene stationId={selectedStationId} lightMode compact />
        </div>

        {/* Pinned Subsystem HUD Badges matching reference design */}
        <FloatingPinCard
          icon={Fuel}
          iconClass="bg-orange-50 text-orange-600 border border-orange-200"
          title="FUEL STORAGE"
          status={`${Math.round(energy?.fuel_percentage ?? 82)}%`}
          value={`${Math.max(1, Math.round(fuelForecast?.days_until_critical ?? 31))} Days Remaining`}
          className="left-[12%] top-[34%] hidden sm:flex"
          connector="none"
          visible={view === 'all' || view === 'power'}
        />

        <FloatingPinCard
          icon={Zap}
          iconClass="bg-blue-50 text-blue-600 border border-blue-200"
          title="POWER PLANT"
          status={powerOnline ? 'Operational' : 'Offline'}
          statusTone={powerOnline ? 'ok' : 'bad'}
          value={
            <>
              <GSAPNumberTicker value={energy?.generation_kw ?? 14.1} decimals={1} /> kW
            </>
          }
          className="left-[34%] top-[14%] hidden sm:flex"
          connector="below"
          visible={view === 'all' || view === 'power'}
        />

        <FloatingPinCard
          icon={Home}
          iconClass="bg-emerald-50 text-emerald-600 border border-emerald-200"
          title="LIVING MODULES"
          status="Operational"
          value={`${occupancy}% Capacity`}
          className="left-[56%] top-[18%] hidden md:flex"
          connector="below"
          visible={view === 'all' || view === 'habitat'}
        />

        <FloatingPinCard
          icon={Building2}
          iconClass="bg-blue-50 text-blue-600 border border-blue-200"
          title="MAIN STATION"
          status={gridOk ? 'Operational' : 'Emergency'}
          statusTone={gridOk ? 'ok' : 'bad'}
          value={gridOk ? 'All Systems Normal' : 'Energy Deficit'}
          className="left-[16%] bottom-[12%] hidden sm:flex"
          connector="above"
          visible={view === 'all' || view === 'habitat'}
        />

        <FloatingPinCard
          icon={Droplets}
          iconClass="bg-cyan-50 text-cyan-600 border border-cyan-200"
          title="WATER STATION"
          status="Operational"
          value="81% Available"
          className="left-[42%] bottom-[10%] hidden lg:flex"
          connector="above"
          visible={view === 'all' || view === 'habitat'}
        />

        <FloatingPinCard
          icon={RadioTower}
          iconClass="bg-purple-50 text-purple-600 border border-purple-200"
          title="WEATHER STATION"
          status="Operational"
          value="Live Monitoring"
          className="left-[64%] bottom-[12%] hidden md:flex"
          connector="above"
          visible={view === 'all'}
        />

        {/* Interaction hint pill */}
        <div className="pointer-events-none absolute bottom-3.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-4 py-1 text-[11px] font-medium text-slate-600 shadow-md backdrop-blur">
          <Mouse size={12} className="text-slate-400" />
          <span>Drag to rotate</span>
          <span className="text-slate-300">•</span>
          <span>Scroll to zoom</span>
        </div>
      </div>
    </section>
  );
}
