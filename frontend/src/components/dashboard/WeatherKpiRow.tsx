import clsx from 'clsx';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Thermometer, Wind, Droplets, Gauge } from 'lucide-react';
import type { StationDashboardOut } from '../../api/types';
import GSAPNumberTicker from './GSAPNumberTicker';

const compass = (deg: number) => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
};

const KpiCard = memo(function KpiCard({
  icon: Icon,
  iconClass,
  label,
  value,
  decimals = 1,
  unit,
  sub,
  onClick,
}: {
  icon: typeof Thermometer;
  iconClass: string;
  label: string;
  value: number;
  decimals?: number;
  unit: string;
  sub: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
    >
      <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconClass)}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="text-lg font-extrabold leading-tight text-slate-900 tabular-nums">
          <GSAPNumberTicker value={value} decimals={decimals} />
          <span className="text-sm font-semibold text-slate-400 ml-0.5">{unit}</span>
        </p>
        <p className="text-[11px] text-slate-400 font-medium truncate">{sub}</p>
      </div>
    </div>
  );
});

/** Health ring for STATION STATUS */
function StationStatusRing({ health, critical }: { health: number; critical: boolean }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, health));
  return (
    <div className="relative h-[60px] w-[60px] shrink-0">
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={critical ? '#ef4444' : '#10b981'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          className="transition-all duration-700"
        />
      </svg>
    </div>
  );
}

export default function WeatherKpiRow({ dashboard }: { dashboard: StationDashboardOut }) {
  const navigate = useNavigate();
  const env = dashboard.environment;
  const energy = dashboard.energy;

  const temp = env?.temperature ?? -21.8;
  const wind = env?.wind_speed ?? 14.7;
  const humidity = env?.humidity ?? 68;
  const pressure = env?.pressure ?? 978;
  const feelsLike = temp - wind * 0.15;

  const equipment = dashboard.equipment ?? [];
  const avgHealth =
    equipment.length > 0
      ? equipment.reduce((s, e) => s + (e.health_score ?? 0), 0) / equipment.length
      : 84;
  const critical =
    energy?.grid_status?.toUpperCase() === 'EMERGENCY' ||
    energy?.grid_status?.toUpperCase() === 'CRITICAL' ||
    equipment.some((e) => e.status === 'FAILED' && e.is_critical);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiCard
        icon={Thermometer}
        iconClass="bg-blue-50 text-blue-500"
        label="TEMPERATURE"
        value={temp}
        decimals={1}
        unit="°C"
        sub={`Feels like ${feelsLike.toFixed(1)}°C`}
        onClick={() => navigate('/environment')}
      />
      <KpiCard
        icon={Wind}
        iconClass="bg-blue-50 text-blue-500"
        label="WIND SPEED"
        value={wind}
        decimals={1}
        unit="km/h"
        sub={`${compass(env?.wind_direction ?? 231)} ${Math.round(env?.wind_direction ?? 231)}°`}
        onClick={() => navigate('/environment')}
      />
      <KpiCard
        icon={Droplets}
        iconClass="bg-green-50 text-green-500"
        label="HUMIDITY"
        value={humidity}
        decimals={0}
        unit="%"
        sub="Normal"
        onClick={() => navigate('/environment')}
      />
      <KpiCard
        icon={Gauge}
        iconClass="bg-slate-100 text-slate-500"
        label="PRESSURE"
        value={pressure}
        decimals={0}
        unit="hPa"
        sub="Stable"
        onClick={() => navigate('/environment')}
      />

      {/* Station Status */}
      <div
        onClick={() => navigate('/infrastructure')}
        className="group col-span-2 lg:col-span-1 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
      >
        <StationStatusRing health={avgHealth} critical={critical} />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            STATION STATUS
          </p>
          <p className={clsx('text-sm font-extrabold uppercase', critical ? 'text-red-600' : 'text-emerald-600')}>
            {critical ? 'ALERT STATE' : 'OPERATIONAL'}
          </p>
          <p className="text-[11px] text-slate-400 font-medium">All Systems Active</p>
        </div>
      </div>
    </div>
  );
}
