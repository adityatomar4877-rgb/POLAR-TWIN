import { useNavigate } from 'react-router-dom';
import { ArrowRight, Radar } from 'lucide-react';
import { useMemo } from 'react';
import type { StationDashboardOut, OperationalRecommendation } from '../../api/types';

export default function CopilotInsightsCard({
  dashboard,
  recommendations,
}: {
  dashboard: StationDashboardOut;
  recommendations: OperationalRecommendation[] | undefined;
}) {
  const navigate = useNavigate();

  const dataPoints = useMemo(() => {
    const eq = (dashboard.equipment?.length ?? 0) * 9;
    const al = (dashboard.alerts?.length ?? 0) * 4;
    return eq + al + 32 + 24;
  }, [dashboard]);

  const topRec = (recommendations ?? []).find((r) => r.status === 'ACTIVE');
  const priority = topRec?.title ?? 'Energy Deficit';

  return (
    <section className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">AI Copilot Insights</h2>
        <Radar size={15} className="text-violet-500" />
      </div>

      <div className="mt-4 flex items-center gap-5">
        {/* Decorative radar */}
        <div className="relative h-[104px] w-[104px] shrink-0">
          <svg viewBox="0 0 104 104" className="h-full w-full">
            {[48, 36, 24, 12].map((r) => (
              <circle key={r} cx="52" cy="52" r={r} fill="none" stroke="#e0e7ff" strokeWidth="1.4" />
            ))}
            <line x1="52" y1="8" x2="52" y2="96" stroke="#e0e7ff" strokeWidth="1.2" />
            <line x1="8" y1="52" x2="96" y2="52" stroke="#e0e7ff" strokeWidth="1.2" />
            <g className="origin-center animate-spin" style={{ animationDuration: '6s' }}>
              <path d="M 52 52 L 52 8 A 44 44 0 0 1 83 21 Z" fill="rgba(99,102,241,0.14)" />
              <line x1="52" y1="52" x2="52" y2="8" stroke="#6366f1" strokeWidth="1.6" />
            </g>
            <circle cx="66" cy="38" r="3.2" fill="#6366f1" />
            <circle cx="40" cy="62" r="2.4" fill="#a5b4fc" />
            <circle cx="60" cy="70" r="2" fill="#c7d2fe" />
          </svg>
        </div>

        <div className="min-w-0">
          <p className="text-[13px] leading-snug text-slate-500">
            <span className="font-semibold text-slate-800">Polaris AI</span> has analyzed
          </p>
          <p className="text-[26px] font-extrabold leading-tight text-slate-900">
            {dataPoints} <span className="text-sm font-semibold text-slate-400">data points</span>
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Top Priority
          </p>
          <p className="truncate text-sm font-bold text-slate-800" title={priority}>
            {priority}
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate('/copilot')}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
      >
        Ask Polaris
        <ArrowRight size={15} />
      </button>
    </section>
  );
}
