import clsx from 'clsx';
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
}: {
  title: string;
  subtitle: string;
  value: string;
  valueSuffix?: string;
  noteLabel: string;
  tone: 'green' | 'amber' | 'red' | 'blue';
  sparkValues: number[];
  sparkColor: string;
}) {
  const toneCls = {
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-500',
    blue: 'text-blue-600',
  }[tone];

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="truncate text-[13px] font-semibold text-slate-700">{title}</p>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      <p className="mt-2.5">
        <span className={clsx('text-[26px] font-extrabold leading-none', toneCls)}>{value}</span>
        {valueSuffix && <span className="ml-1 text-xs font-medium text-slate-400">{valueSuffix}</span>}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-400">{noteLabel}</p>
      <div className="-mx-1 mt-2">
        <Sparkline values={sparkValues} stroke={sparkColor} height={30} />
      </div>
    </div>
  );
}

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

  const wind = env?.wind_speed_kmh ?? 12;
  const windProb = Math.min(95, Math.round((wind / 55) * 100 + (env?.blizzard_warning ? 40 : 0)));
  const windTone = windProb > 60 ? 'red' : windProb > 35 ? 'amber' : 'green';

  const fuelDays = Math.max(1, Math.round(fuelForecast?.days_until_critical ?? 28));
  const fuelPct = Math.round(fuelForecast?.current_fuel_percentage ?? dashboard.energy?.fuel_percentage ?? 82);

  const gen1Hist = useTelemetryHistory(gen1?.health_score ?? 88);
  const windHist = useTelemetryHistory(wind);
  const fuelHist = useTelemetryHistory(
    energyForecast?.forecast?.length
      ? fuelPct - energyForecast.forecast.length * 0.2
      : fuelPct
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <InsightCard
        title="Generator 1 Failure Risk"
        subtitle={gen1 ? `Health index ${gen1.health_score}%` : 'Predictive model'}
        value={`${Math.round(failureRisk)}%`}
        noteLabel={riskLabel}
        tone={riskTone as 'green' | 'amber' | 'red'}
        sparkValues={gen1Hist}
        sparkColor="#10b981"
      />
      <InsightCard
        title="Weather Alert"
        subtitle={env?.blizzard_warning ? 'Blizzard warning active' : 'High Winds'}
        value={`${windProb}%`}
        noteLabel="Probability"
        tone={windTone as 'green' | 'amber' | 'red'}
        sparkValues={windHist}
        sparkColor="#ef4444"
      />
      <InsightCard
        title="Fuel Depletion"
        subtitle={`In ${fuelDays} Days`}
        value={`${fuelPct}%`}
        noteLabel="Confidence"
        tone="blue"
        sparkValues={fuelHist}
        sparkColor="#3b82f6"
      />
    </div>
  );
}
