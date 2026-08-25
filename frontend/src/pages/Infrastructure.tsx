import { useQuery } from '@tanstack/react-query';
import { getStationEquipment } from '../api/stations';
import { Settings, ShieldCheck, Activity, Cpu } from 'lucide-react';

export const Infrastructure = ({ stationId }: { stationId: number }) => {
  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment', stationId],
    queryFn: () => getStationEquipment(stationId),
  });

  if (isLoading || !equipment) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto h-full overflow-auto pr-2 custom-scrollbar pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-slate-100 flex items-center gap-3">
            <Cpu className="w-6 h-6 text-cyan-400" />
            INFRASTRUCTURE_REGISTRY
          </h1>
          <p className="text-slate-400 text-sm mt-1">Status of critical life-support, power subsystems, and research station assets.</p>
        </div>
        <div className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-400">
          TOTAL_ASSETS: <span className="text-cyan-400">{equipment.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipment.map(eq => (
          <div key={eq.id} className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-mono text-cyan-400">#{eq.id} • {eq.equipment_type}</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${eq.status === 'RUNNING' || eq.status === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {eq.status}
                </span>
              </div>
              <h3 className="font-bold text-slate-200 text-lg">{eq.name}</h3>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-mono">HEALTH_INDEX</span>
                <span className={`text-xl font-bold font-mono ${eq.health_score < 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {eq.health_score}%
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-mono block">CRITICAL_TIER</span>
                <span className="text-xs font-mono text-slate-300">{eq.is_critical ? 'TIER-1 CRITICAL' : 'STANDARD'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
