import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { BrainCircuit, PlayCircle, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStation } from '../../context/StationContext';
import { getStationRecommendations, executeRecommendation } from '../../api/stations';
import type { OperationalRecommendation } from '../../api/types';

type QueryKey = 'RISK' | 'ENERGY' | 'OUTDOOR';

interface Props {
  compact?: boolean;
}

/**
 * Actionable AI Operations Copilot.
 * Synthesizes live telemetry into diagnostics, renders backend
 * recommendations with one-click execution, and answers quick queries.
 */
export default function OperationsCopilot({ compact = false }: Props) {
  const { selectedStationId, dashboard } = useStation();
  const qc = useQueryClient();
  const [answer, setAnswer] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<QueryKey | null>(null);

  const { data: recommendations, isLoading } = useQuery<OperationalRecommendation[]>({
    queryKey: ['recommendations', selectedStationId],
    queryFn: () => getStationRecommendations(selectedStationId),
    refetchInterval: 20000,
  });

  const executeRec = useMutation({
    mutationFn: (recId: number) => executeRecommendation(recId, selectedStationId),
    onSuccess: (_data, recId) => {
      qc.setQueryData<OperationalRecommendation[] | undefined>(
        ['recommendations', selectedStationId],
        (old) => old?.map((r) => (r.id === recId ? { ...r, status: 'EXECUTED' } : r))
      );
      qc.invalidateQueries({ queryKey: ['equipment', selectedStationId] });
      qc.invalidateQueries({ queryKey: ['dashboard', selectedStationId] });
      qc.invalidateQueries({ queryKey: ['alerts', selectedStationId] });
      qc.invalidateQueries({ queryKey: ['operations-history', selectedStationId] });
    },
  });

  /* ---------- synthesized diagnostics ---------- */

  const energy = dashboard?.energy;
  const env = dashboard?.environment;
  const equipment = dashboard?.equipment ?? [];
  const alerts = dashboard?.alerts ?? [];
  const activeAlerts = alerts.filter((a) => a.is_active !== false);
  const offlineEquipment = equipment.filter((e) => e.status === 'OFFLINE' || e.status === 'FAILED');

  const diagnosticSummary = useMemo(() => {
    const parts: string[] = [];
    if (offlineEquipment.length > 0) {
      parts.push(
        `${offlineEquipment.map((e) => e.name).join(' & ')} offline`
      );
    }
    if (energy && energy.energy_balance < 0) {
      parts.push(
        `energy deficit ${Math.abs(energy.energy_balance).toFixed(1)} kW, battery ${energy.battery_power_kw < 0 ? 'discharging' : 'stable'}`
      );
    }
    if ((env?.wind_speed ?? 0) > 65) parts.push('blizzard conditions outside');
    if (parts.length === 0) return 'All subsystems within nominal envelope. No anomalies detected.';
    return `${parts.join('; ')}.`;
  }, [energy, env, offlineEquipment]);

  const runQuickQuery = (key: QueryKey) => {
    setActiveQuery(key);
    let text = '';
    if (key === 'RISK') {
      const crit = activeAlerts.filter((a) => a.severity === 'CRITICAL').length;
      const warn = activeAlerts.filter((a) => a.severity === 'WARNING').length;
      text =
        crit > 0
          ? `RISK ELEVATED — ${crit} critical alert(s), ${warn} warnings, ${offlineEquipment.length} asset(s) offline. Immediate operator review advised.`
          : energy && energy.energy_balance < -5
            ? `RISK GUARDED — sustained energy deficit of ${Math.abs(energy.energy_balance).toFixed(1)} kW with battery at ${energy.battery_percentage.toFixed(0)}%. Prepare mitigation.`
            : `RISK NOMINAL — ${warn} minor warning(s) under observation. Station stable.`;
    } else if (key === 'ENERGY') {
      text = energy
        ? `GENERATION ${energy.generation_kw.toFixed(1)} kW · DEMAND ${energy.consumption_kw.toFixed(1)} kW · NET ${energy.energy_balance.toFixed(1)} kW. Battery ${energy.battery_percentage.toFixed(0)}% (${energy.battery_power_kw >= 0 ? '+' : ''}${energy.battery_power_kw.toFixed(1)} kW flow). ${
            energy.energy_balance < 0
              ? 'Recommend starting backup generation or shedding non-critical load groups.'
              : 'Balance healthy. Battery reserves within operating band.'
          }`
        : 'Energy telemetry unavailable.';
    } else {
      const wind = env?.wind_speed ?? 0;
      const tempC = env?.temperature ?? -20;
      const chill = tempC - wind * 0.15;
      text =
        (env?.wind_speed ?? 0) > 65
          ? `DANGER — blizzard warning active. Wind ${wind.toFixed(0)} km/h, wind chill ≈ ${chill.toFixed(0)}°C. All outdoor EVA suspended.`
          : chill < -45 || wind > 80
            ? `CAUTION — wind chill ≈ ${chill.toFixed(0)}°C at ${wind.toFixed(0)} km/h winds. Outdoor exposure limited to 15 min with full gear.`
            : `SAFE — wind ${wind.toFixed(0)} km/h, wind chill ≈ ${chill.toFixed(0)}°C. Standard outdoor operations permitted.`;
    }
    setAnswer(text);
  };

  const activeRecs = (recommendations ?? []).filter((r) => r.status === 'ACTIVE');

  return (
    <div className="glass-panel flex flex-col rounded-xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <BrainCircuit size={16} className="text-violet-600" />
        <h3 className="font-mono text-xs font-bold tracking-[0.35em] text-slate-700">OPERATIONS COPILOT</h3>
        <span className="ml-auto flex items-center gap-1 font-mono text-[9px] tracking-widest text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-status-ring" /> ONLINE
        </span>
      </div>

      {/* Diagnostic summary */}
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="font-mono text-[9px] tracking-[0.4em] text-slate-500">LIVE DIAGNOSTIC</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{diagnosticSummary}</p>
      </div>

      {/* Quick queries */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
        {(
          [
            ['RISK', 'ASSESS STATION RISK'],
            ['ENERGY', 'ANALYZE ENERGY DEFICIT'],
            ['OUTDOOR', 'EVALUATE OUTDOOR SAFETY'],
          ] as Array<[QueryKey, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => runQuickQuery(key)}
            className={clsx(
              'rounded-full border px-3 py-1.5 font-mono text-[9px] tracking-widest transition-colors',
              activeQuery === key
                ? 'border-violet-300 bg-violet-100 text-violet-700'
                : 'border-slate-300 bg-slate-100 text-slate-500 hover:border-violet-300 hover:text-violet-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {answer && (
        <div className="mx-4 mt-3 rounded-lg border border-violet-200 bg-violet-400/[0.06] p-3 text-sm leading-relaxed text-slate-800">
          {answer}
        </div>
      )}

      {/* Recommendations */}
      {!compact && (
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4 custom-scrollbar max-h-72">
          <p className="font-mono text-[9px] tracking-[0.4em] text-slate-500">
            OPERATIONAL RECOMMENDATIONS ({activeRecs.length})
          </p>
          {isLoading && (
            <p className="flex items-center gap-2 py-4 font-mono text-[10px] tracking-widest text-slate-500">
              <Loader2 size={12} className="animate-spin" /> SYNTHESIZING...
            </p>
          )}
          {!isLoading && activeRecs.length === 0 && (
            <p className="py-4 text-center font-mono text-[10px] tracking-widest text-slate-600">
              NO ACTIVE RECOMMENDATIONS
            </p>
          )}
          {activeRecs.map((rec) => {
            const executing =
              executeRec.isPending && executeRec.variables === rec.id;
            const executed = rec.status === 'EXECUTED';
            return (
              <div
                key={`${rec.id}-${rec.created_at}`}
                className={clsx(
                  'rounded-lg border p-3 transition-colors',
                  rec.severity === 'CRITICAL'
                    ? 'border-red-500/35 bg-red-50'
                    : rec.severity === 'WARNING'
                      ? 'border-amber-200 bg-amber-500/[0.04]'
                      : 'border-slate-200 bg-slate-50'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] tracking-[0.25em] text-slate-500">
                    {rec.category}
                  </span>
                  <span
                    className={clsx(
                      'rounded px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-widest',
                      rec.severity === 'CRITICAL'
                        ? 'bg-red-100 text-red-600'
                        : rec.severity === 'WARNING'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-cyan-100 text-cyan-600'
                    )}
                  >
                    {rec.severity}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-800">{rec.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{rec.explanation}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="line-clamp-1 flex-1 font-mono text-[10px] tracking-wide text-cyan-700">
                    ▸ {rec.suggested_action}
                  </p>
                  {executed ? (
                    <span className="flex items-center gap-1 font-mono text-[9px] tracking-widest text-emerald-600">
                      <CheckCircle2 size={12} /> EXECUTED
                    </span>
                  ) : executing ? (
                    <span className="flex items-center gap-1 font-mono text-[9px] tracking-widest text-cyan-600">
                      <Loader2 size={12} className="animate-spin" /> EXECUTING
                    </span>
                  ) : (
                    <button
                      onClick={() => executeRec.mutate(rec.id)}
                      disabled={!rec.target_command_type}
                      title={
                        rec.target_command_type
                          ? 'Execute recommendation'
                          : 'Informational recommendation — no executable command'
                      }
                      className={clsx(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[9px] font-bold tracking-widest transition-all',
                        rec.target_command_type
                          ? 'bg-cyan-100 text-cyan-700 hover:bg-cyan-400/30 hover:border-glow-cyan'
                          : 'cursor-not-allowed bg-slate-100 text-slate-600'
                      )}
                    >
                      <PlayCircle size={12} /> EXECUTE
                    </button>
                  )}
                </div>
                {executeRec.isError && executeRec.variables === rec.id && (
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-red-600">
                    <AlertTriangle size={11} /> EXECUTION REJECTED BY SAFETY INTERLOCK
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
