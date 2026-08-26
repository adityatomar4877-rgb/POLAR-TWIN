import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { runSimulationScenario, resetSimulation } from '../../api/simulation';
import { getSimulationStatus } from '../../api/simulation';
import {
  Activity,
  AlertOctagon,
  CheckCircle,
  RotateCcw,
  Zap,
  ThermometerSnowflake,
  Gauge,
  Fuel,
  Ship,
} from 'lucide-react';
import type { ScenarioResponse } from '../../api/types';

const SCENARIOS: Array<{
  key: string;
  label: string;
  description: string;
  icon: typeof Zap;
}> = [
  { key: 'GENERATOR_FAILURE', label: 'GENERATOR FAILURE', description: 'Sudden Generator 1 trip on the live microgrid', icon: Zap },
  { key: 'EXTREME_COLD', label: 'EXTREME COLD', description: 'Polar cold snap driving heating demand surge', icon: ThermometerSnowflake },
  { key: 'HIGH_ENERGY_DEMAND', label: 'HIGH ENERGY DEMAND', description: 'Concurrent science operations peak load', icon: Gauge },
  { key: 'FUEL_SHORTAGE', label: 'FUEL SHORTAGE', description: 'Diesel reserves drop below critical threshold', icon: Fuel },
  { key: 'SUPPLY_DELAY', label: 'SUPPLY DELAY', description: 'Resupply vessel delayed by pack ice', icon: Ship },
];

export const ScenarioRunner = ({ stationId }: { stationId: number }) => {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ScenarioResponse | null>(null);
  const [selected, setSelected] = useState<string>('GENERATOR_FAILURE');

  const { data: simStatus } = useQuery({
    queryKey: ['simulation-status'],
    queryFn: () => getSimulationStatus(),
    refetchInterval: 15000,
  });

  const invalidateAll = () => {
    ['equipment', 'dashboard', 'alerts', 'recommendations', 'simulation-status'].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    );
    ['equipment', 'dashboard', 'alerts'].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key, stationId] })
    );
  };

  const simMutation = useMutation({
    mutationFn: (scenario: string) => runSimulationScenario(stationId, scenario),
    onSuccess: (data) => {
      setResult(data);
      invalidateAll();
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetSimulation(),
    onSuccess: () => {
      setResult(null);
      invalidateAll();
    },
  });

  const activeScenarioCount = Object.keys(simStatus?.active_scenarios ?? {}).length;

  return (
    <div className="glass-panel flex w-full flex-col gap-5 rounded-xl p-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="flex items-center gap-2 font-mono text-base font-bold tracking-widest text-slate-800">
            <Activity className="h-4 w-4 text-violet-600" />
            WHAT-IF SIMULATION SANDBOX
          </h2>
          <p className="mt-1 font-mono text-[10px] tracking-widest text-slate-500">
            SCENARIO_INJECTION_MODULE · SIM-VIOLET PROTOCOL
          </p>
        </div>
        <div
          className={clsx(
            'rounded border px-3 py-1 font-mono text-[10px] tracking-widest',
            activeScenarioCount > 0
              ? 'border-violet-300 bg-violet-100 text-violet-600'
              : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-600'
          )}
        >
          {activeScenarioCount > 0 ? `${activeScenarioCount} ACTIVE` : 'NOMINAL'}
        </div>
      </div>

      {/* Scenario selector grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          const isActive = selected === s.key;
          const isRunning = simStatus?.active_scenarios?.[s.key] != null;
          return (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)}
              className={clsx(
                'rounded-lg border p-3 text-left transition-all',
                isActive
                  ? 'border-violet-300 bg-violet-100'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-400',
                isRunning && !isActive && 'border-violet-500/30'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={clsx(
                    'flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest',
                    isActive ? 'text-violet-700' : 'text-slate-600'
                  )}
                >
                  <Icon size={13} /> {s.label}
                </span>
                {isRunning && (
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-status-ring" title="Scenario active" />
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{s.description}</p>
            </button>
          );
        })}
      </div>

      {/* Inject / Reset controls */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setResult(null);
            simMutation.mutate(selected);
          }}
          disabled={simMutation.isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-3 font-mono text-xs font-bold tracking-widest text-red-600 shadow-[0_0_15px_rgba(239,68,68,0.12)] transition-all hover:bg-red-900/60 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {simMutation.isPending ? (
            <>
              <Activity className="h-4 w-4 animate-spin" /> INJECTING_FAULT...
            </>
          ) : (
            <>
              <AlertOctagon className="h-4 w-4" /> INJECT_SCENARIO
            </>
          )}
        </button>
        <button
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-3 font-mono text-xs font-bold tracking-widest text-slate-600 transition-colors hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"
        >
          <RotateCcw size={14} className={resetMutation.isPending ? 'animate-spin' : ''} />
          RESET
        </button>
      </div>

      {/* Result readout */}
      {result && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-sm font-bold text-violet-600">
            <CheckCircle className="h-5 w-5" />
            FAULT_INJECTED — {result.scenario}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="block font-mono text-[10px] tracking-wider text-slate-500">ENERGY_DEFICIT</span>
              <span className="font-mono text-lg font-bold text-amber-600">
                {result.impact?.energy_deficit_kw ?? '—'}{' '}
                {result.impact?.energy_deficit_kw != null ? 'kW' : ''}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="block font-mono text-[10px] tracking-wider text-slate-500">GRID_STABILITY_RISK</span>
              <span className="font-mono text-lg font-bold text-red-600">
                {result.impact?.grid_stability_risk ?? '—'}
              </span>
            </div>
          </div>

          <div className="text-sm text-slate-600">
            {result.affected_systems?.length > 0 && (
              <>
                <div className="mb-1 font-mono text-xs tracking-wider text-slate-500">AFFECTED_SYSTEMS</div>
                <ul className="mb-3 list-disc space-y-0.5 pl-5 text-red-200">
                  {result.affected_systems.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            {result.recommendations?.length > 0 && (
              <>
                <div className="mb-1 font-mono text-xs tracking-wider text-slate-500">SYSTEM_RECOMMENDATIONS</div>
                <ul className="list-disc space-y-0.5 pl-5 text-amber-700">
                  {result.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {result.active_until && (
            <p className="mt-3 font-mono text-[10px] tracking-widest text-violet-600/70">
              SCENARIO ACTIVE UNTIL {new Date(result.active_until).toLocaleTimeString()} UTC±LOCAL · WATCH THE TWIN REACT LIVE
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ScenarioRunner;
