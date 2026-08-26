import clsx from 'clsx';
import { memo } from 'react';
import { Thermometer, Wind, Droplets, Gauge, Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StationDashboardOut } from '../../api/types';
import { useTelemetryHistory } from '../../hooks/useTelemetryHistory';
import Sparkline from './Sparkline';
import GsapNumber from '../motion/GsapNumber';

const compass = (deg: number) => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
};

const TrendChip = memo(function TrendChip({ delta, decimals = 1, warnOnRise = false, dangerBelow = null }: {
  delta: number | null;
  decimals?: number;
  warnOnRise?: boolean;
  dangerBelow?: number | null;
}) {
  if (delta === null || Math.abs(delta) < Math.pow(10, -decimals) / 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-400">
        <Minus size={10} />
        STEADY
      </span>
    );
  }
  const rising = delta > 0;
  const danger = dangerBelow !== null && !rising && delta < 0;
  const warn = warnOnRise && rising;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
        danger ? 'bg-red-50 text-red-600' : warn ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
      )}
    >
      {rising ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {rising ? '+' : ''}
      {delta.toFixed(decimals)}
    </span>
  );
});

const KpiCard = memo(function KpiCard({
  icon: Icon,
  iconClass,
  label,
  value,
  decimals = 1,
  unit,
  sub,
  sparkValues,
  sparkColor,
  trend,
  trendDecimals,
  warnOnRise,
  dangerBelow,
}: {
  icon: typeof Thermometer;
  iconClass: string;
  label: string;
  value: number;
  decimals?: number;
  unit: string;
  sub: string;
  sparkValues: number[];
  sparkColor: string;
  trend?: number | null;
  trendDecimals?: number;
  warnOnRise?: boolean;
  dangerBelow?: number | null;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1.5 text-[22px] font-bold leading-none text-slate-900">
            <GsapNumber value={value} decimals={decimals} />{' '}
            <span className="text-sm font-semibold text-slate-400">{unit}</span>
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">{sub}</p>
        </div>
        <span className={clsx('shrink-0 rounded-lg p-2', iconClass)}>
          <Icon size={17} />
        </span>
      </div>
      {trend !== undefined && (
        <div className="-mb-1 mt-2">
          <TrendChip delta={trend} decimals={trendDecimals} warnOnRise={warnOnRise} dangerBelow={dangerBelow} />
        </div>
      )}
      <div className="-mx-1 mt-3">
        <Sparkline values={sparkValues} stroke={sparkColor} height={34} />
      </div>
    </div>
  );
});

/** Health ring for the STATION STATUS card */
function StationStatusRing({ health, critical }: { health: number; critical: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, health));
  return (
    <div className="relative h-[76px] w-[76px]">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={critical ? '#ef4444' : '#10b981'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          className="transition-all duration-700"
        />
      </svg>
      <span
        className={clsx(
          'absolute inset-0 flex flex-col items-center justify-center font-bold',
          critical ? 'text-red-500' : 'text-emerald-500'
        )}
      >
        <span className="text-[13px] leading-none">{Math.round(pct)}</span>
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-400">Health</span>
      </span>
    </div>
  );
}

export default function WeatherKpiRow({ dashboard }: { dashboard: StationDashboardOut }) {
  const env = dashboard.environment;
  const energy = dashboard.energy;

  const temp = env?.temperature_c ?? -21.8;
  const wind = env?.wind_speed_kmh ?? 14.7;
  const humidity = env?.humidity_percent ?? 68;
  const pressure = env?.pressure_hpa ?? 978;
  const visibility = env?.visibility_km ?? 9.4;
  const feelsLike = temp - wind * 0.15;

  const tempHist = useTelemetryHistory(temp);
  const windHist = useTelemetryHistory(wind);
  const humHist = useTelemetryHistory(humidity);
  const presHist = useTelemetryHistory(pressure);
  const visHist = useTelemetryHistory(visibility);

  const deltaOf = (hist: number[], decimals: number) => {
    if (hist.length < 3) return null;
    const d = hist[hist.length - 1] - hist[hist.length - 2];
    return Math.abs(d) < Math.pow(10, -decimals) / 2 ? 0 : d;
  };

  const equipment = dashboard.equipment ?? [];
  const avgHealth =
    equipment.length > 0
      ? equipment.reduce((s, e) => s + (e.health_score ?? 0), 0) / equipment.length
      : 92;
  const critical =
    energy?.grid_status?.toUpperCase() === 'EMERGENCY' ||
    energy?.grid_status?.toUpperCase() === 'CRITICAL' ||
    equipment.some((e) => e.status === 'FAILED' && e.is_critical);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
      <KpiCard
        icon={Thermometer}
        iconClass="bg-sky-50 text-sky-600"
        label="Temperature"
        value={temp}
        decimals={1}
        unit="°C"
        sub={`Feels like · ${feelsLike.toFixed(1)}°C`}
        sparkValues={tempHist}
        sparkColor="#3b82f6"
        trend={deltaOf(tempHist, 1)}
        trendDecimals={1}
      />
      <KpiCard
        icon={Wind}
        iconClass="bg-indigo-50 text-indigo-600"
        label="Wind Speed"
        value={wind}
        decimals={1}
        unit="km/h"
        sub={`${compass(env?.wind_direction_deg ?? 231)} ${Math.round(env?.wind_direction_deg ?? 231)}°`}
        sparkValues={windHist}
        sparkColor="#6366f1"
        trend={deltaOf(windHist, 1)}
        trendDecimals={1}
        warnOnRise
      />
      <KpiCard
        icon={Droplets}
        iconClass="bg-cyan-50 text-cyan-600"
        label="Humidity"
        value={humidity}
        decimals={0}
        unit="%"
        sub={humidity > 75 ? 'Saturated' : 'Normal'}
        sparkValues={humHist}
        sparkColor="#06b6d4"
        trend={deltaOf(humHist, 0)}
        trendDecimals={0}
      />
      <KpiCard
        icon={Gauge}
        iconClass="bg-violet-50 text-violet-600"
        label="Pressure"
        value={pressure}
        decimals={0}
        unit="hPa"
        sub={pressure < 970 ? 'Falling' : 'Stable'}
        sparkValues={presHist}
        sparkColor="#8b5cf6"
        trend={deltaOf(presHist, 0)}
        trendDecimals={0}
      />
      <KpiCard
        icon={Eye}
        iconClass="bg-teal-50 text-teal-600"
        label="Visibility"
        value={visibility}
        decimals={1}
        unit="km"
        sub={visibility < 1 ? 'Whiteout risk' : visibility < 4 ? 'Reduced' : 'Clear'}
        sparkValues={visHist}
        sparkColor="#14b8a6"
        trend={deltaOf(visHist, 1)}
        trendDecimals={1}
      />

      {/* Station status */}
      <div className="col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 md:col-span-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Station Status</p>
          <p
            className={clsx(
              'mt-2 text-lg font-extrabold uppercase leading-none',
              critical ? 'text-red-500' : 'text-emerald-500'
            )}
          >
            {critical ? 'Alert State' : 'Operational'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {critical ? 'Immediate action required' : 'All Systems Active'}
          </p>
        </div>
        <StationStatusRing health={avgHealth} critical={critical} />
      </div>
    </div>
  );
}
