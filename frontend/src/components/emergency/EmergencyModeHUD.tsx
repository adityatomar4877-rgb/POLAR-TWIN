import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, Loader2, CheckCircle2, Power, Scissors, Siren } from 'lucide-react';
import { useStation } from '../../context/StationContext';
import { startGenerator } from '../../api/operations';
import { shedLoad } from '../../api/operations';
import { toggleEmergencyMode } from '../../api/operations';

/**
 * Full-screen emergency operational HUD rendered when emergency mode is active.
 * Shows affected subsystems with battery depletion countdown and a prioritized
 * action checklist with direct backend execution.
 */
export default function EmergencyModeHUD() {
  const { selectedStationId, dashboard, emergencyModeActive, setEmergencyModeActive } = useStation();
  const qc = useQueryClient();

  const energy = dashboard?.energy;
  const equipment = dashboard?.equipment ?? [];

  const gen2 = equipment.find((e) => e.name === 'Generator 2');
  const offlineCritical = equipment.filter(
    (e) => (e.status === 'OFFLINE' || e.status === 'FAILED') && e.is_critical
  );

  /* Battery depletion countdown estimate */
  const depletionHours = useMemo(() => {
    if (!energy) return null;
    const dischargeKw = Math.abs(Math.min(energy.battery_power_kw, 0));
    if (dischargeKw < 0.05) return null;
    const assumedCapacityKwh = 800; // station bank nameplate
    return ((energy.battery_percentage / 100) * assumedCapacityKwh) / dischargeKw;
  }, [energy]);

  const formatRemaining = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const [elapsedTick, setElapsedTick] = useState(0);
  useEffect(() => {
    if (depletionHours == null) return;
    const t = setInterval(() => setElapsedTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [depletionHours]);

  const countdown =
    depletionHours == null
      ? 'STABLE'
      : formatRemaining(Math.max(0, depletionHours * 3600 - elapsedTick));

  /* Checklist execution state */
  type StepKey = 'GEN2' | 'SHED' | 'PROTOCOL';
  const [stepStatus, setStepStatus] = useState<Record<StepKey, 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'>>({
    GEN2: 'PENDING',
    SHED: 'PENDING',
    PROTOCOL: 'PENDING',
  });

  // Reset the checklist whenever emergency conditions clear externally
  const gridEmergency =
    energy?.grid_status?.toUpperCase() === 'EMERGENCY' ||
    energy?.grid_status?.toUpperCase() === 'CRITICAL';
  const emergencyActive = emergencyModeActive || gridEmergency;
  if (!emergencyActive && stepStatus.PROTOCOL === 'DONE') {
    setStepStatus({ GEN2: 'PENDING', SHED: 'PENDING', PROTOCOL: 'PENDING' });
  }

  const invalidateAll = () => {
    ['equipment', 'dashboard', 'alerts', 'loads', 'recommendations'].forEach((key) =>
      qc.invalidateQueries({ queryKey: [key, selectedStationId] })
    );
  };

  const runStep = async (key: StepKey, fn: () => Promise<unknown>) => {
    setStepStatus((s) => ({ ...s, [key]: 'RUNNING' }));
    try {
      await fn();
      setStepStatus((s) => ({ ...s, [key]: 'DONE' }));
      invalidateAll();
    } catch {
      setStepStatus((s) => ({ ...s, [key]: 'FAILED' }));
    }
  };

  const startGen2 = () =>
    runStep('GEN2', async () => {
      if (gen2) await startGenerator(selectedStationId, gen2.id);
      else throw new Error('Generator 2 not found');
    });

  const shedNonCritical = () =>
    runStep('SHED', async () => {
      await shedLoad(selectedStationId, 'NON_CRITICAL', 'Emergency protocol: shed non-critical loads');
    });

  const activateProtocol = useMutation({
    mutationFn: () => toggleEmergencyMode(selectedStationId, true, 'Full emergency protocol activation'),
    onSuccess: () => {
      setStepStatus((s) => ({ ...s, PROTOCOL: 'DONE' }));
      setEmergencyModeActive(true);
      invalidateAll();
    },
    onError: () => setStepStatus((s) => ({ ...s, PROTOCOL: 'FAILED' })),
  });

  const exitEmergency = useMutation({
    mutationFn: () => toggleEmergencyMode(selectedStationId, false, 'Conditions normalized'),
    onSuccess: () => {
      setEmergencyModeActive(false);
      invalidateAll();
    },
  });

  const steps: Array<{ key: StepKey; icon: typeof Power; label: string; sub: string; run: () => void }> = [
    { key: 'GEN2', icon: Power, label: 'START GENERATOR 2', sub: 'Restore prime generation capacity', run: startGen2 },
    { key: 'SHED', icon: Scissors, label: 'SHED NON-CRITICAL LOADS', sub: 'Disconnect galley / auxiliary circuits', run: shedNonCritical },
    { key: 'PROTOCOL', icon: Siren, label: 'ACTIVATE EMERGENCY PROTOCOL', sub: 'Formal emergency mode with audit trail', run: () => activateProtocol.mutate() },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* Hazard frame */}
      <div className="pointer-events-none absolute inset-0 border-[3px] border-red-300 animate-emergency-strobe" />

      <div className="pointer-events-auto absolute inset-x-0 top-16 mx-auto max-w-3xl px-4">
        <div className="glass-panel-strong overflow-hidden rounded-xl border-red-300">
          {/* Header strip */}
          <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-5 py-3">
            <AlertTriangle size={18} className="animate-emergency-strobe text-red-600" />
            <div>
              <p className="font-mono text-sm font-bold tracking-[0.3em] text-red-600">EMERGENCY MODE ACTIVE</p>
              <p className="font-mono text-[9px] tracking-widest text-red-200/60">
                ALL ACTIONS LOGGED TO IMMUTABLE AUDIT TRAIL · SUPERVISOR AUTHORIZATION ENFORCED
              </p>
            </div>
            <button
              onClick={() => exitEmergency.mutate()}
              disabled={exitEmergency.isPending}
              className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 font-mono text-[9px] tracking-widest text-slate-600 transition-colors hover:border-emerald-400 hover:text-emerald-600"
            >
              {exitEmergency.isPending ? '...' : 'STAND DOWN'}
            </button>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            {/* Affected subsystems + countdown */}
            <div>
              <p className="font-mono text-[9px] tracking-[0.4em] text-slate-500">AFFECTED SUBSYSTEMS</p>
              <div className="mt-3 space-y-2">
                {offlineCritical.length === 0 && (
                  <p className="font-mono text-xs tracking-wider text-slate-500">
                    Grid in emergency state. Monitor energy balance.
                  </p>
                )}
                {offlineCritical.map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <span className="font-mono text-xs tracking-wider text-red-200">{eq.name.toUpperCase()}</span>
                    <span className="rounded bg-red-100 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-red-600">
                      OFFLINE
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-500/[0.05] p-3">
                <p className="font-mono text-[9px] tracking-[0.35em] text-amber-600">
                  ESTIMATED BATTERY DEPLETION
                </p>
                <p
                  className={clsx(
                    'mt-1 font-mono text-3xl font-black tabular-nums',
                    countdown === 'STABLE' ? 'text-emerald-600' : 'text-amber-600'
                  )}
                >
                  {countdown}
                </p>
                <p className="mt-1 font-mono text-[10px] tracking-wider text-slate-500">
                  BATTERY AT {(energy?.battery_percentage ?? 0).toFixed(0)}% · FLOW{' '}
                  {(energy?.battery_power_kw ?? 0).toFixed(1)} kW
                </p>
              </div>
            </div>

            {/* Prioritized action checklist */}
            <div>
              <p className="font-mono text-[9px] tracking-[0.4em] text-slate-500">
                PRIORITIZED EMERGENCY CHECKLIST
              </p>
              <div className="mt-3 space-y-2.5">
                {steps.map((step, i) => {
                  const status = stepStatus[step.key];
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.key}
                      onClick={step.run}
                      disabled={status === 'RUNNING' || status === 'DONE'}
                      className={clsx(
                        'group flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all',
                        status === 'DONE'
                          ? 'border-emerald-300 bg-emerald-50'
                          : status === 'FAILED'
                            ? 'border-red-300 bg-red-50'
                            : 'border-slate-300 bg-slate-100 hover:border-cyan-300 hover:bg-cyan-50'
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold',
                          status === 'DONE'
                            ? 'bg-emerald-100 text-emerald-600'
                            : status === 'FAILED'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-slate-200 text-slate-600'
                        )}
                      >
                        {status === 'RUNNING' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : status === 'DONE' ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-xs font-bold tracking-widest text-slate-800">
                          {step.label}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">{step.sub}</span>
                      </span>
                      {status !== 'DONE' && status !== 'RUNNING' && (
                        <Icon size={15} className="shrink-0 text-slate-500 transition-colors group-hover:text-cyan-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
