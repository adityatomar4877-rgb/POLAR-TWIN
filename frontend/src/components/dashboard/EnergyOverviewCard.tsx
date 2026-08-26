import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { BatteryCharging, Fuel, Zap } from 'lucide-react';
import { getFuelPrediction } from '../../api/predictions';
import type { EnergyTelemetry } from '../../api/types';
import { useStation } from '../../context/StationContext';
import GSAPNumberTicker from './GSAPNumberTicker';
import GSAPEnergyFlow from './GSAPEnergyFlow';

const SEGMENT_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6'];

const Donut = memo(function Donut({
  segments,
  centerVal,
  centerSub,
}: {
  segments: Array<{ value: number; color: string }>;
  centerVal: number;
  centerSub: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;

  // Pure precomputation of arc dash lengths and cumulative offsets
  const arcs = segments.map((seg, i) => {
    const startFrac = segments.slice(0, i).reduce((s, x) => s + Math.max(x.value, 0), 0) / total;
    const frac = Math.max(seg.value, 0) / total;
    return { ...seg, dash: Math.max(frac * c - 2, 0), offset: -startFrac * c };
  });

  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#eef2f7" strokeWidth="13" />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="13"
            strokeLinecap="butt"
            strokeDasharray={`${arc.dash} ${c - arc.dash}`}
            strokeDashoffset={arc.offset}
            className="transition-all duration-700"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-slate-900">
          <GSAPNumberTicker value={centerVal} decimals={0} suffix="%" />
        </span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{centerSub}</span>
      </div>
    </div>
  );
});

export default function EnergyOverviewCard({ energy }: { energy?: EnergyTelemetry }) {
  const { selectedStationId } = useStation();
  const { data: fuelForecast } = useQuery({
    queryKey: ['fuel-forecast', selectedStationId],
    queryFn: () => getFuelPrediction(selectedStationId),
  });

  const generated = energy?.generation_kw ?? 0;
  const consumed = energy?.consumption_kw ?? 0;
  const stored = Math.abs(energy?.battery_power_kw ?? 0);
  const battery = energy?.battery_percentage ?? 0;
  const discharging = (energy?.battery_power_kw ?? 0) < 0;
  const fuelPct = energy?.fuel_percentage ?? fuelForecast?.current_fuel_percentage ?? 0;
  const fuelDays = Math.max(1, Math.round(fuelForecast?.days_until_critical ?? 31));

  const legend = [
    { label: 'Generated', val: generated, color: SEGMENT_COLORS[0] },
    { label: 'Consumed', val: consumed, color: SEGMENT_COLORS[1] },
    { label: 'Stored', val: stored, color: SEGMENT_COLORS[2] },
  ];

  const diesel = Math.max(energy?.diesel_generation_kw ?? 0, 0);
  const solar = Math.max(energy?.solar_generation_kw ?? 0, 0);
  const sourceTotal = generated > 0 ? generated : diesel + solar || 1;
  const sourceMix = [
    { label: 'Diesel', value: diesel, color: 'bg-slate-500' },
    { label: 'Solar PV', value: solar, color: 'bg-amber-400' },
  ];

  return (
    <section className="space-y-4">
      {/* Donut + legend */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">Energy Overview</h2>
          <Zap size={15} className="text-amber-500" />
        </div>
        <div className="mt-4 flex items-center gap-5">
          <Donut
            segments={[
              { value: generated, color: SEGMENT_COLORS[0] },
              { value: consumed, color: SEGMENT_COLORS[1] },
              { value: stored, color: SEGMENT_COLORS[2] },
            ]}
            centerVal={battery}
            centerSub="Battery"
          />
          <div className="flex-1 space-y-2.5">
            {legend.map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                <span className="text-slate-500">{l.label}</span>
                <span className="ml-auto font-semibold tabular-nums text-slate-800">
                  <GSAPNumberTicker value={l.val} decimals={1} suffix=" kW" />
                </span>
              </div>
            ))}
            <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Generation Mix</p>
              {sourceMix.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] text-slate-400">{s.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`block h-full rounded-full ${s.color} transition-all duration-700`}
                      style={{ width: `${Math.min(100, (s.value / sourceTotal) * 100)}%` }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-600">
                    {s.value.toFixed(1)} kW
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic GSAP energy flow bus */}
        <div className="mt-4">
          <GSAPEnergyFlow energy={energy} />
        </div>
      </div>

      {/* Battery + Fuel */}
      <div className="grid grid-cols-2 gap-4">
        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Battery Status</p>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-xl font-extrabold text-slate-900">
                <GSAPNumberTicker value={battery} decimals={1} suffix="%" />
              </p>
              <p className="text-[11px] text-slate-400">{discharging ? 'Discharging' : 'Charging'}</p>
              <p
                className={clsx(
                  'text-xs font-semibold tabular-nums',
                  discharging ? 'text-red-500' : 'text-emerald-600'
                )}
              >
                <GSAPNumberTicker
                  value={energy?.battery_power_kw ?? 0}
                  decimals={1}
                  prefix={discharging ? '' : '+'}
                  suffix=" kW"
                />
              </p>
            </div>
            <span
              className={clsx(
                'rounded-lg p-2.5 transition-transform duration-300 group-hover:scale-110',
                battery < 20 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              )}
            >
              <BatteryCharging size={20} />
            </span>
          </div>
        </div>

        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fuel Reserve</p>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-xl font-extrabold text-slate-900">
                <GSAPNumberTicker value={fuelPct} decimals={0} suffix="%" />
              </p>
              <p className="text-[11px] text-slate-400">
                <GSAPNumberTicker value={fuelDays} decimals={0} suffix=" Days Remaining" />
              </p>
              <div className="mt-1.5 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-700',
                    fuelPct < 25 ? 'bg-red-500' : fuelPct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(100, fuelPct)}%` }}
                />
              </div>
            </div>
            <span className="rounded-lg bg-orange-50 p-2.5 text-orange-600 transition-transform duration-300 group-hover:scale-110">
              <Fuel size={20} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
