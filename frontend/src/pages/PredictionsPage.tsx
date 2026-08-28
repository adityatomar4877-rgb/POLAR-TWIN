import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import clsx from 'clsx';
import { TrendingUp, Fuel, Activity, Brain, Clock, ShieldCheck, Zap } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { getEnergyPrediction, getFuelPrediction } from '../api/predictions';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';
import type { MLForecastHorizon } from '../api/types';

export const PredictionsPage = ({ stationId }: { stationId: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: energy } = useQuery({
    queryKey: ['energy-forecast', stationId],
    queryFn: () => getEnergyPrediction(stationId),
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

  // Extract 6h, 12h, 24h predictions safely whether forecast is an object or array
  const isObjectForecast = energy?.forecast && !Array.isArray(energy.forecast);
  const forecastObj = isObjectForecast
    ? (energy?.forecast as Record<string, MLForecastHorizon>)
    : {};

  const pred6h = forecastObj['6h']?.average_consumption_kw;
  const pred12h = forecastObj['12h']?.average_consumption_kw;
  const pred24h = forecastObj['24h']?.average_consumption_kw;

  // Chart data for horizons comparison
  const horizonChartData = [
    {
      horizon: 'Current Load',
      demand: Number((energy?.current_consumption_kw ?? 0).toFixed(1)),
      color: '#64748b',
    },
    {
      horizon: 'Next 6h Avg',
      demand: pred6h != null ? Number(pred6h.toFixed(1)) : 0,
      color: '#3b82f6',
    },
    {
      horizon: 'Next 12h Avg',
      demand: pred12h != null ? Number(pred12h.toFixed(1)) : 0,
      color: '#6366f1',
    },
    {
      horizon: 'Next 24h Avg',
      demand: pred24h != null ? Number(pred24h.toFixed(1)) : 0,
      color: '#8b5cf6',
    },
  ];

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      {/* Header */}
      <div className="gsap-predict-item flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-blue-100 p-2.5 text-blue-600">
            <Brain size={22} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              ML Energy & Logistics Intelligence
            </h1>
            <p className="text-sm text-slate-500">
              Physics-informed Random Forest multi-horizon average demand forecast
            </p>
          </div>
        </div>

        {/* Model Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <ShieldCheck size={14} className="text-emerald-600" />
            {energy?.model_name ?? 'RandomForestEnergyForecast'}
          </span>
          {energy?.feature_count != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
              {energy.feature_count} Features
            </span>
          )}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="gsap-predict-item grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Current Base Load
            </p>
            <Zap size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900">
            <GSAPNumberTicker value={energy?.current_consumption_kw ?? 0} decimals={1} />{' '}
            <span className="text-sm font-semibold text-slate-400">kW</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Live telemetry reading</p>
        </div>

        <div className="group rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
              6h Predicted Avg
            </p>
            <Clock size={16} className="text-blue-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-blue-700">
            <GSAPNumberTicker value={pred6h ?? 0} decimals={1} />{' '}
            <span className="text-sm font-semibold text-blue-400">kW</span>
          </p>
          <p className="mt-1 text-xs text-blue-500">Short-term microgrid dispatch</p>
        </div>

        <div className="group rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
              12h Predicted Avg
            </p>
            <TrendingUp size={16} className="text-indigo-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-indigo-700">
            <GSAPNumberTicker value={pred12h ?? 0} decimals={1} />{' '}
            <span className="text-sm font-semibold text-indigo-400">kW</span>
          </p>
          <p className="mt-1 text-xs text-indigo-500">Mid-horizon operational target</p>
        </div>

        <div className="group rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/60 to-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-600">
              24h Predicted Avg
            </p>
            <Activity size={16} className="text-purple-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-purple-700">
            <GSAPNumberTicker value={pred24h ?? 0} decimals={1} />{' '}
            <span className="text-sm font-semibold text-purple-400">kW</span>
          </p>
          <p className="mt-1 text-xs text-purple-500">Full diurnal cycle planning</p>
        </div>
      </div>

      {/* Horizon Comparison Chart */}
      <div className="gsap-predict-item rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-slate-900">
            <Activity size={16} className="text-blue-500" /> Multi-Horizon Demand Forecast (kW)
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Trained on 168h lags & rolling thermodynamics
          </span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={horizonChartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="horizon" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(value: any) => [`${value} kW`, 'Demand']}
              />
              <Bar dataKey="demand" name="Demand (kW)" radius={[8, 8, 0, 0]} maxBarSize={60}>
                {horizonChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fuel Depletion Section */}
      {fuel && (
        <div className="gsap-predict-item rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-slate-900">
              <Fuel size={16} className="text-orange-500" /> Fuel Logistics & Depletion Trajectory
            </h2>
            <span
              className={clsx(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase',
                fuel.status === 'CRITICAL'
                  ? 'bg-rose-100 text-rose-800'
                  : fuel.status === 'WARNING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
              )}
            >
              {fuel.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Reserves Level
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                <GSAPNumberTicker value={fuel.current_fuel_percentage} decimals={1} suffix="%" />
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Remaining Volume
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                <GSAPNumberTicker value={fuel.current_fuel_liters} decimals={0} suffix=" L" />
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Estimated Daily Burn
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                <GSAPNumberTicker value={fuel.estimated_daily_consumption_liters} decimals={0} suffix=" L/day" />
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Days to Critical (10%)
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                <GSAPNumberTicker value={fuel.days_until_critical} decimals={0} suffix=" Days" />
              </p>
            </div>
          </div>
          {fuel.advisory_notes && (
            <p className="mt-4 rounded-xl bg-blue-50/70 border border-blue-100 px-4 py-3 text-sm text-blue-800 font-medium">
              💡 {fuel.advisory_notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PredictionsPage;
