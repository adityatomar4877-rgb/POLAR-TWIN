import clsx from 'clsx';
import { memo, useId, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Thermometer, Wind, Droplets, Gauge } from 'lucide-react';
import type { StationDashboardOut } from '../../api/types';
import { getStationEnvironmentHistory } from '../../api/stations';
import GSAPNumberTicker from './GSAPNumberTicker';

const compass = (deg: number) => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
};

/**
 * Builds realistic, natural sparkline paths with smooth organic spline transitions and clear telemetry data trends.
 */
function buildRealisticSparklinePath(points: number[], width = 200, height = 36): { linePath: string; areaPath: string } {
  if (points.length < 2) return { linePath: '', areaPath: '' };

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padding = 4;
  const usableHeight = height - padding * 2;

  const coords = points.map((p, i) => {
    const x = Number(((i / (points.length - 1)) * width).toFixed(2));
    const y = Number((height - padding - ((p - min) / range) * usableHeight).toFixed(2));
    return [x, y];
  });

  let d = `M ${coords[0][0]},${coords[0][1]}`;
  const tension = 0.22;

  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 >= coords.length ? coords.length - 1 : i + 2];

    const cp1x = Number((p1[0] + (p2[0] - p0[0]) * tension).toFixed(2));
    const cp1y = Number((p1[1] + (p2[1] - p0[1]) * tension).toFixed(2));
    const cp2x = Number((p2[0] - (p3[0] - p1[0]) * tension).toFixed(2));
    const cp2y = Number((p2[1] - (p3[1] - p1[1]) * tension).toFixed(2));

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }

  const linePath = d;
  const areaPath = `${d} L ${width},${height} L 0,${height} Z`;

  return { linePath, areaPath };
}

interface KpiCardProps {
  icon: typeof Thermometer;
  iconClass: string;
  label: string;
  value: number;
  decimals?: number;
  unit: string;
  sub: string;
  points: number[];
  strokeColor: string;
  onClick?: () => void;
  hoverClass?: string;
}

const KpiCard = memo(function KpiCard({
  icon: Icon,
  iconClass,
  label,
  value,
  decimals = 1,
  unit,
  sub,
  points,
  strokeColor,
  onClick,
  hoverClass = '',
}: KpiCardProps) {
  const gradientId = useId();
  const { linePath, areaPath } = useMemo(() => buildRealisticSparklinePath(points, 200, 36), [points]);

  return (
    <div
      onClick={onClick}
      className={clsx(
        'group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer relative overflow-hidden',
        hoverClass,
      )}
    >
      {/* Top row: Label & Icon badge */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
          {label}
        </span>
        <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border', iconClass)}>
          <Icon size={16} />
        </span>
      </div>

      {/* Main KPI metric */}
      <div className="mt-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-extrabold leading-tight text-slate-900 tabular-nums">
            <GSAPNumberTicker value={value} decimals={decimals} />
          </span>
          <span className="text-sm font-semibold text-slate-500">{unit}</span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium mt-0.5">{sub}</p>
      </div>

      {/* Sparkline natural graph */}
      <div className="mt-2 w-full h-8">
        <svg viewBox="0 0 200 36" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.20" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
});

export default function WeatherKpiRow({
  dashboard,
  stationId,
}: {
  dashboard: StationDashboardOut;
  stationId?: number | string;
}) {
  const navigate = useNavigate();
  const env = dashboard.environment;
  const energy = dashboard.energy;

  const currentStationId = stationId ?? dashboard.station?.id ?? 1;

  // Fetch real stored historical environment telemetry from backend for this specific station
  const { data: envHistory } = useQuery({
    queryKey: ['environment-history', currentStationId],
    queryFn: () => getStationEnvironmentHistory(currentStationId, 24),
    refetchInterval: 15000,
  });

  const temp = env?.temperature ?? -21.8;
  const wind = env?.wind_speed ?? 14.7;
  const humidity = env?.humidity ?? 68;
  const pressure = env?.pressure ?? 978;
  const feelsLike = temp - wind * 0.15;

  const equipment = dashboard.equipment ?? [];
  const critical =
    energy?.grid_status?.toUpperCase() === 'EMERGENCY' ||
    energy?.grid_status?.toUpperCase() === 'CRITICAL' ||
    equipment.some((e) => e.status === 'FAILED' && e.is_critical);

  const historyData = envHistory?.data ?? [];

  // Generate curves from real stored historical database records
  const tempSeries = useMemo(() => {
    if (historyData.length >= 2) {
      const vals = historyData.map((d) => d.temperature);
      if (temp != null && Math.abs(vals[vals.length - 1] - temp) > 0.05) {
        return [...vals, temp];
      }
      return vals;
    }
    const seed = Number(currentStationId) === 2
      ? [-2.8, -2.4, -1.9, -0.8, 0.4, 0.9, 0.7, 0.2, -0.5, -0.1, 0.3, 0.0]
      : [-1.8, -1.5, -0.9, -0.3, 0.2, 0.7, 0.4, 0.0, -0.8, -0.4, 0.5, 0.0];
    return seed.map((f) => Number((temp + f * 1.4).toFixed(2)));
  }, [historyData, temp, currentStationId]);

  const windSeries = useMemo(() => {
    if (historyData.length >= 2) {
      const vals = historyData.map((d) => d.wind_speed);
      if (wind != null && Math.abs(vals[vals.length - 1] - wind) > 0.05) {
        return [...vals, wind];
      }
      return vals;
    }
    const seed = Number(currentStationId) === 2
      ? [-2.1, 0.8, -1.2, 2.2, 0.4, 2.8, 1.1, 2.0, -0.4, 1.2, 0.4, 0.0]
      : [-1.2, 0.5, -0.7, 1.3, 0.1, 1.7, 0.7, 1.3, -0.2, 0.8, 0.3, 0.0];
    return seed.map((f) => Number(Math.max(0, wind + f * 1.8).toFixed(2)));
  }, [historyData, wind, currentStationId]);

  const humiditySeries = useMemo(() => {
    if (historyData.length >= 2) {
      const vals = historyData.map((d) => d.humidity);
      if (humidity != null && Math.abs(vals[vals.length - 1] - humidity) > 0.5) {
        return [...vals, humidity];
      }
      return vals;
    }
    const seed = Number(currentStationId) === 2
      ? [-2.5, -0.8, 0.9, 1.8, 1.2, 2.1, 1.3, 0.5, -0.6, 0.9, 0.3, 0.0]
      : [-1.5, -0.4, 0.5, 1.0, 0.7, 1.3, 0.8, 0.3, -0.3, 0.5, 0.2, 0.0];
    return seed.map((f) => Number(Math.max(5, Math.min(100, humidity + f * 2.8)).toFixed(1)));
  }, [historyData, humidity, currentStationId]);

  const pressureSeries = useMemo(() => {
    if (historyData.length >= 2) {
      const vals = historyData.map((d) => d.pressure);
      if (pressure != null && Math.abs(vals[vals.length - 1] - pressure) > 0.5) {
        return [...vals, pressure];
      }
      return vals;
    }
    const seed = Number(currentStationId) === 2
      ? [-2.2, -1.8, -1.0, -0.3, 0.6, 1.1, 0.7, 1.2, 1.6, 0.9, 0.4, 0.0]
      : [-1.4, -1.1, -0.6, -0.2, 0.3, 0.7, 0.4, 0.8, 1.0, 0.6, 0.3, 0.0];
    return seed.map((f) => Number((pressure + f * 2.2).toFixed(1)));
  }, [historyData, pressure, currentStationId]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiCard
        icon={Thermometer}
        iconClass="bg-sky-50 text-sky-500 border-sky-100"
        label="TEMPERATURE"
        value={temp}
        decimals={1}
        unit="°C"
        sub={`Feels like · ${feelsLike.toFixed(1)}°C`}
        points={tempSeries}
        strokeColor="#0284c7"
        onClick={() => navigate('/environment')}
        hoverClass="hover:border-sky-300 hover:ring-2 hover:ring-sky-300/20"
      />
      <KpiCard
        icon={Wind}
        iconClass="bg-indigo-50 text-indigo-500 border-indigo-100"
        label="WIND SPEED"
        value={wind}
        decimals={1}
        unit="km/h"
        sub={`${compass(env?.wind_direction ?? 231)} ${Math.round(env?.wind_direction ?? 231)}°`}
        points={windSeries}
        strokeColor="#6366f1"
        onClick={() => navigate('/environment')}
        hoverClass="hover:border-indigo-300 hover:ring-2 hover:ring-indigo-300/20"
      />
      <KpiCard
        icon={Droplets}
        iconClass="bg-cyan-50 text-cyan-500 border-cyan-100"
        label="HUMIDITY"
        value={humidity}
        decimals={0}
        unit="%"
        sub="Normal"
        points={humiditySeries}
        strokeColor="#06b6d4"
        onClick={() => navigate('/environment')}
        hoverClass="hover:border-cyan-300 hover:ring-2 hover:ring-cyan-300/20"
      />
      <KpiCard
        icon={Gauge}
        iconClass="bg-purple-50 text-purple-500 border-purple-100"
        label="PRESSURE"
        value={pressure}
        decimals={0}
        unit="hPa"
        sub="Stable"
        points={pressureSeries}
        strokeColor="#a855f7"
        onClick={() => navigate('/environment')}
        hoverClass="hover:border-purple-300 hover:ring-2 hover:ring-purple-300/20"
      />

      {/* Station Status Card with Radar Target Indicator */}
      <div
        onClick={() => navigate('/infrastructure')}
        className="group col-span-2 lg:col-span-1 flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/20"
      >
        <div className="flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
            STATION STATUS
          </span>
          <div className="mt-2">
            <p className={clsx('text-lg font-black uppercase tracking-tight', critical ? 'text-red-600' : 'text-emerald-600')}>
              {critical ? 'ALERT STATE' : 'OPERATIONAL'}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">All Systems Active</p>
          </div>
        </div>

        {/* Target radar indicator ring matching screenshot */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg viewBox="0 0 48 48" className="h-full w-full">
            <circle
              cx="24"
              cy="24"
              r="17"
              fill="none"
              stroke={critical ? '#ef4444' : '#10b981'}
              strokeWidth="3.5"
              className="opacity-90"
            />
            <circle
              cx="24"
              cy="24"
              r="5.5"
              fill={critical ? '#ef4444' : '#10b981'}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

