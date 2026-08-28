import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { StationDashboardOut, OperationalRecommendation } from '../../api/types';
import GSAPNumberTicker from './GSAPNumberTicker';

export default function CopilotInsightsCard({
  dashboard: _dashboard,
  recommendations: _recommendations,
}: {
  dashboard: StationDashboardOut;
  recommendations: OperationalRecommendation[] | undefined;
}) {
  const navigate = useNavigate();

  const activeRecs = _recommendations?.filter((r) => r.status !== 'EXECUTED' && r.status !== 'DISMISSED') || [];
  const topRec = activeRecs.length > 0 ? activeRecs[0] : null;

  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between">
      <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-3">
        AI COPILOT INSIGHTS
      </h2>

      <div className="flex items-center gap-3 flex-1">
        {/* Radar scanning graphic */}
        <div className="relative h-[68px] w-[68px] shrink-0">
          <svg viewBox="0 0 80 80" className="h-full w-full">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            <circle cx="40" cy="40" r="26" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            <circle cx="40" cy="40" r="16" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            <circle cx="40" cy="40" r="4" fill="#3b82f6" />
            <line x1="40" y1="4" x2="40" y2="76" stroke="#e2e8f0" strokeWidth="1" />
            <line x1="4" y1="40" x2="76" y2="40" stroke="#e2e8f0" strokeWidth="1" />
            <g className="origin-center animate-spin" style={{ animationDuration: '4s' }}>
              <path d="M 40 40 L 40 4 A 36 36 0 0 1 65 14 Z" fill="rgba(59,130,246,0.15)" />
              <line x1="40" y1="40" x2="40" y2="4" stroke="#3b82f6" strokeWidth="1.5" />
            </g>
          </svg>
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-400 font-medium">Active Recommendations</p>
          <p className="text-xl font-black text-slate-900 font-mono leading-tight my-0.5">
            <GSAPNumberTicker value={activeRecs.length} decimals={0} />
            <span className="text-[11px] font-semibold text-slate-400 ml-1">insights</span>
          </p>
          {topRec ? (
            <>
              <p className="text-[11px] text-slate-400 font-medium mt-1">• Top Priority</p>
              <p className="text-xs font-extrabold text-slate-800 truncate">{topRec.title}</p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-slate-400 font-medium mt-1">• Status</p>
              <p className="text-xs font-extrabold text-slate-800">System Nominal</p>
            </>
          )}
        </div>

        {/* Ask Polaris — red/coral pill matching screenshot */}
        <button
          onClick={() => navigate('/copilot')}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-rose-600 cursor-pointer"
        >
          Ask Polaris <ArrowRight size={12} />
        </button>
      </div>
    </section>
  );
}
