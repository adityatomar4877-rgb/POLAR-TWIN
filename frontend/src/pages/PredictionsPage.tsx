import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { TrendingUp, Fuel, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getEnergyPrediction, getFuelPrediction } from '../api/predictions';

export const PredictionsPage = ({ stationId }: { stationId: number }) => {
  const { data: energy } = useQuery({
    queryKey: ['energy-forecast', stationId],
    queryFn: () => getEnergyPrediction(stationId, 24),
  });
  const { data: fuel } = useQuery({
    queryKey: ['fuel-forecast', stationId],
    queryFn: () => getFuelPrediction(stationId),
  });

  const chartData = (energy?.forecast ?? []).map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    consumption: Number((p.predicted_consumption_kw ?? 0).toFixed(1)),
    generation: Number((p.predicted_generation_kw ?? 0).toFixed(1)),
    balance: Number((p.predicted_balance_kw ?? 0).toFixed(1)),
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-blue-100 p-2.5 text-blue-600">
          <TrendingUp size={20} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Predictions</h1>
          <p className="text-sm text-slate-400">
            24-hour energy forecast {energy?.is_fallback ? '(fallback model)' : `· ${energy?.model_name ?? ''}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Avg Predicted Demand',
            value: `${energy?.average_predicted_consumption_kw != null ? energy.average_predicted_consumption_kw.toFixed(1) : '—'} kW`,
            tone: 'text-slate-900',
          },
          {
            label: 'Current Consumption',
            value: `${energy?.current_consumption_kw != null ? energy.current_consumption_kw.toFixed(1) : '—'} kW`,
            tone: 'text-slate-900',
          },
          {
            label: 'Fuel Critical In',
            value: fuel ? `${Math.round(fuel.days_until_critical)} days` : '—',
            tone: fuel && fuel.days_until_critical < 45 ? 'text-amber-600' : 'text-slate-900',
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className={clsx('mt-1 text-2xl font-extrabold', s.tone)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-slate-900">
          <Activity size={14} className="text-blue-500" /> Energy Balance Forecast (kW)
        </h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="generation" name="Generation" stroke="#14b8a6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="consumption" name="Consumption" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="balance" name="Balance" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {fuel && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-slate-900">
            <Fuel size={14} className="text-orange-500" /> Fuel Depletion Forecast
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ['Reserves', `${fuel.current_fuel_percentage.toFixed(1)}%`],
              ['Volume', `${Math.round(fuel.current_fuel_liters).toLocaleString()} L`],
              ['Daily Burn', `${fuel.estimated_daily_consumption_liters.toFixed(0)} L/day`],
              ['Critical Date', fuel.projected_critical_date ? new Date(fuel.projected_critical_date).toLocaleDateString('en-IN') : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{fuel.advisory_notes}</p>
        </div>
      )}
    </div>
  );
};

export default PredictionsPage;
