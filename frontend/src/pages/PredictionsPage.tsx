import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
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
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';

export const PredictionsPage = ({ stationId }: { stationId: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: energy } = useQuery({
    queryKey: ['energy-forecast', stationId],
    queryFn: () => getEnergyPrediction(stationId, 24),
  });
  const { data: fuel } = useQuery({
    queryKey: ['fuel-forecast', stationId],
    queryFn: () => getFuelPrediction(stationId),
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-predict-item',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

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
    <div ref={containerRef} className="flex flex-col gap-5">
      <div className="gsap-predict-item flex items-center gap-3">
        <span className="rounded-xl bg-blue-100 p-2.5 text-blue-600">
          <TrendingUp size={20} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Predictions & Forecasting</h1>
          <p className="text-sm text-slate-400">
            24-hour predictive energy models and machine learning depletion trajectories {energy?.is_fallback ? '(fallback)' : `· ${energy?.model_name ?? ''}`}
          </p>
        </div>
      </div>

      <div className="gsap-predict-item grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avg Predicted Demand</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            <GSAPNumberTicker value={energy?.average_predicted_consumption_kw ?? 0} decimals={1} suffix=" kW" />
          </p>
        </div>

        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Current Consumption</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            <GSAPNumberTicker value={energy?.current_consumption_kw ?? 0} decimals={1} suffix=" kW" />
          </p>
        </div>

        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fuel Critical In</p>
          <p className={clsx('mt-1 text-2xl font-extrabold', fuel && fuel.days_until_critical < 45 ? 'text-amber-600' : 'text-slate-900')}>
            <GSAPNumberTicker value={fuel?.days_until_critical ?? 0} decimals={0} suffix=" Days" />
          </p>
        </div>
      </div>

      <div className="gsap-predict-item rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
