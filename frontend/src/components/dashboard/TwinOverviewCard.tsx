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

function TwinLabel({
  icon: Icon,
  iconClass,
  title,
  status,
  statusTone = 'ok',
  value,
  className,
  connector = 'below',
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
    <div className={clsx('twin-floating-label pointer-events-none absolute z-10 flex flex-col items-center transition-opacity duration-300', className)}>
      {connector === 'above' && <span className="h-8 border-l-2 border-dashed border-slate-400/60" />}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2.5 shadow-lg backdrop-blur-md transition-transform duration-300">
        <span className={clsx('mt-0.5 rounded-md p-1.5', iconClass)}>
          <Icon size={14} />
        </span>
        <span className="leading-tight">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
          <span
            className={clsx(
              'block text-[12px] font-semibold',
              statusTone === 'ok' ? 'text-emerald-600' : 'text-red-600'
            )}
          >
            {status}
          </span>
          <span className="block text-[11px] text-slate-500">{value}</span>
        </span>
      </div>
      {connector === 'below' && <span className="h-8 border-l-2 border-dashed border-slate-400/60" />}
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
          y: -5,
          duration: 2.2 + (i % 3) * 0.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: i * 0.15,
        });
      });
    }, viewportRef);

    return () => ctx.revert();
  }, [view]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-slate-900">
            Digital Twin Overview
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Real-time interactive 3D telemetry of {dashboard.station?.code?.toUpperCase() ?? 'station'} Station
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Layers"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            <Layers size={16} />
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? 'Collapse' : 'Expand'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as typeof view)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-600 outline-none transition-colors hover:border-slate-300 focus:border-cyan-300"
          >
            <option value="all">View: All Systems</option>
            <option value="power">View: Power Systems</option>
            <option value="habitat">View: Habitat Systems</option>
          </select>
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        className={clsx(
          'relative mt-4 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-[#d8e5f2] via-[#e3edf6] to-[#eef4f9] transition-all duration-500',
          expanded ? 'h-[560px]' : 'h-[400px] lg:h-[440px]'
        )}
      >
        <DigitalTwinScene stationId={selectedStationId} lightMode compact />

        {/* Floating subsystem labels with GSAP micro-bobbing */}
        <TwinLabel
          icon={Zap}
          iconClass="bg-blue-50 text-blue-600"
          title="Power Plant"
          status={powerOnline ? 'Operational' : 'Offline'}
          statusTone={powerOnline ? 'ok' : 'bad'}
          value={
            <>
              <GSAPNumberTicker value={energy?.generation_kw ?? 0} decimals={1} /> kW
            </>
          }
          className="left-[8%] top-[7%] hidden sm:flex"
          connector="below"
          visible={view === 'all' || view === 'power'}
        />
        <TwinLabel
          icon={Home}
          iconClass="bg-emerald-50 text-emerald-600"
          title="Living Modules"
          status="Operational"
          value={`${occupancy}% Capacity`}
          className="right-[6%] top-[10%] hidden md:flex"
          connector="below"
          visible={view === 'all' || view === 'habitat'}
        />
        <TwinLabel
          icon={Fuel}
          iconClass="bg-orange-50 text-orange-600"
          title="Fuel Storage"
          status={`${Math.round(energy?.fuel_percentage ?? 82)}%`}
          value={`${Math.max(1, Math.round(fuelForecast?.days_until_critical ?? 31))} Days Remaining`}
          className="left-[3%] top-[38%] hidden lg:flex"
          connector="none"
          visible={view === 'all' || view === 'power'}
        />
        <TwinLabel
          icon={Building2}
          iconClass="bg-slate-100 text-slate-600"
          title="Main Station"
          status={gridOk ? 'Operational' : 'Emergency'}
          statusTone={gridOk ? 'ok' : 'bad'}
          value={gridOk ? 'All Systems Normal' : 'Energy deficit active'}
          className="bottom-[10%] left-[10%] hidden sm:flex"
          connector="above"
          visible={view === 'all' || view === 'habitat'}
        />
        <TwinLabel
          icon={Droplets}
          iconClass="bg-cyan-50 text-cyan-600"
          title="Water Station"
          status="Operational"
          value="81% Available"
          className="bottom-[6%] left-1/2 hidden -translate-x-1/2 lg:flex"
          connector="above"
          visible={view === 'all' || view === 'habitat'}
        />
        <TwinLabel
          icon={RadioTower}
          iconClass="bg-violet-50 text-violet-600"
          title="Weather Station"
          status="Live Monitoring"
          value={`${(dashboard.environment?.wind_speed_kmh ?? 0).toFixed(1)} km/h winds`}
          className="bottom-[10%] right-[4%] hidden md:flex"
          connector="above"
          visible={view === 'all'}
        />

        {/* Interaction hint */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-4 py-1.5 text-[11px] font-medium text-slate-500 backdrop-blur">
          <Mouse size={12} />
          Drag to rotate
          <span className="text-slate-300">•</span>
          Scroll to zoom
        </div>
      </div>
    </section>
  );
}

