import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import { getStationDashboard } from '../api/stations';
import { Zap, Sun, Wind, Battery, Fuel, Activity, ShieldCheck, Play, ArrowDownToLine, ArrowUpFromLine, Sparkles } from 'lucide-react';
import { CommandPreviewModal } from '../components/operations/CommandPreviewModal';
import EnergyFlowDiagram from '../components/energy/EnergyFlowDiagram';
import GSAPLiveOscillator from '../components/energy/GSAPLiveOscillator';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';
import GSAPFlipDetailModal, { type DetailCardData } from '../components/dashboard/GSAPFlipDetailModal';
import type { CommandRequest } from '../api/types';

export const EnergySystems = ({ stationId }: { stationId: number }) => {
  const [activeRequest, setActiveRequest] = useState<CommandRequest | null>(null);
  const [detailItem, setDetailItem] = useState<DetailCardData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-energy-item',
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

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  const energy = dashboard.energy;
  const equipment = dashboard.equipment || [];
  const gen1 = equipment.find((e: any) => e.name === 'Generator 1');
  const gen2 = equipment.find((e: any) => e.name === 'Generator 2');
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
    const g2 = dashboard.equipment?.find((e: any) => e.equipment_type === 'GENERATOR' && e.name.includes('2'));
    const targetGenId = g2?.id || (Number(stationId) === 1 ? 2 : 9);
    setActiveRequest({
      command_type: 'START_GENERATOR',
      target_type: 'EQUIPMENT',
      target_id: targetGenId,
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

  // Inspect generator card
  const inspectDieselGenerators = () => {
    const gen = gen1 || gen2;
    setDetailItem({
      type: 'generator',
      title: 'Primary Diesel Genset-1 & Genset-2',
      subtitle: 'Synchronized Arctic Diesel Microgrid Generators',
      category: 'PRIMARY POWER ASSET',
      status: dieselKw > 0 ? 'RUNNING' : 'STANDBY',
      healthScore: gen?.health_score ?? 100,
      primaryValue: dieselKw,
      primaryUnit: 'kW',
      primaryLabel: 'CURRENT OUTPUT',
      secondaryValue: gen?.efficiency ? `${gen.efficiency}%` : 'N/A',
      secondaryLabel: 'EFFICIENCY',
      metrics: [
        { label: 'TEMP', value: gen?.temperature != null ? `${gen.temperature} °C` : 'N/A' },
        { label: 'RUNTIME', value: gen?.runtime_hours != null ? `${gen.runtime_hours} hrs` : 'N/A' },
      ],
      specs: [
        { key: 'MANUFACTURER', value: 'Cummins Polar Power 250kVA' },
        { key: 'FUEL GRADE', value: 'Arctic Kerosene / Low-Pour Diesel' },
        { key: 'LAST MAINT.', value: gen?.last_maintenance || 'Unknown' },
      ],
      diagnosticCodes: [
        gen?.status === 'RUNNING' ? 'DTC-00: NORMAL RUNNING' : 'DTC-01: STANDBY',
      ],
      recommendedAction:
        dieselKw === 0
          ? 'Generator is in standby. In microgrid deficit, click START_BACKUP_GEN to synchronize.'
          : 'Genset load distribution optimal.',
      lastServiceDate: gen?.last_maintenance || 'N/A',
      actions: [
        {
          label: dieselKw > 0 ? 'INITIATE ROUTINE DIAGNOSTIC' : 'DISPATCH BACKUP GEN-2',
          actionName: dieselKw > 0 ? 'RUN_DIAGNOSTIC' : 'START_GENERATOR',
          tone: 'primary',
        },
      ],
    });
  };

  // Inspect solar PV
  const inspectSolarPV = () => {
    const eq = equipment.find((e: any) => e.name.includes('Solar'));
    setDetailItem({
      type: 'generator',
      title: 'Bifacial Polar Photovoltaic Array',
      subtitle: 'Albedo-Enhanced Solar Tracking System',
      category: 'RENEWABLE GENERATION',
      status: solarKw > 0 ? 'ACTIVE' : 'STANDBY',
      healthScore: eq?.health_score ?? 100,
      primaryValue: solarKw,
      primaryUnit: 'kW',
      primaryLabel: 'SOLAR POWER',
      secondaryValue: eq?.efficiency ? `${eq.efficiency}%` : 'N/A',
      secondaryLabel: 'EFFICIENCY',
      metrics: [
        { label: 'PANEL TEMP', value: eq?.temperature != null ? `${eq.temperature} °C` : 'N/A' },
      ],
      specs: [
        { key: 'ARRAY CAPACITY', value: '60.0 kW Peak' },
        { key: 'PANEL TYPE', value: 'N-Type TOPCon Dual-Glass' },
        { key: 'LAST MAINT.', value: eq?.last_maintenance || 'Unknown' },
      ],
      diagnosticCodes: ['MPPT_STATUS: PEAK_TRACKING', 'GROUND_FAULT: NONE'],
      recommendedAction: 'Solar array tracking active.',
      lastServiceDate: eq?.last_maintenance || 'N/A',
    });
  };

  // Inspect wind turbines
  const inspectWindTurbines = () => {
    const eq = equipment.find((e: any) => e.name.includes('Wind'));
    setDetailItem({
      type: 'generator',
      title: 'Katabatic Polar Wind Turbine Array',
      subtitle: 'Ruggedized Vertical-Axis High-Wind Turbines',
      category: 'RENEWABLE GENERATION',
      status: (eq?.status as any) || 'STANDBY',
      healthScore: eq?.health_score ?? 100,
      primaryValue: 0.0,
      primaryUnit: 'kW',
      primaryLabel: 'WIND POWER',
      secondaryValue: eq?.efficiency ? `${eq.efficiency}%` : 'N/A',
      secondaryLabel: 'EFFICIENCY',
      metrics: [
        { label: 'TEMP', value: eq?.temperature != null ? `${eq.temperature} °C` : 'N/A' },
      ],
      specs: [
        { key: 'RATED POWER', value: '45.0 kW (at 45 km/h)' },
        { key: 'TURBINE DESIGN', value: 'Omnidirectional Polar Darrieus' },
        { key: 'LAST MAINT.', value: eq?.last_maintenance || 'Unknown' },
      ],
      diagnosticCodes: ['STANDBY: WIND BELOW CUT-IN'],
      recommendedAction: 'Will automatically engage as Katabatic winds rise.',
      lastServiceDate: eq?.last_maintenance || 'N/A',
    });
  };

  // Inspect battery storage
  const inspectBattery = () => {
    const eq = equipment.find((e: any) => e.name.includes('Battery') || e.equipment_type === 'STORAGE');
    setDetailItem({
      type: 'generator',
      title: 'Microgrid LiFePO4 Energy Storage Bank',
      subtitle: 'Containerized Thermal-Regulated Battery Energy Storage (BESS)',
      category: 'ENERGY STORAGE SYSTEM',
      status: batteryPct > 20 ? 'ONLINE' : 'WARNING',
      healthScore: eq?.health_score ?? Math.round(batteryPct),
      primaryValue: batteryPct,
      primaryUnit: '%',
      primaryLabel: 'STATE OF CHARGE',
      secondaryValue: `${batteryPower >= 0 ? '+' : ''}${batteryPower.toFixed(1)} kW`,
      secondaryLabel: batteryPower >= 0 ? 'CHARGING RATE' : 'DISCHARGE RATE',
      metrics: [
        { label: 'NOMINAL CAP', value: '400 kWh' },
        { label: 'AVAILABLE', value: `${((batteryPct / 100) * 400).toFixed(0)} kWh` },
        { label: 'TEMP', value: eq?.temperature != null ? `${eq.temperature} °C` : 'N/A' },
      ],
      specs: [
        { key: 'CHEMISTRY', value: 'Lithium Iron Phosphate (LiFePO4)' },
        { key: 'LAST MAINT.', value: eq?.last_maintenance || 'Unknown' },
      ],
      diagnosticCodes: ['BMS: NOMINAL'],
      recommendedAction:
        batteryPct < 30
          ? 'Battery reserves below 30%. Start auxiliary diesel generator to recharge buffer.'
          : 'State of charge optimal. Battery buffer ready to absorb load swings.',
      lastServiceDate: eq?.last_maintenance || 'N/A',
    });
  };

  // Inspect fuel reserves
  const inspectFuel = () => {
    setDetailItem({
      type: 'supply',
      title: 'Station Polar Fuel Tank Farm',
      subtitle: 'Double-Walled Cryogenic Insulated Arctic Diesel Fuel',
      category: 'CONSUMABLE STORAGE',
      status: fuelPct > 30 ? 'ONLINE' : 'WARNING',
      healthScore: Math.round(fuelPct),
      primaryValue: fuelPct,
      primaryUnit: '%',
      primaryLabel: 'FUEL LEVEL',
      secondaryValue: '180 Days',
      secondaryLabel: 'RUNWAY ENVELOPE',
      runwayDays: 180,
      metrics: [
        { label: 'TOTAL VOLUME', value: '120,000 L' },
        { label: 'CURRENT LEVEL', value: `${Math.round((fuelPct / 100) * 120000).toLocaleString()} L` },
      ],
      specs: [
        { key: 'FUEL TYPE', value: 'Jet A-1 / Arctic Grade-A Diesel' },
        { key: 'STORAGE CELLS', value: '4 x 30,000L Insulated Tanks' },
      ],
      diagnosticCodes: ['LEAK_SENSORS: 0x00 OK'],
      recommendedAction: 'Reserves sufficient for wintering mission. Scheduled inspection before April blizzard season.',
      lastServiceDate: 'Unknown',
      actions: [
        {
          label: 'FILE RESUPPLY NOTIFICATION',
          actionName: 'NOTIFY_LOGISTICS',
          tone: 'primary',
        },
      ],
    });
  };

  const nonCriticalLoad = dashboard.loads?.filter(l => l.category === 'NON_CRITICAL' && l.enabled).reduce((acc, l) => acc + l.current_power_kw, 0) || 0;
  const highPriorityLoad = dashboard.loads?.filter(l => l.category === 'HIGH_PRIORITY' && l.enabled).reduce((acc, l) => acc + l.current_power_kw, 0) || 0;

  return (
    <div ref={containerRef} className="flex flex-col gap-6 max-w-6xl mx-auto h-full overflow-auto pr-2 custom-scrollbar pb-10">
      <div className="gsap-energy-item flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-slate-800 flex items-center gap-3">
            <Zap className="w-6 h-6 text-amber-600" />
            MICROGRID_ENERGY_CENTER
          </h1>
          <p className="text-slate-500 text-sm mt-1">Real-time power generation, battery energy storage, and fuel telemetry. Click any card to inspect 3D Flip Diagnostics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <GSAPLiveOscillator nominalHz={50.0} color="#06b6d4" />
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono">
            GRID_STATUS: <span className={!isEmergency ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{gridStatus}</span>
          </div>
        </div>
      </div>

      {/* Live power flow schematic */}
      <div className="gsap-energy-item">
        <EnergyFlowDiagram energy={energy} loads={dashboard.loads} />
      </div>

      {isEmergency && (
        <div className="gsap-energy-item p-4 bg-red-50 border border-red-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
          <div>
            <div className="text-red-600 font-bold font-mono text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              MICROGRID DEFICIT DETECTED: <GSAPNumberTicker value={Math.abs(netKw)} decimals={1} suffix=" kW" /> SHORTAGE
            </div>
            <div className="text-xs text-red-700 mt-1">
              Station generators are offline or overloaded. Battery bank is discharging to support baseline loads.
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button 
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

      {/* Primary KPI Grid (All Clickable with Detail Card Inspection) */}
      <div className="gsap-energy-item grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={inspectDieselGenerators}
          className="group text-left bg-white border border-slate-200 hover:border-emerald-400 p-4 rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono w-full">
            <span className="group-hover:text-emerald-600 font-bold">TOTAL_GENERATION</span>
            <Zap className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 font-mono my-2">
            <GSAPNumberTicker value={genKw} decimals={1} /> <span className="text-sm text-slate-500">kW</span>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-2.5 py-1.5 text-xs text-slate-600 font-mono flex items-center justify-between w-full">
            <span>Diesel: {dieselKw.toFixed(1)} kW</span>
            <span className="text-[10px] text-emerald-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">INSPECT ↗</span>
          </div>
        </button>

        <button
          onClick={inspectDieselGenerators}
          className="group text-left bg-white border border-slate-200 hover:border-amber-400 p-4 rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono w-full">
            <span className="group-hover:text-amber-600 font-bold">TOTAL_DEMAND</span>
            <Activity className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-bold text-amber-600 font-mono my-2">
            <GSAPNumberTicker value={consKw} decimals={1} /> <span className="text-sm text-slate-500">kW</span>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50/40 px-2.5 py-1.5 text-xs text-slate-600 font-mono flex items-center justify-between w-full">
            <span>Life Support + HVAC</span>
            <span className="text-[10px] text-amber-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">INSPECT ↗</span>
          </div>
        </button>

        <button
          onClick={inspectBattery}
          className="group text-left bg-white border border-slate-200 hover:border-cyan-400 p-4 rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono w-full">
            <span className="group-hover:text-cyan-600 font-bold">BATTERY_STORAGE</span>
            <Battery className="w-4 h-4 text-cyan-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-bold text-cyan-600 font-mono my-2">
            <GSAPNumberTicker value={batteryPct} decimals={1} suffix="%" />
          </div>
          <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 px-2.5 py-1.5 text-xs text-slate-600 font-mono flex items-center justify-between w-full">
            <span>{batteryPower >= 0 ? 'Charging' : 'Discharging'}</span>
            <span className="text-[10px] text-cyan-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">INSPECT ↗</span>
          </div>
        </button>

        <button
          onClick={inspectFuel}
          className="group text-left bg-white border border-slate-200 hover:border-purple-400 p-4 rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono w-full">
            <span className="group-hover:text-purple-600 font-bold">FUEL_RESERVES</span>
            <Fuel className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-bold text-purple-600 font-mono my-2">
            <GSAPNumberTicker value={fuelPct} decimals={1} suffix="%" />
          </div>
          <div className="rounded-lg border border-purple-100 bg-purple-50/40 px-2.5 py-1.5 text-xs text-slate-600 font-mono flex items-center justify-between w-full">
            <span>Runway: ~180 Days</span>
            <span className="text-[10px] text-purple-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">INSPECT ↗</span>
          </div>
        </button>
      </div>

      {/* Generation Sources Breakdown (Clickable with Compact Detail Card Popups) */}
      <div className="gsap-energy-item grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Solar PV Card */}
        <button
          onClick={inspectSolarPV}
          className="group text-left bg-white border border-slate-200 hover:border-amber-400 p-5 rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-700 group-hover:text-amber-600 font-bold font-mono">
                <Sun className="w-4 h-4 text-amber-600" />
                SOLAR_PV_ARRAY
              </div>
              <span className="text-xs font-mono text-emerald-600 font-bold">ACTIVE</span>
            </div>
            <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/30 to-white p-3">
              <div className="text-2xl font-bold font-mono text-slate-800">
                <GSAPNumberTicker value={solarKw} decimals={1} /> kW
              </div>
              <p className="text-xs text-slate-500 mt-1">Station photovoltaic panels tracking seasonal solar flux.</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Efficiency: 98.4%</span>
            <span className="font-bold text-cyan-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <Sparkles size={12} /> DETAILS ↗
            </span>
          </div>
        </button>

        {/* Wind Turbine Card */}
        <button
          onClick={inspectWindTurbines}
          className="group text-left bg-white border border-slate-200 hover:border-cyan-400 p-5 rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-700 group-hover:text-cyan-600 font-bold font-mono">
                <Wind className="w-4 h-4 text-cyan-600" />
                WIND_TURBINE_ARRAY
              </div>
              <span className="text-xs font-mono text-slate-500 font-bold">STANDBY</span>
            </div>
            <div className="rounded-xl border border-cyan-100 bg-gradient-to-br from-cyan-50/30 to-white p-3">
              <div className="text-2xl font-bold font-mono text-slate-800">0.0 kW</div>
              <p className="text-xs text-slate-500 mt-1">Katabatic polar wind turbines configured for high-wind modes.</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Cut-in: 18 km/h</span>
            <span className="font-bold text-cyan-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <Sparkles size={12} /> DETAILS ↗
            </span>
          </div>
        </button>

        {/* Diesel Generator Card */}
        <button
          onClick={inspectDieselGenerators}
          className="group text-left bg-white border border-slate-200 hover:border-emerald-400 p-5 rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-700 group-hover:text-emerald-600 font-bold font-mono">
                <Zap className="w-4 h-4 text-emerald-600" />
                DIESEL_GENERATORS
              </div>
              <span className={`text-xs font-mono font-bold ${dieselKw > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {dieselKw > 0 ? 'SYNCHRONIZED' : 'OFFLINE'}
              </span>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/30 to-white p-3">
              <div className="text-2xl font-bold font-mono text-slate-800">
                <GSAPNumberTicker value={dieselKw} decimals={1} /> kW
              </div>
              <p className="text-xs text-slate-500 mt-1">Continuous baseline primary microgrid power generation.</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Health: 92%</span>
            <span className="font-bold text-cyan-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <Sparkles size={12} /> DETAILS ↗
            </span>
          </div>
        </button>
      </div>

      {/* Interactive Operations Quick Controls */}
      <div className="gsap-energy-item bg-white border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col gap-4">
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
            className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-amber-500/50 rounded-xl flex items-center justify-between transition-all group"
          >
            <div className="text-left">
              <div className="text-xs font-bold font-mono text-slate-700 group-hover:text-amber-600">SHED NON-CRITICAL</div>
              <div className="text-[10px] text-slate-500">Selected Groups (-{nonCriticalLoad.toFixed(1)} kW)</div>
            </div>
            <ArrowDownToLine className="w-4 h-4 text-slate-500 group-hover:text-amber-600" />
          </button>

          <button 
            onClick={() => handleShedLoad('HIGH_PRIORITY')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-red-300 rounded-xl flex items-center justify-between transition-all group"
          >
            <div className="text-left">
              <div className="text-xs font-bold font-mono text-slate-700 group-hover:text-red-600">SHED HIGH PRIORITY</div>
              <div className="text-[10px] text-slate-500">Selected Groups (-{highPriorityLoad.toFixed(1)} kW)</div>
            </div>
            <ArrowDownToLine className="w-4 h-4 text-slate-500 group-hover:text-red-600" />
          </button>

          <button 
            onClick={() => handleRestoreLoad('ALL')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-emerald-300 rounded-xl flex items-center justify-between transition-all group"
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

      {/* GSAP 3D Flip Card Popup Modal */}
      <GSAPFlipDetailModal
        data={detailItem}
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        onAction={(action) => {
          if (action === 'START_GENERATOR') {
            handleStartBackup();
          }
        }}
      />
    </div>
  );
};
