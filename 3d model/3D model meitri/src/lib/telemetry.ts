// Mission telemetry engine (Phase 5).
// Deterministic, environment-coupled multi-channel sensor simulation for all
// station systems with a 60-second rolling buffer per channel at 1 Hz.
//
// Physics coupling: ambient temperature and wind (from the active lighting /
// weather preset) drive HVAC load, generator output, fuel burn, trace-heating
// temps, hull strain, icing and SATCOM quality. Scenario fault flags inject
// leak / bearing-degradation signatures on top.

import { STATION_SYSTEMS, PLANT, type TelemetryChannel } from './stationSystems'

export const HISTORY_SECONDS = 60

export interface EnvironmentState {
  ambientTemp: number
  windKts: number
  label: string
  blizzard: boolean
  night: boolean
}

export interface FaultFlags {
  fuelLeak: boolean
  genBearing: boolean
}

/** SOP corrective actions (Phase 6) — each one changes the physics. */
export interface Mitigations {
  fuelPumpCut: boolean
  traceBoost: boolean
  backupGenset: boolean
}

export const NO_MITIGATIONS: Mitigations = {
  fuelPumpCut: false,
  traceBoost: false,
  backupGenset: false,
}

export interface ChannelSample {
  value: number
  history: number[]
}

export type TelemetrySnapshot = Record<string, Record<string, ChannelSample>>

export function environmentFromMode(visualMode: string, weather: string): EnvironmentState {
  const night = visualMode === 'night'
  const blizzard = weather === 'blizzard'
  if (blizzard && night) {
    return { ambientTemp: -38, windKts: 62, label: 'BLIZZARD · POLAR NIGHT', blizzard, night }
  }
  if (blizzard) {
    return { ambientTemp: -19, windKts: 52, label: 'BLIZZARD · WHITEOUT', blizzard, night }
  }
  if (night) {
    return { ambientTemp: -29, windKts: 24, label: 'POLAR NIGHT · DEEP FREEZE', blizzard, night }
  }
  return { ambientTemp: -2.5, windKts: 15, label: 'MIDSUMMER · CLEAR', blizzard, night }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v)

interface ChannelState {
  def: TelemetryChannel
  rand: () => number
  value: number
  history: number[]
}

/** Per-tick coupling targets computed in dependency order. */
function computeTargets(
  values: TelemetrySnapshot,
  env: EnvironmentState,
  faults: FaultFlags,
  tick: number,
  mit: Mitigations,
): TelemetrySnapshot {
  const heatDemand = Math.max(0, 18 - env.ambientTemp)
  const t: TelemetrySnapshot = {}

  // ---- Summer Camp (feeds later demand calcs) ----
  const campPower = 22 + heatDemand * 0.95 + env.windKts * 0.08
  const emergencyHeat = env.ambientTemp < -30 ? 1 : 0
  t.BharatiSummerCamp = {
    campPower: { value: campPower, history: [] },
    campTemp: { value: 19.6 - heatDemand * 0.02 - (env.blizzard ? 1.1 : 0), history: [] },
    campOccupancy: { value: env.night ? 12 : 9, history: [] },
    emergencyHeat: { value: emergencyHeat, history: [] },
  }

  // ---- Main Building (incl. roof comms mast) ----
  const hvac = 34 + heatDemand * 2.3 + env.windKts * 0.35
  const occupancy = env.night ? 46 : 41
  t.BharatiMainBuilding = {
    hvacLoad: { value: hvac, history: [] },
    indoorTemp: { value: 20.4 - heatDemand * 0.012, history: [] },
    co2: { value: 590 + occupancy * 3.4, history: [] },
    airPressure: { value: 1016 - hvac * 0.015, history: [] },
    hullStrain: { value: 26 + Math.pow(env.windKts, 1.62) * 0.85, history: [] },
    satcomSnr: { value: 10.2 - (env.blizzard ? 3.6 : 0) - env.windKts * 0.022, history: [] },
    satcomLatency: { value: 235 + (env.blizzard ? 430 : 0) + env.windKts * 1.4, history: [] },
    radomeHeater: { value: 2.1 + Math.max(0, -12 - env.ambientTemp) * 0.045, history: [] },
  }

  // ---- Fuel Farm (burn integrates into tank level) ----
  const leakActive = faults.fuelLeak && !mit.fuelPumpCut
  const burn =
    7 + hvac * 0.085 + campPower * 0.06 + (leakActive ? 95 : 0) + env.windKts * 0.05
  const tankNow = values.BharatiFuelFarm?.tankLevel.value ?? 78
  const tankNext = clamp(tankNow - burn / (PLANT.fuelTankLiters / 100) * (leakActive ? 2.2 : 1), 0, 95)
  t.BharatiFuelFarm = {
    tankLevel: { value: tankNext, history: [] },
    transferPressure: {
      value: (faults.fuelLeak && !mit.fuelPumpCut ? 1.2 : 4.55) + Math.sin(tick / 9) * 0.08,
      history: [],
    },
    fuelTemp: { value: env.ambientTemp * 0.32 - 2.5, history: [] },
    burnRate: { value: burn, history: [] },
    leakPpm: { value: leakActive ? 78 : mit.fuelPumpCut ? 2.4 : 1.8 + env.windKts * 0.012, history: [] },
  }

  // ---- Fuel Station ----
  const v = values.BharatiFuelStation
  t.BharatiFuelStation = {
    dispensePressure: { value: 4.2 - Math.max(0, 2 - (v?.hoseTraceTemp.value ?? 9)) * 0.7, history: [] },
    hoseTraceTemp: { value: 12 + env.ambientTemp * 0.22 - (env.blizzard ? 2.4 : 0), history: [] },
    dispensedToday: { value: (v?.dispensedToday.value ?? 1840) + 0.35, history: [] },
  }

  // ---- Water Pump ----
  const flow = 265 - heatDemand * 1.4 - env.windKts * 0.9
  const trace = 11 + env.ambientTemp * 0.24 - (env.blizzard ? 2.2 : 0) - env.windKts * 0.012 + (mit.traceBoost ? 6.5 : 0)
  const freshNow = values.BharatiWaterPump?.freshReserve.value ?? 82
  const netFlow = flow > 140 ? 0.004 : -PLANT.waterConsumptionLph / (PLANT.waterTankLiters / 100) / 36
  t.BharatiWaterPump = {
    intakeFlow: { value: flow, history: [] },
    traceTemp: { value: trace, history: [] },
    pipePressure: { value: 3.4 - Math.max(0, 2.2 - trace) * 0.75, history: [] },
    roFilterDiff: { value: 54 + Math.max(0, 200 - flow) * 0.06, history: [] },
    freshReserve: { value: clamp(freshNow + netFlow, 0, 98), history: [] },
  }

  // ---- Container Modules ----
  const icingNow = values.BharatiContainerModules?.hullIcing.value ?? 8
  const icingTarget = env.blizzard ? 74 : env.night ? 34 : 8
  t.BharatiContainerModules = {
    modulesTracked: { value: 38, history: [] },
    crateMoves: { value: env.night ? 12 : 58, history: [] },
    zoneTemp: { value: env.ambientTemp * 0.62 + 2, history: [] },
    hullIcing: { value: icingNow + (icingTarget - icingNow) * 0.06, history: [] },
  }

  // ---- Utility & Generator Bay ----
  const containersLoad = 14
  const demand = hvac + campPower + containersLoad + PLANT.auxiliaryLoadKw
  t.BharatiUtilityArea = {
    genOutput: { value: demand, history: [] },
    engineRpm: { value: 1500 + (demand - 150) * 0.14, history: [] },
    lubeOil: { value: 3.25 - (faults.genBearing && !mit.backupGenset ? 0.9 : 0), history: [] },
    vibration: {
      value:
        1.55 +
        (faults.genBearing ? (mit.backupGenset ? 0.35 : 3.6) : 0) +
        Math.abs(demand - 160) * 0.006 +
        env.windKts * 0.008,
      history: [],
    },
    exhaustTemp: { value: 52 + demand * 0.16 + (faults.genBearing && !mit.backupGenset ? 16 : 0), history: [] },
  }

  // ---- Maitri Systems (Coupled Physics) ----
  const maitriHvac = 28 + heatDemand * 2.1 + env.windKts * 0.28
  t.MaitriMainBuilding = {
    hvacLoad: { value: maitriHvac, history: [] },
    indoorTemp: { value: 19.5 - heatDemand * 0.015, history: [] },
    co2: { value: 540 + (env.night ? 28 : 20) * 3.2, history: [] },
    hullStrain: { value: 32 + Math.pow(env.windKts, 1.58) * 0.88, history: [] },
  }

  const maitriCampPower = 18 + heatDemand * 0.8 + env.windKts * 0.06
  t.MaitriSummerCamp = {
    campPower: { value: maitriCampPower, history: [] },
    campTemp: { value: 18.8 - heatDemand * 0.02 - (env.blizzard ? 1.2 : 0), history: [] },
    campOccupancy: { value: env.night ? 10 : 8, history: [] },
  }

  const maitriBurn = 5.5 + maitriHvac * 0.07 + maitriCampPower * 0.05 + env.windKts * 0.04
  const maitriTankNow = values.MaitriFuelFarm?.tankLevel.value ?? 65
  const maitriTankNext = clamp(maitriTankNow - maitriBurn / (80_000 / 100), 0, 95)
  t.MaitriFuelFarm = {
    tankLevel: { value: maitriTankNext, history: [] },
    transferPressure: { value: 4.2 + Math.sin(tick / 8) * 0.06, history: [] },
    fuelTemp: { value: env.ambientTemp * 0.35 - 3.0, history: [] },
  }

  t.MaitriFuelStation = {
    dispensePressure: { value: 3.8 + Math.sin(tick / 10) * 0.05, history: [] },
    hoseTraceTemp: { value: 10 + env.ambientTemp * 0.2 - (env.blizzard ? 2.0 : 0), history: [] },
  }

  const lakeFlow = 210 - heatDemand * 1.2 - env.windKts * 0.7
  const lakeTrace = 9.5 + env.ambientTemp * 0.22 - (env.blizzard ? 2.0 : 0) + (mit.traceBoost ? 6.0 : 0)
  t.MaitriLakeWaterPumpHouse = {
    intakeFlow: { value: lakeFlow, history: [] },
    traceTemp: { value: lakeTrace, history: [] },
    pipePressure: { value: 2.8 - Math.max(0, 2.0 - lakeTrace) * 0.6, history: [] },
  }

  const maitriTotalLoad = maitriHvac + maitriCampPower + 12 + PLANT.auxiliaryLoadKw
  t.MaitriUtilityArea = {
    genOutput: { value: maitriTotalLoad, history: [] },
    engineRpm: { value: 1500 + (maitriTotalLoad - 110) * 0.12, history: [] },
    exhaustTemp: { value: 48 + maitriTotalLoad * 0.18, history: [] },
  }

  return t
}

export class MissionEngine {
  private state: TelemetrySnapshot = {}
  private envNoise = mulberry32(0x51e5)
  private tick = 0

  constructor() {
    for (const system of STATION_SYSTEMS) {
      this.state[system.id] = {}
      for (const def of system.channels) {
        const rand = mulberry32(hashSeed(`${system.id}:${def.key}`))
        this.state[system.id][def.key] = {
          value: def.base,
          history: Array.from({ length: HISTORY_SECONDS }, () => def.base),
          rand,
        } as ChannelState & { rand: () => number }
      }
    }
  }

  /** Advance the whole station by one 1 Hz tick. */
  step(baseEnv: EnvironmentState, faults: FaultFlags, mitigations: Mitigations = NO_MITIGATIONS): EnvironmentState {
    this.tick++
    // Slow deterministic wander on top of the preset environment.
    const env: EnvironmentState = {
      ...baseEnv,
      ambientTemp: baseEnv.ambientTemp + (this.envNoise() - 0.5) * 1.6,
      windKts: Math.max(2, baseEnv.windKts + (this.envNoise() - 0.5) * 5),
    }

    const targets = computeTargets(this.state, env, faults, this.tick, mitigations)
    for (const system of STATION_SYSTEMS) {
      const sysState = this.state[system.id]
      const sysTargets = targets[system.id] || {}
      for (const def of system.channels) {
        const ch = sysState[def.key] as ChannelState & { rand: () => number }
        const target = sysTargets[def.key]?.value ?? def.base
        // Integrated channels (levels/counters) are set directly; the rest
        // relax toward their physics target with per-channel sensor noise.
        if (def.key === 'tankLevel' || def.key === 'freshReserve' || def.key === 'dispensedToday' || def.key === 'hullIcing') {
          ch.value = target
        } else if (def.key === 'emergencyHeat') {
          ch.value = target
        } else {
          const noise = (ch.rand() - 0.5) * 2 * def.jitter
          ch.value = clamp(ch.value + (target - ch.value) * 0.22 + noise, def.min, def.max)
        }
        ch.history.push(ch.value)
        if (ch.history.length > HISTORY_SECONDS) ch.history.shift()
      }
    }
    return env
  }

  snapshot(): TelemetrySnapshot {
    return this.state
  }

  getValue(systemId: string, key: string): number {
    return this.state[systemId]?.[key]?.value ?? 0
  }
}

export const missionEngine = new MissionEngine()

export interface TelemetryReading {
  key: string
  label: string
  unit: string
  decimals: number
  value: number
  formatted: string
  history: number[]
  def: TelemetryChannel
}

/** Formatted readings for one system, straight from the live engine. */
export function readSystem(systemId: string): TelemetryReading[] {
  const system = STATION_SYSTEMS.find((s) => s.id === systemId)
  if (!system) return []
  const state = missionEngine.snapshot()[systemId]
  return system.channels.map((def) => {
    const ch = state[def.key]
    return {
      key: def.key,
      label: def.label,
      unit: def.unit,
      decimals: def.decimals,
      value: ch.value,
      formatted: ch.value.toFixed(def.decimals),
      history: [...ch.history],
      def,
    }
  })
}

export const TELEMETRY_TICK_MS = 1000
