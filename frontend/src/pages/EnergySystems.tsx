import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStationDashboard } from '../api/stations';
import { Zap, Sun, Wind, Battery, Fuel, Activity, ShieldCheck, Play, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { CommandPreviewModal } from '../components/operations/CommandPreviewModal';
import EnergyFlowDiagram from '../components/energy/EnergyFlowDiagram';
import type { CommandRequest } from '../api/types';

export const EnergySystems = ({ stationId }: { stationId: number }) => {
  const [activeRequest, setActiveRequest] = useState<CommandRequest | null>(null);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  const energy = dashboard.energy;
  const genKw = energy?.generation_kw ?? 0;
  const consKw = energy?.consumption_kw ?? 0;
  const netKw = energy?.energy_balance ?? (genKw - consKw);
  const batteryPct = energy?.battery_percentage ?? 0;
  const fuelPct = energy?.fuel_percentage ?? 0;
  const dieselKw = energy?.diesel_generation_kw ?? 0;
  const solarKw = energy?.solar_generation_kw ?? 0;
  const gridStatus = energy?.grid_status || 'ONLINE';
  const batteryPower = energy?.battery_power_kw ?? 0;

  const isEmergency = gridStatus === 'EMERGENCY' || gridStatus === 'CRITICAL' || netKw < 0;

  const handleStartBackup = () => {
    setActiveRequest({
      command_type: 'START_GENERATOR',
      target_type: 'EQUIPMENT',
      target_id: 9, // Generator 2
      requested_by: 'Operator_Demo',
      role: 'OPERATOR',
      reason: 'Dispatch backup Generator 2 to resolve microgrid deficit',
    });
  };

  const handleShedLoad = (group: string) => {
    setActiveRequest({
      command_type: 'LOAD_SHED',
      target_type: 'LOAD_GROUP',
      parameters: { load_group: group },
      requested_by: 'Operator_Demo',
      role: 'OPERATOR',
      reason: `Shed ${group} to protect battery storage reserves`,
    });
  };

  const handleRestoreLoad = (group: string) => {
    setActiveRequest({
      command_type: 'LOAD_RESTORE',
      target_type: 'LOAD_GROUP',
      parameters: { load_group: group },
      requested_by: 'Operator_Demo',
      role: 'OPERATOR',
      reason: `Restore ${group} power delivery`,
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto h-full overflow-auto pr-2 custom-scrollbar pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-slate-800 flex items-center gap-3">
            <Zap className="w-6 h-6 text-amber-600" />
            MICROGRID_ENERGY_CENTER
          </h1>
          <p className="text-slate-500 text-sm mt-1">Real-time power generation, battery energy storage, and fuel telemetry.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono">
            GRID_STATUS: <span className={!isEmergency ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{gridStatus}</span>
          </div>
        </div>
      </div>

      {/* Live power flow schematic */}
      <EnergyFlowDiagram energy={energy} loads={dashboard.loads} />

      {isEmergency && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
          <div>
            <div className="text-red-600 font-bold font-mono text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              MICROGRID DEFICIT DETECTED: {Math.abs(netKw).toFixed(1)} kW SHORTAGE
            </div>
            <div className="text-xs text-red-700 mt-1">
              Station generators are offline or overloaded. Battery bank is discharging to support baseline loads.
            </div>
          </div>
          <div className="flex gap-2 shrink-0">            <button 
              onClick={handleStartBackup}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> START_BACKUP_GEN
            </button>
            <button 
              onClick={() => handleShedLoad('NON_CRITICAL')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-mono text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" /> SHED_NON_CRITICAL
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>TOTAL_GENERATION</span>
            <Zap className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 font-mono my-2">{genKw.toFixed(1)} <span className="text-sm text-slate-500">kW</span></div>
          <div className="text-xs text-slate-500 font-mono">Diesel: {dieselKw.toFixed(1)} kW | Solar: {solarKw.toFixed(1)} kW</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>TOTAL_DEMAND</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-amber-600 font-mono my-2">{consKw.toFixed(1)} <span className="text-sm text-slate-500">kW</span></div>
          <div className="text-xs text-slate-500 font-mono">Life Support + HVAC + Lab</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>BATTERY_STORAGE</span>
            <Battery className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-3xl font-bold text-cyan-600 font-mono my-2">{batteryPct.toFixed(1)}%</div>
          <div className="text-xs text-slate-500 font-mono">Net Flow: {batteryPower > 0 ? `+${batteryPower.toFixed(1)} kW (Charging)` : `${batteryPower.toFixed(1)} kW (Discharging)`}</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>FUEL_RESERVES</span>
            <Fuel className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-purple-600 font-mono my-2">{fuelPct.toFixed(1)}%</div>
          <div className="text-xs text-slate-500 font-mono">Estimated Runway: ~180 Days</div>
        </div>
      </div>

      {/* Generation Sources Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-600 font-bold font-mono">
              <Sun className="w-4 h-4 text-amber-600" />
              SOLAR_PV_ARRAY
            </div>
            <span className="text-xs font-mono text-emerald-600 font-bold">ACTIVE</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">{solarKw.toFixed(1)} kW</div>
          <p className="text-xs text-slate-500 mt-2">Station photovoltaic panels tracking seasonal solar flux.</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-600 font-bold font-mono">
              <Wind className="w-4 h-4 text-cyan-600" />
              WIND_TURBINE_ARRAY
            </div>
            <span className="text-xs font-mono text-slate-500 font-bold">STANDBY</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">0.0 kW</div>
          <p className="text-xs text-slate-500 mt-2">Katabatic polar wind turbines configured for high-wind modes.</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-600 font-bold font-mono">
              <Zap className="w-4 h-4 text-emerald-600" />
              DIESEL_GENERATORS
            </div>
            <span className={`text-xs font-mono font-bold ${dieselKw > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {dieselKw > 0 ? 'SYNCHRONIZED' : 'OFFLINE'}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">{dieselKw.toFixed(1)} kW</div>
          <p className="text-xs text-slate-500 mt-2">Continuous baseline primary microgrid power generation.</p>
        </div>
      </div>

      {/* Interactive Operations Quick Controls */}
      <div className="bg-white border border-slate-200 p-5 rounded-lg flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold font-mono text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-600" />
            OPERATOR_LOAD_MANAGEMENT_CONTROLS
          </h3>
          <span className="text-xs font-mono text-slate-500">AUTHORITY: OPERATOR</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button 
            onClick={() => handleShedLoad('NON_CRITICAL')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-amber-500/50 rounded flex items-center justify-between transition-all group"
          >
            <div className="text-left">
              <div className="text-xs font-bold font-mono text-slate-700 group-hover:text-amber-600">SHED NON-CRITICAL</div>
              <div className="text-[10px] text-slate-500">Sauna, Galley & Workshops (-29 kW)</div>
            </div>
            <ArrowDownToLine className="w-4 h-4 text-slate-500 group-hover:text-amber-600" />
          </button>

          <button 
            onClick={() => handleShedLoad('HIGH_PRIORITY')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-red-300 rounded flex items-center justify-between transition-all group"
          >
            <div className="text-left">
              <div className="text-xs font-bold font-mono text-slate-700 group-hover:text-red-600">SHED LABS & LIDAR</div>
              <div className="text-[10px] text-slate-500">Science Freezers & Radar (-30 kW)</div>
            </div>
            <ArrowDownToLine className="w-4 h-4 text-slate-500 group-hover:text-red-600" />
          </button>

          <button 
            onClick={() => handleRestoreLoad('ALL')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-emerald-300 rounded flex items-center justify-between transition-all group"
          >
            <div className="text-left">
              <div className="text-xs font-bold font-mono text-slate-700 group-hover:text-emerald-600">RESTORE ALL LOADS</div>
              <div className="text-[10px] text-slate-500">Re-energize shed sub-circuits</div>
            </div>
            <ArrowUpFromLine className="w-4 h-4 text-slate-500 group-hover:text-emerald-600" />
          </button>
        </div>
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
