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
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
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
    <div ref={containerRef} className="flex flex-col gap-5">
      <div className="gsap-sim-item flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-violet-100 p-2.5 text-violet-600">
            <FlaskConical size={20} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">What-If Scenario Simulation</h1>
            <p className="text-sm text-slate-400">
              Inject operational stress tests, polar storm conditions, and generator faults in real time.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeScenarios.map(([name, until]) => (
            <span
              key={name}
              className="rounded-full bg-violet-100 px-3 py-1.5 text-[11px] font-bold text-violet-700 animate-pulse border border-violet-200"
              title={until ? `Active until ${new Date(until).toLocaleTimeString()}` : undefined}
            >
              {name.replaceAll('_', ' ')}
            </span>
          ))}
          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:shadow-md disabled:opacity-50"
          >
            <RefreshCw size={13} className={reset.isPending ? 'animate-spin' : ''} /> Reset Engine
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div className="gsap-sim-item">
          <ScenarioRunner stationId={stationId} />
        </div>

        <div className="gsap-sim-item rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">Telemetry Engine</h2>
            <div ref={gearRef} className="text-violet-500">
              <Cpu size={16} />
            </div>
          </div>
          <div className="mt-4 space-y-3.5 text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-slate-500">Telemetry Engine</span>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-600 font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                {status?.is_running ? 'RUNNING' : 'STANDBY'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-slate-500">Tick Interval</span>
              <span className="font-semibold text-slate-800 font-mono">{status?.interval_seconds ?? 10}s</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-slate-500">Cycles Executed</span>
              <span className="font-bold text-violet-600 font-mono">
                <GSAPNumberTicker value={status?.total_cycles_executed ?? 0} decimals={0} />
              </span>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-slate-500">Last Tick</span>
              <span className="font-mono text-xs text-slate-600">
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

