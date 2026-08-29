import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { FlaskConical, RefreshCw, Cpu } from 'lucide-react';
import { getSimulationStatus, resetSimulation } from '../api/simulation';
import ScenarioRunner from '../components/simulation/ScenarioRunner';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';

export const SimulationPage = ({ stationId }: { stationId: number }) => {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({
    queryKey: ['simulation-status'],
    queryFn: () => getSimulationStatus(),
    refetchInterval: 15000,
  });

  const reset = useMutation({
    mutationFn: () => resetSimulation(),
    onSuccess: () =>
      ['simulation-status', 'dashboard', 'equipment', 'alerts'].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] })
      ),
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-sim-item',
        { y: 24, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.08,
          ease: 'power3.out',
          clearProps: 'scale',
        }
      );

      if (gearRef.current) {
        gsap.to(gearRef.current, {
          rotation: 360,
          duration: 12,
          repeat: -1,
          ease: 'none',
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const activeScenarios = Object.entries(status?.active_scenarios ?? {});

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-5 rounded-3xl border border-indigo-900/30 bg-slate-950/40 p-4 shadow-inner"
      style={{
        backgroundImage:
          'linear-gradient(rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <div className="gsap-sim-item flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 text-white shadow-[0_0_18px_rgba(99,102,241,0.45)]">
            <FlaskConical size={20} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-100">What-If Scenario Simulation</h1>
            <p className="text-sm text-slate-400">
              Inject operational stress tests, polar storm conditions, and generator faults in real time.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeScenarios.map(([name, until]) => (
            <span
              key={name}
              className="rounded-full bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-300 animate-pulse border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
              title={until ? `Active until ${new Date(until).toLocaleTimeString()}` : undefined}
            >
              {name.replaceAll('_', ' ')}
            </span>
          ))}
          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-800/60 bg-indigo-950/50 px-3.5 py-2 text-xs font-semibold text-indigo-200 shadow-sm transition-all hover:border-indigo-600 hover:shadow-md disabled:opacity-50"
          >
            <RefreshCw size={13} className={reset.isPending ? 'animate-spin' : ''} /> Reset Engine
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div className="gsap-sim-item">
          <ScenarioRunner stationId={stationId} />
        </div>

        <div className="gsap-sim-item rounded-2xl border border-indigo-900/40 bg-slate-950/60 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-indigo-700/60 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-100">Telemetry Engine</h2>
            <div ref={gearRef} className="text-violet-400">
              <Cpu size={16} />
            </div>
          </div>
          <div className="mt-4 space-y-3.5 text-sm">
            <div className="flex items-center justify-between border-b border-indigo-900/30 pb-2.5">
              <span className="text-slate-400">Telemetry Engine</span>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-400 font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                {status?.is_running ? 'RUNNING' : 'STANDBY'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-indigo-900/30 pb-2.5">
              <span className="text-slate-400">Tick Interval</span>
              <span className="font-semibold text-slate-200 font-mono">{status?.interval_seconds ?? 10}s</span>
            </div>
            <div className="flex items-center justify-between border-b border-indigo-900/30 pb-2.5">
              <span className="text-slate-400">Cycles Executed</span>
              <span className="font-bold text-violet-300 font-mono">
                <GSAPNumberTicker value={status?.total_cycles_executed ?? 0} decimals={0} />
              </span>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-slate-400">Last Tick</span>
              <span className="font-mono text-xs text-slate-300">
                {status?.last_tick_at
                  ? new Date(status.last_tick_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
                  : '—'} IST
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationPage;

