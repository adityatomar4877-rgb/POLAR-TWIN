import clsx from 'clsx';
import { Thermometer, Wind, Droplets, Gauge } from 'lucide-react';
import type { StationDashboardOut } from '../../api/types';
import { useTelemetryHistory } from '../../hooks/useTelemetryHistory';
import Sparkline from './Sparkline';
import GSAPNumberTicker from './GSAPNumberTicker';

const compass = (deg: number) => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
};

function KpiCard({
  icon: Icon,
  iconClass,
  label,
  numValue,
  decimals = 0,
  unit,
  sub,
  sparkValues,
  sparkColor,
}: {
  icon: typeof Thermometer;
  iconClass: string;
  label: string;
  numValue: number;
  decimals?: number;
  unit: string;
  sub: string;
  sparkValues: number[];
  sparkColor: string;
}) {
  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1.5 text-[22px] font-bold leading-none text-slate-900">
            <GSAPNumberTicker value={numValue} decimals={decimals} />{' '}
            <span className="text-sm font-semibold text-slate-400">{unit}</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">{sub}</p>
        </div>
        <span className={clsx('rounded-lg p-2 transition-transform duration-300 group-hover:scale-110', iconClass)}>
          <Icon size={17} />
        </span>
      </div>
      <div className="-mx-1 mt-3">
        <Sparkline values={sparkValues} stroke={sparkColor} height={34} />
      </div>
    </div>
  );
}

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
          'absolute inset-0 flex items-center justify-center font-bold',
          critical ? 'text-red-500' : 'text-emerald-500'
        )}
      >
        <span className="h-3 w-3 rounded-full bg-current animate-ping opacity-75" />
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
  const feelsLike = temp - wind * 0.15;

  const tempHist = useTelemetryHistory(temp);
  const windHist = useTelemetryHistory(wind);
  const humHist = useTelemetryHistory(humidity);
  const presHist = useTelemetryHistory(pressure);

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
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        icon={Thermometer}
        iconClass="bg-sky-50 text-sky-600"
        label="Temperature"
        numValue={temp}
        decimals={1}
        unit="°C"
        sub={`Feels like · ${feelsLike.toFixed(1)}°C`}
        sparkValues={tempHist}
        sparkColor="#3b82f6"
      />
      <KpiCard
        icon={Wind}
        iconClass="bg-indigo-50 text-indigo-600"
        label="Wind Speed"
        numValue={wind}
        decimals={1}
        unit="km/h"
        sub={`${compass(env?.wind_direction_deg ?? 231)} ${Math.round(env?.wind_direction_deg ?? 231)}°`}
        sparkValues={windHist}
        sparkColor="#6366f1"
      />
      <KpiCard
        icon={Droplets}
        iconClass="bg-cyan-50 text-cyan-600"
        label="Humidity"
        numValue={humidity}
        decimals={0}
        unit="%"
        sub={humidity > 75 ? 'Saturated' : 'Normal'}
        sparkValues={humHist}
        sparkColor="#06b6d4"
      />
      <KpiCard
        icon={Gauge}
        iconClass="bg-violet-50 text-violet-600"
        label="Pressure"
        numValue={pressure}
        decimals={0}
        unit="hPa"
        sub={pressure < 970 ? 'Falling' : 'Stable'}
        sparkValues={presHist}
        sparkColor="#8b5cf6"
      />

      {/* Station status */}
      <div className="group col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md md:col-span-1">
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
            Health: <GSAPNumberTicker value={avgHealth} decimals={0} suffix="%" />
          </p>
        </div>
        <StationStatusRing health={avgHealth} critical={critical} />
      </div>
    </div>
  );
}

