import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { Settings, Play, Square, RotateCcw, AlertTriangle, ShieldCheck, Power, RefreshCw, Zap, SlidersHorizontal } from 'lucide-react';
import { getStationEquipment, getActiveAlerts } from '../api/stations';
import { resetSimulation } from '../api/simulation';
import { CommandPreviewModal } from '../components/operations/CommandPreviewModal';
import CommandHistoryTable from '../components/operations/CommandHistoryTable';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';
import type { CommandRequest, Equipment } from '../api/types';

export const Operations = ({ stationId }: { stationId: number }) => {
  const queryClient = useQueryClient();
  const [activeRequest, setActiveRequest] = useState<CommandRequest | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment', stationId],
    queryFn: () => getStationEquipment(stationId),
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', stationId],
    queryFn: () => getActiveAlerts(stationId),
  });

  const resetMutation = useMutation({
    mutationFn: resetSimulation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', stationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
      queryClient.invalidateQueries({ queryKey: ['alerts', stationId] });
    }
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-ops-item',
        { y: 24, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.06,
          ease: 'power3.out',
          clearProps: 'scale',
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

  const handleAction = (eq: Equipment, action: 'START' | 'STOP' | 'RESTART' | 'SHUTDOWN' | 'ISOLATE') => {
    let commandType = `${action}_EQUIPMENT`;
    if (eq.equipment_type === 'GENERATOR') {
      if (action === 'START') commandType = 'START_GENERATOR';
      else if (action === 'STOP') commandType = 'STOP_GENERATOR';
    }

    setActiveRequest({
      command_type: commandType,
      target_type: 'EQUIPMENT',
      target_id: eq.id,
      requested_by: 'Operator_Demo',
      role: 'OPERATOR',
      reason: `Remote operator ${action.toLowerCase()} dispatched on ${eq.name}`,
    });
  };

  const handleQuickCommand = (type: string, params?: Record<string, any>, reason?: string) => {
    setActiveRequest({
      command_type: type,
      target_type: type.startsWith('LOAD') ? 'LOAD_GROUP' : 'STATION',
      parameters: params || {},
      requested_by: 'Operator_Demo',
      role: 'OPERATOR',
      reason: reason || `Manual operator command: ${type}`,
    });
  };

  if (isLoading || !equipment) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-cyan-600 font-mono text-sm animate-pulse">CONNECTING_OPERATIONS_TELEMETRY...</div>
      </div>
    );
  }

  const generators = equipment.filter(e => e.equipment_type === 'GENERATOR');
  const batteries = equipment.filter(e => e.equipment_type === 'BATTERY_BANK' || e.equipment_type === 'BATTERY');
  const hvacs = equipment.filter(e => e.equipment_type === 'HVAC');
  const others = equipment.filter(e => !['GENERATOR', 'BATTERY_BANK', 'BATTERY', 'HVAC'].includes(e.equipment_type));

  const EquipmentCard = ({ eq }: { eq: Equipment }) => {
    const isOffline = eq.status === 'OFFLINE' || eq.status === 'FAILED' || eq.status === 'CRITICAL';
    const isGenerator = eq.equipment_type === 'GENERATOR';

    return (
      <div className="group bg-white border border-slate-200 hover:border-slate-300 transition-all duration-300 hover:-translate-y-1 hover:shadow-md rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs">
        <div>
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-mono text-cyan-600 font-semibold">#{eq.id} • {eq.equipment_type}</span>
              <h4 className="text-slate-800 font-bold text-base mt-0.5">{eq.name}</h4>
            </div>
            <div className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider ${isOffline ? 'bg-red-100 text-red-600 border border-red-200 animate-pulse' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'}`}>
              {eq.status}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px]">HEALTH_SCORE</span>
              <span className={`font-bold text-sm ${eq.health_score < 50 ? 'text-red-600' : 'text-emerald-600'}`}>
                <GSAPNumberTicker value={eq.health_score} decimals={0} suffix="%" />
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">OPERATING_TEMP</span>
              <span className="text-slate-600 font-bold text-sm">
                {eq.temperature ? `${eq.temperature.toFixed(1)}°C` : 'NOMINAL'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          {isGenerator ? (
            <>
              <button 
                onClick={() => handleAction(eq, 'START')}
                className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-mono font-bold transition-all shadow-xs"
              >
                <Play className="w-3.5 h-3.5" /> START
              </button>
              <button 
                onClick={() => handleAction(eq, 'STOP')}
                className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-mono font-bold transition-all"
              >
                <Square className="w-3.5 h-3.5" /> STOP
              </button>
              <button 
                onClick={() => handleAction(eq, 'RESTART')}
                className="flex items-center justify-center px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-mono transition-all"
                title="Restart Unit"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => handleAction(eq, 'RESTART')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-mono font-bold transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-600" /> RESTART
              </button>
              <button 
                onClick={() => handleAction(eq, 'ISOLATE')}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-mono font-bold transition-all"
                title="Lock out for Maintenance"
              >
                <Power className="w-3.5 h-3.5" /> ISOLATE
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-6 max-w-6xl mx-auto h-full overflow-auto pr-2 custom-scrollbar pb-10">
      
      {/* Header & Quick Action Bar */}
      <div className="gsap-ops-item flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-slate-800 flex items-center gap-3">
            <Settings className="w-6 h-6 text-cyan-600" />
            OPERATIONS_COMMAND
          </h1>
          <p className="text-slate-500 text-sm mt-1">Direct datalink to station infrastructure, remote actuators, and load management.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 transition-all hover:border-cyan-500/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resetMutation.isPending ? 'animate-spin' : 'text-cyan-600'}`} />
            RESET_SIMULATION
          </button>
        </div>
      </div>

      {/* Global Mission Control Commands Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-5 h-5 text-cyan-600" />
          <div>
            <div className="text-xs font-bold font-mono text-slate-700">STATION_WIDE_COMMAND_PROTOCOLS</div>
            <div className="text-[11px] text-slate-500">Execute authorized multi-system shedding or emergency protocols.</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => handleQuickCommand('LOAD_SHED', { load_group: 'NON_CRITICAL' }, 'Emergency load shed of non-critical circuits')}
            className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 rounded text-xs font-mono font-bold transition-all"
          >
            SHED_NON_CRITICAL
          </button>
          <button 
            onClick={() => handleQuickCommand('LOAD_RESTORE', { load_group: 'ALL' }, 'Restore all shed circuits to service')}
            className="px-3.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200 rounded text-xs font-mono font-bold transition-all"
          >
            RESTORE_ALL_LOADS
          </button>
        </div>
      </div>

      {/* Active Alerts Detected Banner */}
      {alerts && alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-in slide-in-from-top-4">
          <h3 className="text-red-500 font-bold font-mono flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" />
            ACTIVE_SYSTEM_ALERTS ({alerts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map(alert => (
              <div key={alert.id} className="bg-slate-50 p-3.5 rounded border border-red-200/30 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-red-600 font-bold font-mono">{alert.severity}</span>
                  <span className="text-[10px] font-mono text-slate-500">{alert.source}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">{alert.title}</span>
                {alert.message && <span className="text-xs text-slate-500">{alert.message}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipment Subsystems */}
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-mono text-slate-500 font-bold mb-3 border-b border-slate-200 pb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            PRIMARY_POWER_GENERATION
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {generators.map(eq => <EquipmentCard key={eq.id} eq={eq} />)}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-mono text-slate-500 font-bold mb-3 border-b border-slate-200 pb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-600" />
            ENERGY_STORAGE_&_REGULATION
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batteries.map(eq => <EquipmentCard key={eq.id} eq={eq} />)}
          </div>
        </div>
        
        <div>
          <h2 className="text-sm font-mono text-slate-500 font-bold mb-3 border-b border-slate-200 pb-2 flex items-center gap-2">
            <Settings className="w-4 h-4 text-purple-600" />
            CRITICAL_LIFE_SUPPORT_&_HVAC
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hvacs.map(eq => <EquipmentCard key={eq.id} eq={eq} />)}
          </div>
        </div>

        {others.length > 0 && (
          <div>
            <h2 className="text-sm font-mono text-slate-500 font-bold mb-3 border-b border-slate-200 pb-2 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              AUXILIARY_STATION_SYSTEMS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {others.map(eq => <EquipmentCard key={eq.id} eq={eq} />)}
            </div>
          </div>
        )}

        {/* Immutable operator command audit history */}
        <CommandHistoryTable stationId={stationId} />
      </div>

      <CommandPreviewModal 
        isOpen={!!activeRequest} 
        onClose={() => setActiveRequest(null)} 
        stationId={stationId}
        request={activeRequest} 
      />
    </div>
  );
};
