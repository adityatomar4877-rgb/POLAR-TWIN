import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Snowflake, ZapOff, Play, Timer, ChevronRight } from 'lucide-react';
import { runSimulationScenario, getSimulationStatus } from '../../api/simulation';
import type { CustomConditions } from '../../api/types';

const QUICK_SCENARIOS: Array<{
  id: string;
  label: string;
  icon: typeof Snowflake;
  durationMinutes: number;
  conditions: CustomConditions;
}> = [
  {
    id: 'EXTREME_BLIZZARD',
    label: 'Blizzard Drill',
    icon: Snowflake,
    durationMinutes: 90,
    conditions: {
      temperature_c: -52,
      wind_speed_kmh: 115,
      solar_factor: 0.1,
      blizzard_warning: true,
      load_modifier_kw: 35,
      generator_1_online: true,
      generator_2_online: false,
      battery_percentage: 75,
      fuel_percentage: 70,
      fuel_burn_multiplier: 1.6,
    },
  },
  {
    id: 'GENERATOR_FAILURE',
    label: 'Gen-1 Failure',
    icon: ZapOff,
    durationMinutes: 45,
    conditions: {
      temperature_c: -18,
      wind_speed_kmh: 32,
      solar_factor: 0.4,
      blizzard_warning: false,
      load_modifier_kw: 0,
      generator_1_online: false,
      generator_2_online: false,
      battery_percentage: 80,
      fuel_percentage: 80,
      fuel_burn_multiplier: 1,
    },
  },
];

const prettyScenario = (s: string) =>
  s.charAt(0).toUpperCase() + s.replaceAll('_', ' ').slice(1).toLowerCase();

export default function SimulationStrip({ stationId }: { stationId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: sim } = useQuery({
    queryKey: ['simulation-status'],
    queryFn: getSimulationStatus,
    refetchInterval: 15000,
  });

  const launch = useMutation({
    mutationFn: (scenario: (typeof QUICK_SCENARIOS)[number]) =>
      runSimulationScenario(
        stationId,
        scenario.id,
        scenario.conditions,
        true,
        scenario.durationMinutes
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
      queryClient.invalidateQueries({ queryKey: ['simulation-status'] });
    },
  });

  const activeScenarios = Object.entries(sim?.active_scenarios ?? {}).filter(
    ([name]) => name.toUpperCase() !== 'NORMAL_OPERATION'
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        {/* Engine identity */}
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <FlaskConical size={18} />
          </span>
          <div>
            <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">
              Simulation Engine
            </h2>
            <p className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
              <span
                className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  sim?.is_running ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'
                )}
              />
              {sim?.is_running ? `Live · tick every ${sim.interval_seconds ?? 5}s` : 'Standby'}
            </p>
          </div>
        </div>

        <span className="hidden h-9 w-px bg-slate-100 sm:block" />

        {/* Cycles */}
        <div className="flex items-center gap-2">
          <Timer size={14} className="text-slate-400" />
          <div className="leading-tight">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cycles Run</p>
            <p className="text-[13px] font-bold tabular-nums text-slate-800">{sim?.total_cycles_executed ?? 0}</p>
          </div>
        </div>

        {/* Active scenarios */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {activeScenarios.length === 0 ? (
            <span className="text-xs font-medium text-slate-400">No active scenarios</span>
          ) : (
            activeScenarios.map(([name]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-600 ring-1 ring-violet-200"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                {prettyScenario(name)}
              </span>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {QUICK_SCENARIOS.map((scenario) => {
            const Icon = scenario.icon;
            const isLaunching =
              launch.isPending && launch.variables?.id === scenario.id;
            return (
              <button
                key={scenario.id}
                onClick={() => launch.mutate(scenario)}
                disabled={launch.isPending}
                title={`Run ${scenario.label} what-if scenario`}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
                  launch.isError && launch.variables?.id === scenario.id
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
                )}
              >
                {isLaunching ? <Play size={12} className="animate-pulse" /> : <Icon size={12} />}
                {scenario.label}
              </button>
            );
          })}
          <button
            onClick={() => navigate('/simulation')}
            className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Open Simulator
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {launch.isSuccess && (
          <motion.p
            key="success"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700"
          >
            Scenario applied to live twin — telemetry will reflect the injected conditions shortly.
          </motion.p>
        )}
        {launch.isError && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-xs font-medium text-red-600"
          >
            Simulation service rejected the scenario — open the simulator for details.
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
