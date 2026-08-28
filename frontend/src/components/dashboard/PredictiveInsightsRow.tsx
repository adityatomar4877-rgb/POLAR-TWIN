import { useNavigate } from 'react-router-dom';
import type { StationDashboardOut, FuelForecast, EnergyForecast } from '../../api/types';
import GSAPNumberTicker from './GSAPNumberTicker';

import type { MLForecastHorizon } from '../../api/types';

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

  const isObjectForecast = _energyForecast?.forecast && !Array.isArray(_energyForecast.forecast);
  const forecastObj = isObjectForecast
    ? (_energyForecast?.forecast as Record<string, MLForecastHorizon>)
    : {};

  const pred6h = forecastObj['6h']?.average_consumption_kw;
  const pred12h = forecastObj['12h']?.average_consumption_kw;
  const pred24h = forecastObj['24h']?.average_consumption_kw;

  const modelName = _energyForecast?.model_name || 'RandomForestEnergyForecast';

  return (
    <section
      onClick={() => navigate('/predictions')}
      className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
          AVERAGE DEMAND FORECAST
        </h2>
        <span className="text-[9px] font-semibold text-slate-400 opacity-70">
          {modelName}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 divide-x divide-slate-100 flex-1">
        {/* 6H Forecast */}
        <div className="pr-2">
          <p className="text-[10px] font-semibold text-slate-400 truncate">6 H</p>
          {pred6h != null ? (
            <p className="text-2xl font-extrabold text-blue-600 font-mono mt-1">
              <GSAPNumberTicker value={pred6h} decimals={1} />
              <span className="text-[10px] ml-1">kW</span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-400 mt-2">Loading...</p>
          )}
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">AVG DEMAND</p>
        </div>

        {/* 12H Forecast */}
        <div className="px-2">
          <p className="text-[10px] font-semibold text-slate-400 truncate">12 H</p>
          {pred12h != null ? (
            <p className="text-2xl font-extrabold text-indigo-600 font-mono mt-1">
              <GSAPNumberTicker value={pred12h} decimals={1} />
              <span className="text-[10px] ml-1">kW</span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-400 mt-2">Loading...</p>
          )}
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">AVG DEMAND</p>
        </div>

        {/* 24H Forecast */}
        <div className="pl-2">
          <p className="text-[10px] font-semibold text-slate-400 truncate">24 H</p>
          {pred24h != null ? (
            <p className="text-2xl font-extrabold text-purple-600 font-mono mt-1">
              <GSAPNumberTicker value={pred24h} decimals={1} />
              <span className="text-[10px] ml-1">kW</span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-400 mt-2">Loading...</p>
          )}
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">AVG DEMAND</p>
        </div>
      </div>
    </section>
  );
}
