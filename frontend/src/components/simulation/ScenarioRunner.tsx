import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runSimulationScenario } from '../../api/simulation';
import { Activity, AlertOctagon, CheckCircle } from 'lucide-react';
import type { ScenarioResponse } from '../../api/types';

export const ScenarioRunner = ({ stationId }: { stationId: number }) => {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ScenarioResponse | null>(null);

  const simMutation = useMutation({
    mutationFn: (scenario: string) => runSimulationScenario(stationId, scenario),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['equipment', stationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
      queryClient.invalidateQueries({ queryKey: ['alerts', stationId] });
    },
  });

  const handleRun = () => {
    setResult(null);
    simMutation.mutate('GENERATOR_FAILURE');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col gap-6 w-full max-w-xl shadow-xl animate-in slide-in-from-right">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            WHAT-IF SIMULATOR
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-mono">SCENARIO_INJECTION_MODULE</p>
        </div>
        <div className="px-3 py-1 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-cyan-400">
          READY
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-slate-950 p-4 rounded border border-slate-800">
          <div className="text-xs font-mono text-slate-500 mb-2">TARGET_SCENARIO</div>
          <div className="text-slate-200 font-bold tracking-wide">GENERATOR_FAILURE</div>
          <p className="text-slate-400 text-sm mt-2">
            Simulates a sudden failure of Generator 1 on the active microgrid to trigger automated alerts and test operator response.
          </p>
        </div>

        <button 
          onClick={handleRun}
          disabled={simMutation.isPending}
          className="w-full py-3 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 rounded font-bold font-mono tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        >
          {simMutation.isPending ? (
            <>
              <Activity className="w-5 h-5 animate-spin" /> INJECTING_FAULT...
            </>
          ) : (
            <>
              <AlertOctagon className="w-5 h-5" /> INJECT_SCENARIO
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-4 p-4 bg-emerald-950/20 border border-emerald-900/50 rounded animate-in fade-in">
          <div className="flex items-center gap-2 text-emerald-400 font-bold mb-3 font-mono">
            <CheckCircle className="w-5 h-5" />
            FAULT_INJECTED_SUCCESSFULLY
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono block">ENERGY_DEFICIT</span>
              <span className="text-amber-400 font-bold font-mono text-lg">{result.impact?.energy_deficit_kw ?? 120} kW</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono block">GRID_STABILITY_RISK</span>
              <span className="text-red-400 font-bold font-mono text-lg">{result.impact?.grid_stability_risk ?? 'HIGH'}</span>
            </div>
          </div>

          <div className="text-sm text-slate-300">
            {result.affected_systems && result.affected_systems.length > 0 && (
              <>
                <div className="text-xs font-mono text-slate-500 mb-1">AFFECTED_SYSTEMS</div>
                <ul className="list-disc pl-5 mb-3 text-red-200">
                  {result.affected_systems.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </>
            )}
            
            {result.recommendations && result.recommendations.length > 0 && (
              <>
                <div className="text-xs font-mono text-slate-500 mb-1">SYSTEM_RECOMMENDATIONS</div>
                <ul className="list-disc pl-5 text-amber-200/80">
                  {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
