import { useQuery } from '@tanstack/react-query';
import { FlaskConical, RefreshCw } from 'lucide-react';
import { getSimulationStatus, resetSimulation } from '../api/simulation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ScenarioRunner from '../components/simulation/ScenarioRunner';

export const SimulationPage = ({ stationId }: { stationId: number }) => {
  const qc = useQueryClient();
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

  const activeScenarios = Object.entries(status?.active_scenarios ?? {});

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-violet-100 p-2.5 text-violet-600">
            <FlaskConical size={20} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">What-If Simulation</h1>
            <p className="text-sm text-slate-400">
              Inject operational scenarios and watch the digital twin respond in real time.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeScenarios.map(([name, until]) => (
            <span
              key={name}
              className="rounded-full bg-violet-100 px-3 py-1.5 text-[11px] font-bold text-violet-700"
              title={until ? `Active until ${new Date(until).toLocaleTimeString()}` : undefined}
            >
              {name.replaceAll('_', ' ')}
            </span>
          ))}
          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 disabled:opacity-50"
          >
            <RefreshCw size={12} className={reset.isPending ? 'animate-spin' : ''} /> Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <ScenarioRunner stationId={stationId} />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">Engine Status</h2>
          <div className="mt-4 space-y-3 text-sm">
            {[
              ['Telemetry Engine', status?.is_running ? 'Running' : 'Stopped'],
              ['Tick Interval', `${status?.interval_seconds ?? 10}s`],
              ['Cycles Executed', String(status?.total_cycles_executed ?? 0)],
              [
                'Last Tick',
                status?.last_tick_at
                  ? new Date(status.last_tick_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
                  : '—',
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-800">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationPage;
