import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runSimulationScenario, resetSimulation, getActiveConditions } from '../../api/simulation';
import { getStationEquipment } from '../../api/stations';
import { 
  Activity, 
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
      refetchActive();
    },
  });

  const isCustomActive = activeConditionData?.active_conditions != null || 
    (activeConditionData?.active_scenario && activeConditionData.active_scenario !== 'NORMAL_OPERATION');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col gap-5 w-full shadow-2xl transition-all">
      {/* Top Header with Module Title and Active Status Badge */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-cyan-950/60 border border-cyan-800/60 rounded-md">
            <Sliders className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 tracking-wider flex items-center gap-2 font-mono">
              WHAT-IF SIMULATION ENGINE
            </h2>
            <p className="text-slate-400 text-[11px] font-mono">
              CONFIGURABLE CONDITIONS & REAL-TIME PHYSICS PROCESSOR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCustomActive ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-800/80 rounded text-[11px] font-mono text-amber-300 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              CONDITIONS_INJECTED
            </div>
          ) : (
            <div className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              NOMINAL_BASELINE
            </div>
          )}

          <button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            title="Reset to Normal Nominal Operation"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Preset Quick Selectors */}
      <div>
        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-2 font-semibold">
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
                className={`p-2.5 rounded border text-left flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500/80 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-[11px] font-bold font-mono truncate ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {preset.name}
                  </span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 w-fit">
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expandable Custom Condition Sliders & Inputs */}
      <div className="border border-slate-800 bg-slate-950/50 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className="w-full px-4 py-2.5 flex items-center justify-between bg-slate-950/90 text-xs font-mono text-slate-300 hover:text-white border-b border-slate-800"
        >
          <span className="flex items-center gap-2 font-bold text-cyan-400">
            <Sliders className="w-3.5 h-3.5" />
            FINE-TUNE CUSTOM CONDITIONS
          </span>
          {showConfig ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showConfig && (
          <div className="p-4 space-y-4 text-xs font-mono text-slate-300 animate-in fade-in">
            {/* Section 1: Environment */}
            <div>
              <div className="text-[10px] text-cyan-400/90 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5" /> ENVIRONMENTAL METRICS
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Temperature */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">AMBIENT TEMP</span>
                    <span className={`font-bold ${tempC <= -40 ? 'text-cyan-400' : 'text-slate-200'}`}>{tempC}°C</span>
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
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>-65°C</span>
                    <span>-25°C</span>
                    <span>+10°C</span>
                  </div>
                </div>

                {/* Wind Speed */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Wind className="w-3 h-3 text-cyan-400" /> WIND SPEED
                    </span>
                    <span className={`font-bold ${windKmh >= 90 ? 'text-amber-400' : 'text-slate-200'}`}>{windKmh} km/h</span>
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
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>0 km/h</span>
                    <span>80 km/h</span>
                    <span>160 km/h</span>
                  </div>
                </div>
              </div>

              {/* Blizzard and Solar Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {/* Solar Irradiance Factor */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Sun className="w-3 h-3 text-amber-400" /> SOLAR IRRADIANCE
                    </span>
                    <span className="font-bold text-amber-300">{(solarFactor * 100).toFixed(0)}%</span>
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
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>0% (Polar Night)</span>
                    <span>100% (Full Sun)</span>
                  </div>
                </div>

                {/* Blizzard Warning Toggle */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-200 font-bold flex items-center gap-1.5">
                      <Snowflake className="w-3.5 h-3.5 text-cyan-300" /> BLIZZARD WARNING
                    </span>
                    <span className="text-[9px] text-slate-400">Forces zero visibility & storm alarms</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBlizzardWarning(!blizzardWarning);
                      setSelectedPresetId('CUSTOM');
                    }}
                    className={`px-3 py-1.5 rounded font-bold transition-colors ${
                      blizzardWarning 
                        ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]' 
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {blizzardWarning ? 'ACTIVE' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Microgrid Power Demands & Generation */}
            <div>
              <div className="text-[10px] text-amber-400/90 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> MICROGRID LOAD & DIESEL DISPATCH
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Additional Load Modifier */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">LOAD SURGE / SHED</span>
                    <span className={`font-bold ${loadModKw > 0 ? 'text-amber-400' : loadModKw < 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
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
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>-40 kW (Shed)</span>
                    <span>0 kW</span>
                    <span>+100 kW (Surge)</span>
                  </div>
                </div>

                {/* Battery Initial % */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <BatteryCharging className="w-3 h-3 text-emerald-400" /> BATTERY STORAGE
                    </span>
                    <span className={`font-bold ${batteryPct < 25 ? 'text-red-400' : 'text-emerald-400'}`}>{batteryPct}%</span>
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
                    className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>10% (Crit)</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Generator States */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-200">GENERATOR 1</div>
                    <div className="text-[9px] text-slate-500">Primary 120kW</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGen1Online(!gen1Online);
                      setSelectedPresetId('CUSTOM');
                    }}
                    className={`px-2.5 py-1 text-[10px] rounded font-bold font-mono transition-colors ${
                      gen1Online 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                        : 'bg-red-950 text-red-400 border border-red-800'
                    }`}
                  >
                    {gen1Online ? 'ONLINE' : 'OFFLINE'}
                  </button>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-200">GENERATOR 2</div>
                    <div className="text-[9px] text-slate-500">Backup 120kW</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGen2Online(!gen2Online);
                      setSelectedPresetId('CUSTOM');
                    }}
                    className={`px-2.5 py-1 text-[10px] rounded font-bold font-mono transition-colors ${
                      gen2Online 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {gen2Online ? 'ONLINE' : 'STANDBY'}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: Fuel & Duration */}
            <div>
              <div className="text-[10px] text-purple-400/90 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> FUEL RESERVES & RUNTIME DURATION
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Fuel Percentage */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">FUEL LEVEL</span>
                    <span className={`font-bold ${fuelPct < 20 ? 'text-red-400' : 'text-purple-300'}`}>{fuelPct}%</span>
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
                    className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                </div>

                {/* Fuel Burn Multiplier */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">BURN RATE</span>
                    <span className="font-bold text-amber-400">{fuelBurnMult.toFixed(1)}x</span>
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
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                </div>

                {/* Duration Minutes */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" /> DURATION
                    </span>
                    <span className="font-bold text-cyan-300">{durationMinutes}m</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="240"
                    step="15"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Optional Target Equipment Selection */}
            {equipmentList && equipmentList.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">TARGET EQUIPMENT SPECIFIC FAULT:</span>
                <select
                  value={targetEquipmentId ?? ''}
                  onChange={(e) => setTargetEquipmentId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
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
        <button
          type="button"
          onClick={() => simMutation.mutate({ applyToLive: false })}
          disabled={simMutation.isPending}
          className="py-3 px-4 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-400 hover:text-cyan-300 border border-cyan-800/60 rounded-lg font-mono font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] disabled:opacity-50"
        >
          {simMutation.isPending && !simMutation.variables?.applyToLive ? (
            <Activity className="w-4 h-4 animate-spin" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
          ANALYZE WHAT-IF IMPACT
        </button>

        <button
          type="button"
          onClick={() => simMutation.mutate({ applyToLive: true })}
          disabled={simMutation.isPending}
          className="py-3 px-4 bg-red-950/50 hover:bg-red-900/70 text-red-400 hover:text-red-300 border border-red-800/60 rounded-lg font-mono font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] disabled:opacity-50"
        >
          {simMutation.isPending && simMutation.variables?.applyToLive ? (
            <Activity className="w-4 h-4 animate-spin" />
          ) : (
            <AlertOctagon className="w-4 h-4" />
          )}
          INJECT INTO LIVE TWIN
        </button>
      </div>

      {/* Analytical Projection / Simulation Results Display */}
      {result && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg animate-in fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              {result.applied_to_simulation ? 'CONDITIONS INJECTED INTO LIVE CYCLE' : 'WHAT-IF IMPACT ANALYSIS REPORT'}
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {result.station_code} • {durationMinutes}m window
            </span>
          </div>

          {/* Metric Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 block">ENERGY DEFICIT</span>
              <span className={`text-base font-bold ${Number(result.impact?.energy_deficit_kw ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {Number(result.impact?.energy_deficit_kw ?? 0).toFixed(1)} kW
              </span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 block">PROJECTED DEMAND</span>
              <span className="text-base font-bold text-slate-200">
                {Number(result.impact?.projected_consumption_kw ?? 0).toFixed(1)} kW
              </span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 block">BATTERY DELTA</span>
              <span className={`text-base font-bold ${Number(result.impact?.battery_drop_percent ?? 0) > 20 ? 'text-red-400' : Number(result.impact?.battery_drop_percent ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {Number(result.impact?.battery_drop_percent ?? 0) > 0 ? `-${Number(result.impact?.battery_drop_percent).toFixed(1)}%` : '0.0%'}
              </span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 block">GRID RISK INDEX</span>
              <span className={`text-sm font-bold tracking-wide ${
                String(result.impact?.grid_stability_risk).includes('CRITICAL') || String(result.impact?.grid_stability_risk).includes('HIGH')
                  ? 'text-red-400'
                  : String(result.impact?.grid_stability_risk).includes('ELEVATED')
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}>
                {String(result.impact?.grid_stability_risk ?? 'NOMINAL')}
              </span>
            </div>
          </div>

          {/* Secondary Telemetry Breakdown */}
          {result.impact?.projected_generation_kw !== undefined && (
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] bg-slate-900/50 p-2 rounded border border-slate-800/60 text-slate-400">
              <div>
                <span className="text-[9px] text-slate-500 block">PROJ. GENERATION</span>
                <span className="font-bold text-slate-200">{Number(result.impact.projected_generation_kw).toFixed(1)} kW</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">FINAL BATTERY SoC</span>
                <span className={`font-bold ${Number(result.impact.projected_final_battery_percent ?? 100) < 30 ? 'text-red-400' : 'text-slate-200'}`}>
                  {Number(result.impact.projected_final_battery_percent ?? 0).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">FINAL FUEL LEVEL</span>
                <span className={`font-bold ${Number(result.impact.fuel_reserve_percent ?? 100) < 25 ? 'text-red-400' : 'text-slate-200'}`}>
                  {Number(result.impact.fuel_reserve_percent ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Affected Systems & Recommendations */}
          <div className="space-y-3 text-xs pt-1">
            {result.affected_systems && result.affected_systems.length > 0 && (
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                  AFFECTED SUBSYSTEMS ({result.affected_systems.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.affected_systems.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-red-950/40 text-red-300 border border-red-900/40 text-[11px] font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.recommendations && result.recommendations.length > 0 && (
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                  OPERATIONAL MITIGATION PROTOCOLS
                </span>
                <div className="space-y-1 bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
                  {result.recommendations.map((r, i) => (
                    <div key={i} className="text-amber-200/90 text-[11px] flex items-start gap-1.5 leading-snug">
                      <span className="text-amber-400 shrink-0">›</span>
                      <span>{r.replace(/^Recommendation:\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
