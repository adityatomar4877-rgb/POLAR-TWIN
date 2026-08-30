import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runSimulationScenario, resetSimulation, getActiveConditions } from '../../api/simulation';
import { getStationEquipment } from '../../api/stations';
import { 
  AlertOctagon, 
  CheckCircle, 
  Sliders, 
  Thermometer, 
  Wind, 
  Zap, 
  Sun, 
  RotateCcw, 
  Eye, 
  Flame, 
  BatteryCharging, 
  ChevronDown, 
  ChevronUp,
  Snowflake,
  Clock
} from 'lucide-react';
import type { CustomConditions, ScenarioResponse } from '../../api/types';
import InteractiveHoverButton from '../motion/InteractiveHoverButton';

interface PresetOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  conditions: CustomConditions;
  durationMinutes: number;
}

const PRESETS: PresetOption[] = [
  {
    id: 'CUSTOM',
    name: 'Custom Sandbox',
    badge: 'USER CONFIG',
    description: 'Freely calibrate ambient temperatures, microgrid loads, generator states, and fuel reserves.',
    durationMinutes: 60,
    conditions: {
      temperature_c: -25.0,
      wind_speed_kmh: 35.0,
      solar_factor: 0.5,
      blizzard_warning: false,
      load_modifier_kw: 0.0,
      generator_1_online: true,
      generator_2_online: false,
      battery_percentage: 85.0,
      fuel_percentage: 82.0,
      fuel_burn_multiplier: 1.0,
    },
  },
  {
    id: 'GENERATOR_FAILURE',
    name: 'Generator 1 Failure',
    badge: 'FAULT TRIP',
    description: 'Primary diesel generator abruptly goes offline, forcing total reliance on battery energy storage.',
    durationMinutes: 45,
    conditions: {
      temperature_c: -18.0,
      wind_speed_kmh: 32.0,
      solar_factor: 0.4,
      blizzard_warning: false,
      load_modifier_kw: 0.0,
      generator_1_online: false,
      generator_2_online: false,
      battery_percentage: 80.0,
      fuel_percentage: 80.0,
      fuel_burn_multiplier: 1.0,
    },
  },
  {
    id: 'EXTREME_BLIZZARD',
    name: 'Severe Polar Blizzard',
    badge: 'WEATHER CRISIS',
    description: '-52°C deep freeze with 115 km/h gale force blizzard winds, triggering heavy building heat loss.',
    durationMinutes: 90,
    conditions: {
      temperature_c: -52.0,
      wind_speed_kmh: 115.0,
      solar_factor: 0.1,
      blizzard_warning: true,
      load_modifier_kw: 35.0,
      generator_1_online: true,
      generator_2_online: false,
      battery_percentage: 75.0,
      fuel_percentage: 70.0,
      fuel_burn_multiplier: 1.6,
    },
  },
  {
    id: 'POLAR_NIGHT_SURGE',
    name: 'Polar Night & Peak Load',
    badge: 'HIGH DEMAND',
    description: 'Zero solar PV generation coupled with deep ice core drilling power surge (+55 kW electrical load).',
    durationMinutes: 60,
    conditions: {
      temperature_c: -28.0,
      wind_speed_kmh: 42.0,
      solar_factor: 0.0,
      blizzard_warning: false,
      load_modifier_kw: 55.0,
      generator_1_online: true,
      generator_2_online: true,
      battery_percentage: 65.0,
      fuel_percentage: 75.0,
      fuel_burn_multiplier: 1.35,
    },
  },
  {
    id: 'CRITICAL_FUEL_SHORTAGE',
    name: 'Emergency Fuel Depletion',
    badge: 'LOGISTICS CRISIS',
    description: 'Main fuel reserve drops to critical 12% threshold during delayed sea/air resupply.',
    durationMinutes: 120,
    conditions: {
      temperature_c: -22.0,
      wind_speed_kmh: 40.0,
      solar_factor: 0.3,
      blizzard_warning: false,
      load_modifier_kw: 0.0,
      generator_1_online: true,
      generator_2_online: false,
      battery_percentage: 60.0,
      fuel_percentage: 12.0,
      fuel_burn_multiplier: 1.8,
    },
  },
];

export const ScenarioRunner = ({ stationId }: { stationId: number }) => {
  const queryClient = useQueryClient();

  const [selectedPresetId, setSelectedPresetId] = useState<string>('CUSTOM');
  const [showConfig, setShowConfig] = useState<boolean>(true);
  const [result, setResult] = useState<ScenarioResponse | null>(null);

  // Active editable condition state
  const [tempC, setTempC] = useState<number>(-25.0);
  const [windKmh, setWindKmh] = useState<number>(35.0);
  const [solarFactor, setSolarFactor] = useState<number>(0.5);
  const [blizzardWarning, setBlizzardWarning] = useState<boolean>(false);
  const [loadModKw, setLoadModKw] = useState<number>(0.0);
  const [gen1Online, setGen1Online] = useState<boolean>(true);
  const [gen2Online, setGen2Online] = useState<boolean>(false);
  const [batteryPct, setBatteryPct] = useState<number>(85.0);
  const [fuelPct, setFuelPct] = useState<number>(82.0);
  const [fuelBurnMult, setFuelBurnMult] = useState<number>(1.0);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [targetEquipmentId, setTargetEquipmentId] = useState<number | undefined>(undefined);

  // Fetch station equipment for optional target selection
  const { data: equipmentList } = useQuery({
    queryKey: ['equipment', stationId],
    queryFn: () => getStationEquipment(stationId),
  });

  // Query active conditions on the backend
  const { data: activeConditionData, refetch: refetchActive } = useQuery({
    queryKey: ['activeConditions', stationId],
    queryFn: () => getActiveConditions(stationId),
    refetchInterval: 5000,
  });

  // Handler for picking a preset
  const handleSelectPreset = (preset: PresetOption) => {
    setSelectedPresetId(preset.id);
    const c = preset.conditions;
    if (c.temperature_c !== undefined) setTempC(c.temperature_c);
    if (c.wind_speed_kmh !== undefined) setWindKmh(c.wind_speed_kmh);
    if (c.solar_factor !== undefined) setSolarFactor(c.solar_factor);
    if (c.blizzard_warning !== undefined) setBlizzardWarning(c.blizzard_warning);
    if (c.load_modifier_kw !== undefined) setLoadModKw(c.load_modifier_kw);
    if (c.generator_1_online !== undefined) setGen1Online(c.generator_1_online);
    if (c.generator_2_online !== undefined) setGen2Online(c.generator_2_online);
    if (c.battery_percentage !== undefined) setBatteryPct(c.battery_percentage);
    if (c.fuel_percentage !== undefined) setFuelPct(c.fuel_percentage);
    if (c.fuel_burn_multiplier !== undefined) setFuelBurnMult(c.fuel_burn_multiplier);
    setDurationMinutes(preset.durationMinutes);
  };

  // Compile current condition payload
  const currentConditions: CustomConditions = {
    temperature_c: tempC,
    wind_speed_kmh: windKmh,
    solar_factor: solarFactor,
    blizzard_warning: blizzardWarning,
    load_modifier_kw: loadModKw,
    generator_1_online: gen1Online,
    generator_2_online: gen2Online,
    battery_percentage: batteryPct,
    fuel_percentage: fuelPct,
    fuel_burn_multiplier: fuelBurnMult,
    target_equipment_id: targetEquipmentId,
  };

  // Mutation for running simulation
  const simMutation = useMutation({
    mutationFn: ({ applyToLive }: { applyToLive: boolean }) =>
      runSimulationScenario(
        stationId,
        selectedPresetId === 'CUSTOM' ? 'CUSTOM' : selectedPresetId,
        currentConditions,
        applyToLive,
        durationMinutes,
        targetEquipmentId
      ),
    onSuccess: (data) => {
      setResult(data);
      if (data.applied_to_simulation) {
        queryClient.invalidateQueries({ queryKey: ['equipment', stationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
        queryClient.invalidateQueries({ queryKey: ['alerts', stationId] });
        queryClient.invalidateQueries({ queryKey: ['recommendations', stationId] });
        queryClient.invalidateQueries({ queryKey: ['simulation-status'] });
        refetchActive();
      }
    },
  });

  // Mutation for reset
  const resetMutation = useMutation({
    mutationFn: resetSimulation,
    onSuccess: () => {
      setResult(null);
      handleSelectPreset(PRESETS[0]);
      queryClient.invalidateQueries({ queryKey: ['equipment', stationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
      queryClient.invalidateQueries({ queryKey: ['alerts', stationId] });
      queryClient.invalidateQueries({ queryKey: ['recommendations', stationId] });
      queryClient.invalidateQueries({ queryKey: ['simulation-status'] });
      refetchActive();
    },
  });

  const isCustomActive = activeConditionData?.active_conditions != null || 
    (activeConditionData?.active_scenario && activeConditionData.active_scenario !== 'NORMAL_OPERATION');

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 sm:p-6 flex flex-col gap-5 w-full shadow-sm backdrop-blur-sm transition-all relative overflow-hidden">
      {/* Top Header with Module Title and Active Status Badge */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 relative">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-violet-50 border border-violet-200 rounded-lg text-violet-600 shadow-xs">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-wider flex items-center gap-2 font-mono">
              WHAT-IF SIMULATION ENGINE
            </h2>
            <p className="text-slate-500 text-[11px] font-mono">
              CONFIGURABLE CONDITIONS & REAL-TIME PHYSICS PROCESSOR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCustomActive ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-md text-[11px] font-mono text-amber-700 font-semibold animate-pulse shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              CONDITIONS_INJECTED
            </div>
          ) : (
            <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-[11px] font-mono text-emerald-700 font-semibold flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              NOMINAL_BASELINE
            </div>
          )}

          <button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            title="Reset to Normal Nominal Operation"
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors shadow-xs"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Preset Quick Selectors */}
      <div>
        <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2 font-semibold">
          SCENARIO TEMPLATES & CONDITIONS
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 ${
                  isSelected
                    ? 'bg-cyan-50/80 border-cyan-400 text-slate-900 shadow-xs ring-1 ring-cyan-300/50'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-[11px] font-bold font-mono truncate ${isSelected ? 'text-cyan-800' : 'text-slate-800'}`}>
                    {preset.name}
                  </span>
                </div>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold w-fit ${
                  isSelected ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' : 'bg-white border border-slate-200 text-slate-500'
                }`}>
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expandable Custom Condition Sliders & Inputs */}
      <div className="border border-slate-200 bg-slate-50/40 rounded-xl overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className="w-full px-4 py-3 flex items-center justify-between bg-slate-50/90 hover:bg-slate-100 text-xs font-mono font-bold text-slate-800 border-b border-slate-200 transition-colors"
        >
          <span className="flex items-center gap-2 font-bold text-cyan-700">
            <Sliders className="w-3.5 h-3.5" />
            FINE-TUNE CUSTOM CONDITIONS
          </span>
          {showConfig ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {showConfig && (
          <div className="p-4 space-y-4 text-xs font-mono text-slate-700 animate-in fade-in">
            {/* Section 1: Environment */}
            <div>
              <div className="text-[10px] text-cyan-700 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5" /> ENVIRONMENTAL METRICS
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Temperature */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">AMBIENT TEMP</span>
                    <span className={`font-bold font-mono ${tempC <= -40 ? 'text-cyan-700' : 'text-slate-900'}`}>{tempC}°C</span>
                  </div>
                  <input
                    type="range"
                    min="-65"
                    max="10"
                    step="1"
                    value={tempC}
                    onChange={(e) => {
                      setTempC(parseFloat(e.target.value));
                      setSelectedPresetId('CUSTOM');
                    }}
                    className="w-full accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>-65°C</span>
                    <span>-25°C</span>
                    <span>+10°C</span>
                  </div>
                </div>

                {/* Wind Speed */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Wind className="w-3 h-3 text-cyan-600" /> WIND SPEED
                    </span>
                    <span className={`font-bold font-mono ${windKmh >= 90 ? 'text-amber-600' : 'text-slate-900'}`}>{windKmh} km/h</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="160"
                    step="5"
                    value={windKmh}
                    onChange={(e) => {
                      setWindKmh(parseFloat(e.target.value));
                      setSelectedPresetId('CUSTOM');
                    }}
                    className="w-full accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>0 km/h</span>
                    <span>80 km/h</span>
                    <span>160 km/h</span>
                  </div>
                </div>
              </div>

              {/* Blizzard and Solar Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {/* Solar Irradiance Factor */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Sun className="w-3 h-3 text-amber-500" /> SOLAR IRRADIANCE
                    </span>
                    <span className="font-bold text-amber-600 font-mono">{(solarFactor * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={solarFactor}
                    onChange={(e) => {
                      setSolarFactor(parseFloat(e.target.value));
                      setSelectedPresetId('CUSTOM');
                    }}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>0% (Polar Night)</span>
                    <span>100% (Full Sun)</span>
                  </div>
                </div>

                {/* Blizzard Warning Toggle */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-800 font-bold flex items-center gap-1.5">
                      <Snowflake className="w-3.5 h-3.5 text-cyan-600" /> BLIZZARD WARNING
                    </span>
                    <span className="text-[9px] text-slate-400">Forces zero visibility & storm alarms</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBlizzardWarning(!blizzardWarning);
                      setSelectedPresetId('CUSTOM');
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors shadow-xs ${
                      blizzardWarning 
                        ? 'bg-red-600 text-white shadow-xs hover:bg-red-700' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {blizzardWarning ? 'ACTIVE' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Microgrid Power Demands & Generation */}
            <div>
              <div className="text-[10px] text-amber-700 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> MICROGRID LOAD & DIESEL DISPATCH
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Additional Load Modifier */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">LOAD SURGE / SHED</span>
                    <span className={`font-bold font-mono ${loadModKw > 0 ? 'text-amber-600' : loadModKw < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {loadModKw > 0 ? `+${loadModKw}` : loadModKw} kW
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="100"
                    step="5"
                    value={loadModKw}
                    onChange={(e) => {
                      setLoadModKw(parseFloat(e.target.value));
                      setSelectedPresetId('CUSTOM');
                    }}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>-40 kW (Shed)</span>
                    <span>0 kW</span>
                    <span>+100 kW (Surge)</span>
                  </div>
                </div>

                {/* Battery Initial % */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <BatteryCharging className="w-3 h-3 text-emerald-600" /> BATTERY STORAGE
                    </span>
                    <span className={`font-bold font-mono ${batteryPct < 25 ? 'text-red-600' : 'text-emerald-600'}`}>{batteryPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={batteryPct}
                    onChange={(e) => {
                      setBatteryPct(parseFloat(e.target.value));
                      setSelectedPresetId('CUSTOM');
                    }}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-200 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>10% (Crit)</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Generator States */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-800">GENERATOR 1</div>
                    <div className="text-[9px] text-slate-400 font-mono">Primary 120kW</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGen1Online(!gen1Online);
                      setSelectedPresetId('CUSTOM');
                    }}
                    className={`px-2.5 py-1 text-[10px] rounded-lg font-bold font-mono transition-colors shadow-xs ${
                      gen1Online 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {gen1Online ? 'ONLINE' : 'OFFLINE'}
                  </button>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-800">GENERATOR 2</div>
                    <div className="text-[9px] text-slate-400 font-mono">Backup 120kW</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGen2Online(!gen2Online);
                      setSelectedPresetId('CUSTOM');
                    }}
                    className={`px-2.5 py-1 text-[10px] rounded-lg font-bold font-mono transition-colors shadow-xs ${
                      gen2Online 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {gen2Online ? 'ONLINE' : 'STANDBY'}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: Fuel & Duration */}
            <div>
              <div className="text-[10px] text-purple-700 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> FUEL RESERVES & RUNTIME DURATION
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Fuel Percentage */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-medium">FUEL LEVEL</span>
                    <span className={`font-bold font-mono ${fuelPct < 20 ? 'text-red-600' : 'text-purple-700'}`}>{fuelPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="2"
                    value={fuelPct}
                    onChange={(e) => {
                      setFuelPct(parseFloat(e.target.value));
                      setSelectedPresetId('CUSTOM');
                    }}
                    className="w-full accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded"
                  />
                </div>

                {/* Fuel Burn Multiplier */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-medium">BURN RATE</span>
                    <span className="font-bold text-amber-600 font-mono">{fuelBurnMult.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.1"
                    value={fuelBurnMult}
                    onChange={(e) => {
                      setFuelBurnMult(parseFloat(e.target.value));
                      setSelectedPresetId('CUSTOM');
                    }}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 rounded"
                  />
                </div>

                {/* Duration Minutes */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-600" /> DURATION
                    </span>
                    <span className="font-bold text-cyan-700 font-mono">{durationMinutes}m</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="240"
                    step="15"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Optional Target Equipment Selection */}
            {equipmentList && equipmentList.length > 0 && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium">TARGET EQUIPMENT SPECIFIC FAULT:</span>
                <select
                  value={targetEquipmentId ?? ''}
                  onChange={(e) => setTargetEquipmentId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-800 shadow-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  <option value="">None (Station Wide)</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      #{eq.id} - {eq.name} ({eq.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Command Buttons: Dry-Run Analyze vs Live Inject */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InteractiveHoverButton
          type="button"
          onClick={() => simMutation.mutate({ applyToLive: false })}
          disabled={simMutation.isPending}
          loading={simMutation.isPending && !simMutation.variables?.applyToLive}
          variant="cyan"
          icon={Eye}
          text="ANALYZE WHAT-IF IMPACT"
          className="w-full py-3.5 shadow-xs font-bold"
        />

        <InteractiveHoverButton
          type="button"
          onClick={() => simMutation.mutate({ applyToLive: true })}
          disabled={simMutation.isPending}
          loading={simMutation.isPending && simMutation.variables?.applyToLive}
          variant="hazard"
          icon={AlertOctagon}
          text="INJECT INTO LIVE TWIN"
          className="w-full py-3.5 shadow-xs font-bold"
        />
      </div>

      {/* Analytical Projection / Simulation Results Display */}
      {result && (
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs animate-in fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-800">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {result.applied_to_simulation ? 'CONDITIONS INJECTED INTO LIVE CYCLE' : 'WHAT-IF IMPACT ANALYSIS REPORT'}
            </div>
            <span className="text-[10px] font-mono text-slate-400 font-medium">
              {result.station_code} • {durationMinutes}m window
            </span>
          </div>

          {/* Metric Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">ENERGY DEFICIT</span>
              <span className={`text-base font-bold ${Number(result.impact?.energy_deficit_kw ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {Number(result.impact?.energy_deficit_kw ?? 0).toFixed(1)} kW
              </span>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">PROJECTED DEMAND</span>
              <span className="text-base font-bold text-slate-800">
                {Number(result.impact?.projected_consumption_kw ?? 0).toFixed(1)} kW
              </span>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">BATTERY DELTA</span>
              <span className={`text-base font-bold ${Number(result.impact?.battery_drop_percent ?? 0) > 20 ? 'text-red-600' : Number(result.impact?.battery_drop_percent ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {Number(result.impact?.battery_drop_percent ?? 0) > 0 ? `-${Number(result.impact?.battery_drop_percent).toFixed(1)}%` : '0.0%'}
              </span>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">GRID RISK INDEX</span>
              <span className={`text-sm font-bold tracking-wide ${
                String(result.impact?.grid_stability_risk).includes('CRITICAL') || String(result.impact?.grid_stability_risk).includes('HIGH')
                  ? 'text-red-600'
                  : String(result.impact?.grid_stability_risk).includes('ELEVATED')
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}>
                {String(result.impact?.grid_stability_risk ?? 'NOMINAL')}
              </span>
            </div>
          </div>

          {/* Secondary Telemetry Breakdown */}
          {result.impact?.projected_generation_kw !== undefined && (
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] bg-slate-50/60 p-3 rounded-xl border border-slate-200 text-slate-600">
              <div>
                <span className="text-[9px] text-slate-400 font-bold block">PROJ. GENERATION</span>
                <span className="font-bold text-slate-800">{Number(result.impact.projected_generation_kw).toFixed(1)} kW</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold block">FINAL BATTERY SoC</span>
                <span className={`font-bold ${Number(result.impact.projected_final_battery_percent ?? 100) < 30 ? 'text-red-600' : 'text-slate-800'}`}>
                  {Number(result.impact.projected_final_battery_percent ?? 0).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold block">FINAL FUEL LEVEL</span>
                <span className={`font-bold ${Number(result.impact.fuel_reserve_percent ?? 100) < 25 ? 'text-red-600' : 'text-slate-800'}`}>
                  {Number(result.impact.fuel_reserve_percent ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Affected Systems & Recommendations */}
          <div className="space-y-3 text-xs pt-1">
            {result.affected_systems && result.affected_systems.length > 0 && (
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5 font-bold">
                  AFFECTED SUBSYSTEMS ({result.affected_systems.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.affected_systems.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-mono font-semibold">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.recommendations && result.recommendations.length > 0 && (
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5 font-bold">
                  OPERATIONAL MITIGATION PROTOCOLS
                </span>
                <div className="space-y-1 bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
                  {result.recommendations.map((r, i) => (
                    <div key={i} className="text-amber-900 text-[11px] flex items-start gap-1.5 leading-snug">
                      <span className="text-amber-600 font-bold shrink-0">›</span>
                      <span>{r.replace(/^Recommendation:\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {result.active_until && (
            <p className="mt-3 font-mono text-[10px] tracking-wider text-slate-500 font-medium">
              SCENARIO ACTIVE UNTIL {new Date(result.active_until).toLocaleTimeString()} UTC±LOCAL · WATCH THE TWIN REACT LIVE
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ScenarioRunner;
