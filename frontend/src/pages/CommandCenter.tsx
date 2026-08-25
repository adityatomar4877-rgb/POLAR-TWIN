import { useQuery } from '@tanstack/react-query';
import { getStationDashboard, getActiveAlerts } from '../api/stations';
import { Activity, AlertTriangle, BatteryCharging, Wind, Thermometer, ShieldCheck } from 'lucide-react';
import { DigitalTwinScene } from '../components/3d/DigitalTwinScene';
import { ScenarioRunner } from '../components/simulation/ScenarioRunner';

export const CommandCenter = ({ stationId }: { stationId: number }) => {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', stationId],
    queryFn: () => getActiveAlerts(stationId),
  });

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 text-cyan-400 animate-spin" />
          <div className="text-cyan-400 font-mono text-sm tracking-widest animate-pulse">
            INITIALIZING_TWIN_DATALINK...
          </div>
        </div>
      </div>
    );
  }

  const gridStatus = dashboard.energy?.grid_status || 'STABLE';
  const isCritical = gridStatus === 'CRITICAL' || gridStatus === 'DEFICIT' || (dashboard.energy?.battery_percentage ?? 100) < 20;
  const activeAlertsList = alerts || dashboard.alerts || [];
  const hasAlerts = activeAlertsList.length > 0;

  const tempC = dashboard.environment?.temperature_c ?? -25.0;
  const windKmh = dashboard.environment?.wind_speed_kmh ?? 15.0;
  const blizzard = dashboard.environment?.blizzard_warning ?? false;

  const genKw = dashboard.energy?.generation_kw ?? 0;
  const consKw = dashboard.energy?.consumption_kw ?? 0;
  const netKw = dashboard.energy?.energy_balance ?? (genKw - consKw);
  const batteryLvl = dashboard.energy?.battery_percentage ?? 85.0;

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      {/* 3D Digital Twin Viewport */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden relative shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] flex flex-col">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 backdrop-blur border border-slate-700/50 rounded text-sm font-mono">
            <div className={`w-2 h-2 rounded-full ${isCritical ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className={isCritical ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              GRID: {gridStatus}
            </span>
          </div>
          <div className="px-3 py-1.5 bg-slate-950/80 backdrop-blur border border-slate-700/50 rounded text-sm font-mono text-slate-300">
            STATION: {dashboard.station.code}
          </div>
        </div>

        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
           <div className="px-3 py-1 bg-slate-950/80 backdrop-blur border border-slate-700/50 rounded text-xs font-mono text-slate-400">
            VIEW: ISOMETRIC
          </div>
        </div>

        {/* 3D Canvas Container */}
        <div className="flex-1 w-full h-full cursor-crosshair">
          <DigitalTwinScene stationId={stationId} />
        </div>
        
        {/* Environment Overlay at bottom */}
        <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center pointer-events-none">
          <div className="flex items-center gap-6 px-6 py-3 bg-slate-950/80 backdrop-blur border border-slate-700/50 rounded-lg pointer-events-auto">
             <div className="flex items-center gap-3">
               <Thermometer className="w-5 h-5 text-slate-400" />
               <div className="flex flex-col">
                 <span className="text-[10px] text-slate-500 font-mono">EXT_TEMP</span>
                 <span className="text-sm font-medium text-slate-200">{tempC.toFixed(1)}°C</span>
               </div>
             </div>
             <div className="w-px h-8 bg-slate-800" />
             <div className="flex items-center gap-3">
               <Wind className="w-5 h-5 text-slate-400" />
               <div className="flex flex-col">
                 <span className="text-[10px] text-slate-500 font-mono">WIND_SPD</span>
                 <span className="text-sm font-medium text-slate-200">{windKmh.toFixed(1)} km/h</span>
               </div>
             </div>
             {blizzard && (
               <>
                 <div className="w-px h-8 bg-slate-800" />
                 <div className="flex items-center gap-2 text-amber-500 font-mono text-xs animate-pulse">
                   <AlertTriangle className="w-4 h-4" />
                   BLIZZARD_WARNING
                 </div>
               </>
             )}
          </div>
        </div>
      </div>

      {/* Right Side Status Panels */}
      <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
        
        {/* Active Alerts Panel */}
        <div className={`p-4 rounded-lg border ${hasAlerts ? 'bg-red-950/20 border-red-900/50' : 'bg-slate-900 border-slate-800'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold tracking-wide text-slate-300 flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${hasAlerts ? 'text-red-400' : 'text-emerald-400'}`} />
              ACTIVE_ALERTS
            </h3>
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${hasAlerts ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'}`}>
              {activeAlertsList.length}
            </span>
          </div>
          
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
            {!hasAlerts ? (
              <div className="text-sm text-slate-500 font-mono py-2 text-center">NO_ACTIVE_ALERTS</div>
            ) : (
              activeAlertsList.map(alert => (
                <div key={alert.id} className="p-3 bg-slate-950 rounded border border-slate-800 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-400 font-mono">
                    <AlertTriangle className="w-3 h-3" />
                    {alert.severity}
                  </div>
                  <div className="text-sm text-slate-200">{alert.title}</div>
                  {alert.message && <div className="text-xs text-slate-400">{alert.message}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Energy Summary Panel */}
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex flex-col">
          <h3 className="text-sm font-semibold tracking-wide text-slate-300 flex items-center gap-2 mb-4">
            <BatteryCharging className="w-4 h-4 text-cyan-400" />
            ENERGY_DATALINK
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-500 font-mono mb-1">GENERATION</span>
              <span className="text-lg font-bold text-emerald-400">{genKw.toFixed(1)} <span className="text-xs text-slate-500">kW</span></span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-500 font-mono mb-1">CONSUMPTION</span>
              <span className="text-lg font-bold text-amber-400">{consKw.toFixed(1)} <span className="text-xs text-slate-500">kW</span></span>
            </div>
          </div>
          
          <div className="bg-slate-950 p-4 rounded border border-slate-800 flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-mono text-xs">BATTERY_LEVEL</span>
              <span className="text-slate-200 font-mono font-bold">{batteryLvl.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${batteryLvl < 20 ? 'bg-red-500' : batteryLvl < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, batteryLvl))}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-slate-800">
              <span className="text-slate-400 font-mono text-xs">NET_BALANCE</span>
              <span className={`font-mono font-bold ${netKw < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {netKw > 0 ? '+' : ''}{netKw.toFixed(1)} kW
              </span>
            </div>
          </div>
        </div>

        {/* What-If Scenario Runner (Demo) */}
        <ScenarioRunner stationId={stationId} />

      </div>
    </div>
  );
};
