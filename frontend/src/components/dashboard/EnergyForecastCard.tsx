import { useMemo } from 'react';
import clsx from 'clsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Brain } from 'lucide-react';
import type {
  EnergyForecast,
  EnergyPredictionPoint,
  MLForecastHorizon,
} from '../../api/types';

interface ChartPoint {
  time: string;
  consumption: number;
  generation: number | null;
}

const round1 = (v: number) => Number(v.toFixed(1));

function normalizeForecast(forecast?: EnergyForecast): ChartPoint[] {
  if (!forecast?.forecast) return [];

  if (Array.isArray(forecast.forecast)) {
    return (forecast.forecast as EnergyPredictionPoint[]).map((p) => ({
      time: new Date(p.timestamp).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      consumption: round1(p.predicted_consumption_kw),
      generation: round1(p.predicted_generation_kw),
    }));
  }

  const record = forecast.forecast as Record<string, MLForecastHorizon>;
  return Object.entries(record)
    .filter(([key]) => key.toLowerCase() !== 'current')
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([horizon, v]) => ({
      time: horizon.toUpperCase(),
      consumption: round1(v.average_consumption_kw),
      generation: null,
    }));
}

export default function EnergyForecastCard({ forecast }: { forecast?: EnergyForecast }) {
  const data = useMemo(() => normalizeForecast(forecast), [forecast]);

  const raw = forecast?.forecast;
  const points = Array.isArray(raw) ? (raw as EnergyPredictionPoint[]) : [];

  const avgBalance =
    points.length > 0 ? points.reduce((s, p) => s + p.predicted_balance_kw, 0) / points.length : null;

  const confidence =
    points.length > 0 ? points.reduce((s, p) => s + (p.confidence ?? 0), 0) / points.length : null;

  const isFallback = forecast?.is_fallback ?? true;

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">
            24h Energy Forecast
          </h2>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            Simulation-driven demand vs generation outlook
          </p>
        </div>
        <span
          className={clsx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1',
            isFallback ? 'bg-amber-50 text-amber-600 ring-amber-200' : 'bg-emerald-50 text-emerald-600 ring-emerald-200'
          )}
        >
          <Brain size={11} />
          {isFallback ? 'Heuristic Model' : forecast?.model_name ?? 'ML Model'}
        </span>
      </div>

      <div className="mt-4 h-[218px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
            Awaiting forecast data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="fcCons" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fcGen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={38} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                formatter={(value, name) => [`${Number(value).toFixed(1)} kW`, String(name)]}
              />
              {data.some((d) => d.generation !== null) && (
                <Area
                  type="monotone"
                  dataKey="generation"
                  name="Generation"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  fill="url(#fcGen)"
                  dot={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="consumption"
                name="Consumption"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#fcCons)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Predicted Load
        </span>
        {data.some((d) => d.generation !== null) && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            Predicted Generation
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          {confidence !== null && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
              {Math.round(confidence)}% CONFIDENCE
            </span>
          )}
          {avgBalance !== null && (
            <span
              className={clsx(
                'text-[11px] font-bold tabular-nums',
                avgBalance >= 0 ? 'text-emerald-600' : 'text-red-500'
              )}
            >
              Avg balance {avgBalance >= 0 ? '+' : ''}
              {avgBalance.toFixed(1)} kW
            </span>
          )}
        </span>
      </div>
    </section>
  );
}
