import { useNavigate } from 'react-router-dom';
import type { StationDashboardOut, FuelForecast, EnergyForecast } from '../../api/types';
import GSAPNumberTicker from './GSAPNumberTicker';

export default function PredictiveInsightsRow({
  dashboard: _dashboard,
  fuelForecast: _fuelForecast,
  energyForecast: _energyForecast,
}: {
  dashboard: StationDashboardOut;
  fuelForecast?: FuelForecast;
  energyForecast?: EnergyForecast;
}) {
  const navigate = useNavigate();

  return (
    <section
      onClick={() => navigate('/predictions')}
      className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:shadow-md"
    >
      <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-3">
        PREDICTIVE INSIGHTS
      </h2>

      <div className="grid grid-cols-3 gap-3 divide-x divide-slate-100">
        {/* Generator 1 Failure Risk */}
        <div className="pr-2">
          <p className="text-[10px] font-semibold text-slate-400 truncate">Generator 1 Failure Risk</p>
          <p className="text-2xl font-extrabold text-emerald-600 font-mono mt-1">
            <GSAPNumberTicker value={12} decimals={0} suffix="%" />
          </p>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Low Risk</p>
        </div>

        {/* Weather Alert — uses red badge like screenshot */}
        <div className="px-2">
          <div className="inline-block rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white mb-0.5">
            Weather Alert
          </div>
          <p className="text-[10px] font-semibold text-slate-400">High Winds</p>
          <p className="text-2xl font-extrabold text-red-500 font-mono mt-0.5">
            <GSAPNumberTicker value={80} decimals={0} suffix="%" />
          </p>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Probability</p>
        </div>

        {/* Fuel Depletion */}
        <div className="pl-2">
          <p className="text-[10px] font-semibold text-slate-400 truncate">Fuel Depletion</p>
          <p className="text-[10px] font-semibold text-slate-400">In 28 Days</p>
          <p className="text-2xl font-extrabold text-blue-600 font-mono mt-0.5">
            <GSAPNumberTicker value={82} decimals={0} suffix="%" />
          </p>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Confidence</p>
        </div>
      </div>
    </section>
  );
}
