import { useNavigate } from 'react-router-dom';
import { ArrowRight, Radar, Sparkles } from 'lucide-react';
import { useMemo, useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { StationDashboardOut, OperationalRecommendation } from '../../api/types';
import GSAPNumberTicker from './GSAPNumberTicker';

export default function CopilotInsightsCard({
  dashboard,
  recommendations,
}: {
  dashboard: StationDashboardOut;
  recommendations: OperationalRecommendation[] | undefined;
}) {
  const navigate = useNavigate();
  const barsRef = useRef<HTMLDivElement>(null);

  const dataPoints = useMemo(() => {
    const eq = (dashboard.equipment?.length ?? 0) * 9;
    const al = (dashboard.alerts?.length ?? 0) * 4;
    return eq + al + 32 + 24;
  }, [dashboard]);

  const topRec = (recommendations ?? []).find((r) => r.status === 'ACTIVE');
  const priority = topRec?.title ?? 'Microgrid Balance Nominal';

  useEffect(() => {
    if (!barsRef.current) return;
    const bars = barsRef.current.querySelectorAll('.signal-bar');

    const ctx = gsap.context(() => {
      bars.forEach((bar) => {
        gsap.to(bar, {
          scaleY: () => 0.2 + Math.random() * 0.8,
          duration: () => 0.35 + Math.random() * 0.45,
          repeat: -1,
          yoyo: true,
          ease: 'power1.inOut',
        });
      });
    }, barsRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">AI Copilot Insights</h2>
          <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600 border border-violet-200/60">
            <Sparkles size={10} /> POLARIS-4
          </span>
        </div>
        <Radar size={15} className="text-violet-500 animate-pulse" />
      </div>

      <div className="mt-4 flex items-center gap-5">
        {/* Decorative interactive radar */}
        <div className="relative h-[104px] w-[104px] shrink-0">
          <svg viewBox="0 0 104 104" className="h-full w-full">
            {[48, 36, 24, 12].map((r) => (
              <circle key={r} cx="52" cy="52" r={r} fill="none" stroke="#e0e7ff" strokeWidth="1.4" />
            ))}
            <line x1="52" y1="8" x2="52" y2="96" stroke="#e0e7ff" strokeWidth="1.2" />
            <line x1="8" y1="52" x2="96" y2="52" stroke="#e0e7ff" strokeWidth="1.2" />
            <g className="origin-center animate-spin" style={{ animationDuration: '5s' }}>
              <path d="M 52 52 L 52 8 A 44 44 0 0 1 83 21 Z" fill="rgba(99,102,241,0.18)" />
              <line x1="52" y1="52" x2="52" y2="8" stroke="#6366f1" strokeWidth="1.8" />
            </g>
            <circle cx="66" cy="38" r="3.2" fill="#6366f1" />
            <circle cx="40" cy="62" r="2.4" fill="#a5b4fc" />
            <circle cx="60" cy="70" r="2" fill="#c7d2fe" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug text-slate-500">
            <span className="font-semibold text-slate-800">Polaris AI</span> inference stream
          </p>
          <p className="text-[26px] font-extrabold leading-tight text-slate-900">
            <GSAPNumberTicker value={dataPoints} decimals={0} />{' '}
            <span className="text-sm font-semibold text-slate-400">telemetry nodes</span>
          </p>

          {/* GSAP animated live signal frequency bars */}
          <div ref={barsRef} className="my-1.5 flex h-3.5 items-end gap-1">
            {[40, 75, 55, 90, 60, 85, 45, 70, 95, 60, 80, 50].map((h, i) => (
              <span
                key={i}
                className="signal-bar w-1 origin-bottom rounded-full bg-violet-400/80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-ping" /> Top Priority
          </p>
          <p className="truncate text-sm font-bold text-slate-800" title={priority}>
            {priority}
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate('/copilot')}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md"
      >
        <span>Ask Polaris Copilot</span>
        <ArrowRight size={15} />
      </button>
    </section>
  );
}

