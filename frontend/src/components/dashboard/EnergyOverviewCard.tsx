import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BatteryCharging, Fuel } from 'lucide-react';
import { getFuelPrediction } from '../../api/predictions';
import type { EnergyTelemetry } from '../../api/types';
import { useStation } from '../../context/StationContext';
import GSAPNumberTicker from './GSAPNumberTicker';
import EnergyBalancePieChart from './EnergyBalancePieChart';

const SEGMENT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6'];

export default function EnergyOverviewCard({ energy }: { energy?: EnergyTelemetry }) {
  const navigate = useNavigate();
  const { selectedStationId } = useStation();

  const { data: fuelForecast } = useQuery({
    queryKey: ['fuel-forecast', selectedStationId],
    queryFn: () => getFuelPrediction(selectedStationId),
  });

  const generated = energy?.generation_kw ?? 14.1;
  const consumed = energy?.consumption_kw ?? 11.7;
  const stored = Math.abs(energy?.battery_power_kw ?? 2.4);
  const battery = energy?.battery_percentage ?? 84.7;
  const discharging = (energy?.battery_power_kw ?? -84.9) < 0;
  const fuelPct = energy?.fuel_percentage ?? fuelForecast?.current_fuel_percentage ?? 82;
  const fuelDays = Math.max(1, Math.round(fuelForecast?.days_until_critical ?? 31));

  // Compute energy balance % (or fallback to 84% nominal baseline)
  const balancePercentage = Math.min(100, Math.max(0, Math.round(energy?.battery_percentage ?? 84)));

  const legend = [
    { label: 'Generated', val: generated, color: SEGMENT_COLORS[0] },
    { label: 'Consumed', val: consumed, color: SEGMENT_COLORS[1] },
    { label: 'Stored', val: stored, color: SEGMENT_COLORS[2] },
  ];

  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
          ENERGY OVERVIEW
        </h2>
      </div>

      {/* Recharts Pie / Donut Balance + Legend */}
      <div className="flex items-center justify-between gap-4 py-1">
        <EnergyBalancePieChart
          generated={generated}
          consumed={consumed}
          stored={stored}
          balancePercentage={balancePercentage}
          label="ENERGY BALANCE"
          size={115}
        />

        <div className="flex-1 space-y-2 text-xs">
          {legend.map((l) => (
            <div key={l.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                <span className="text-slate-500 font-medium text-[11px]">{l.label}</span>
              </div>
              <span className="font-mono font-bold text-slate-800 text-[11px]">
                <GSAPNumberTicker value={l.val} decimals={1} suffix=" kW" />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Two mini cards below: Battery Status & Fuel Reserve */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
        {/* Battery Status */}
        <div
          onClick={() => navigate('/energy')}
          className="group cursor-pointer rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-all hover:border-cyan-200 hover:bg-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
              BATTERY STATUS
            </span>
            <BatteryCharging size={14} className="text-emerald-500" />
          </div>
          <p className="text-base font-extrabold text-slate-900 mt-1 font-mono">
            <GSAPNumberTicker value={battery} decimals={1} suffix="%" />
          </p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
            {discharging ? 'Discharging' : 'Charging'}
          </p>
          <p className="text-[10px] font-bold text-slate-600 font-mono">
            -84.9 kW
          </p>
        </div>

        {/* Fuel Reserve */}
        <div
          onClick={() => navigate('/logistics')}
          className="group cursor-pointer rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-all hover:border-orange-200 hover:bg-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
              FUEL RESERVE
            </span>
            <Fuel size={14} className="text-orange-500" />
          </div>
          <p className="text-base font-extrabold text-slate-900 mt-1 font-mono">
            <GSAPNumberTicker value={fuelPct} decimals={0} suffix="%" />
          </p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
            {fuelDays} Days Remaining
          </p>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-700"
              style={{ width: `${Math.min(100, fuelPct)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
