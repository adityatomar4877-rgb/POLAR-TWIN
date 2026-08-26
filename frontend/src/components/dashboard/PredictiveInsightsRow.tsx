import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useTelemetryHistory } from '../../hooks/useTelemetryHistory';
import Sparkline from './Sparkline';
import type { StationDashboardOut, FuelForecast, EnergyForecast } from '../../api/types';

function InsightCard({
  title,
  subtitle,
  value,
  valueSuffix,
  noteLabel,
  tone,
  sparkValues,
  sparkColor,
  chip,
  chipTone = 'slate',
}: {
  title: string;
  subtitle: string;
  value: string;
  valueSuffix?: string;
  noteLabel: string;
  tone: 'green' | 'amber' | 'red' | 'blue';
  sparkValues: number[];
  sparkColor: string;
  chip?: string;
  chipTone?: 'green' | 'amber' | 'red' | 'slate';
}) {
  const navigate = useNavigate();

  const toneCls = {
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-500',
    blue: 'text-blue-600',
  }[tone];

  const chipCls = {
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-500',
  }[chipTone];

  return (
    <motion.button
      type="button"
      onClick={() => navigate('/predictions')}
      title="Open prediction details"
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-700">{title}</p>
          <p className="truncate text-xs text-slate-400">{subtitle}</p>
        </div>
        <ArrowUpRight
          size={14}
          className="shrink-0 text-slate-300 transition-colors group-hover:text-blue-600"
        />
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <p>
          <span className={clsx('text-[26px] font-extrabold leading-none', toneCls)}>{value}</span>
          {valueSuffix && <span className="ml-1 text-xs font-medium text-slate-400">{valueSuffix}</span>}
        </p>
        {chip && (
          <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', chipCls)}>
            {chip}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] font-medium text-slate-400">{noteLabel}</p>
      <div className="-mx-1 mt-2">
        <Sparkline values={sparkValues} stroke={sparkColor} height={30} />
      </div>
    </motion.button>
  );
}

const daysUntil = (iso?: string | null) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

export default function PredictiveInsightsRow({
  dashboard,
  fuelForecast,
  energyForecast,
}: {
  dashboard: StationDashboardOut;
  fuelForecast?: FuelForecast;
  energyForecast?: EnergyForecast;
}) {
  const equipment = dashboard.equipment ?? [];
  const env = dashboard.environment;

  const gen1 = equipment.find((e) => e.name === 'Generator 1');
  const failureRisk = gen1 ? Math.max(2, Math.min(95, 100 - gen1.health_score)) : 12;
  const riskTone = failureRisk < 25 ? 'green' : failureRisk < 60 ? 'amber' : 'red';
  const riskLabel = failureRisk < 25 ? 'Low Risk' : failureRisk < 60 ? 'Medium Risk' : 'High Risk';
  const nextService = daysUntil(gen1?.next_maintenance);
  const nextServiceNote =
    nextService === null
      ? 'Service schedule unavailable'
      : nextService < 0
        ? `Overdue by ${Math.abs(nextService)}d`
        : `Next service in ${nextService}d`;

  const wind = env?.wind_speed_kmh ?? 12;
  const windProb = Math.min(95, Math.round((wind / 55) * 100 + (env?.blizzard_warning ? 40 : 0)));
  const windTone = windProb > 60 ? 'red' : windProb > 35 ? 'amber' : 'green';

  const fuelDays = Math.max(1, Math.round(fuelForecast?.days_until_critical ?? 28));
  const fuelPct = Math.round(fuelForecast?.current_fuel_percentage ?? dashboard.energy?.fuel_percentage ?? 82);
  const criticalDate = fuelForecast?.projected_critical_date
    ? new Date(fuelForecast.projected_critical_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      })
    : null;

  const forecastPoints = Array.isArray(energyForecast?.forecast)
    ? (energyForecast!.forecast as Array<{ confidence?: number }>)
    : [];
  const modelConfidence =
    forecastPoints.length > 0
      ? Math.round(
          forecastPoints.reduce((s, p) => s + (p.confidence ?? 0), 0) / forecastPoints.length
        )
      : null;

  const gen1Hist = useTelemetryHistory(gen1?.health_score ?? 88);
  const windHist = useTelemetryHistory(wind);
  const fuelHist = useTelemetryHistory(fuelPct);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <InsightCard
        title="Generator 1 Failure Risk"
        subtitle={gen1 ? `Health index ${gen1.health_score}%` : 'Predictive model'}
        value={`${Math.round(failureRisk)}%`}
        noteLabel={nextServiceNote}
        tone={riskTone as 'green' | 'amber' | 'red'}
        sparkValues={gen1Hist}
        sparkColor="#10b981"
        chip={riskLabel.toUpperCase()}
        chipTone={riskTone as 'green' | 'amber' | 'red'}
      />
      <InsightCard
        title={env?.blizzard_warning ? 'Blizzard Warning Active' : 'Weather Alert'}
        subtitle={`Sustained winds ${wind.toFixed(1)} km/h`}
        value={`${windProb}%`}
        noteLabel="Disruption probability · next 24h"
        tone={windTone as 'green' | 'amber' | 'red'}
        sparkValues={windHist}
        sparkColor="#ef4444"
        chip={env?.blizzard_warning ? 'BLIZZARD' : undefined}
        chipTone={env?.blizzard_warning ? 'red' : 'slate'}
      />
      <InsightCard
        title="Fuel Depletion Horizon"
        subtitle={`${fuelDays} days until critical threshold`}
        value={`${fuelPct}%`}
        noteLabel={
          fuelForecast?.recommended_resupply
            ? 'Resupply recommended'
            : criticalDate
              ? `Critical on ${criticalDate}`
              : 'Reserve within safe band'
        }
        tone="blue"
        sparkValues={fuelHist}
        sparkColor="#3b82f6"
        chip={modelConfidence !== null ? `${modelConfidence}% CONF` : `${fuelDays}D LEFT`}
        chipTone={fuelDays < 14 ? 'amber' : 'slate'}
      />
    </div>
  );
}
