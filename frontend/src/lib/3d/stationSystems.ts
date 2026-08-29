// Catalog of monitorable station systems for the mission operations dashboard.
// Ids match the StationGroup ids used across the 3D scene so telemetry and
// interaction can be bound per system.
//
// NOTE ON NODE MAPPING: the twin's seven interactable 3D nodes are the source
// of truth. The roof comms mast is instrumented under BharatiMainBuilding,
// and the outdoor container yard carries hull-icing sensors under
// BharatiContainerModules (there is no separate helipad structure in the
// current scene).

import { FACILITIES } from './stationLayout'
import { MAITRI_FACILITIES } from './maitriLayout'

export type SystemStatus = 'nominal' | 'elevated' | 'critical' | 'maintenance'

export interface TelemetryChannel {
  key: string
  label: string
  unit: string
  /** Nominal operating point around which the simulation random-walks. */
  base: number
  /** Typical step size per tick (same unit). */
  jitter: number
  min: number
  max: number
  decimals: number
  /** Anomaly thresholds (alertEngine). */
  warnBelow?: number
  warnAbove?: number
  critBelow?: number
  critAbove?: number
}

export interface StationSystem {
  id: string
  label: string
  category: 'Habitat' | 'Energy' | 'Water' | 'Logistics' | 'Support'
  status: SystemStatus
  summary: string
  anchor: { x: number; z: number }
  channels: TelemetryChannel[]
}

export const STATION_SYSTEMS: StationSystem[] = [
  {
    id: 'BharatiMainBuilding',
    label: 'Bharati Main Building',
    category: 'Habitat',
    status: 'nominal',
    summary:
      'Primary three-storey habitat and laboratory block on a raised structural support system. Hosts command communications, the roof comms mast, living quarters and the main science deck.',
    anchor: FACILITIES.mainBuilding,
    channels: [
      { key: 'hvacLoad', label: 'HVAC thermal load', unit: 'kW', base: 52, jitter: 2.4, min: 20, max: 210, decimals: 0 },
      { key: 'indoorTemp', label: 'Indoor temp', unit: '°C', base: 20.4, jitter: 0.14, min: 14, max: 26, decimals: 1, warnBelow: 18, warnAbove: 22, critBelow: 16, critAbove: 24 },
      { key: 'co2', label: 'CO₂ level', unit: 'ppm', base: 640, jitter: 16, min: 420, max: 1500, decimals: 0, warnAbove: 900, critAbove: 1100 },
      { key: 'airPressure', label: 'Life-support air pressure', unit: 'hPa', base: 1014, jitter: 0.9, min: 950, max: 1040, decimals: 1, warnBelow: 995, critBelow: 980 },
      { key: 'hullStrain', label: 'Structural wind strain', unit: 'με', base: 60, jitter: 9, min: 0, max: 700, decimals: 0, warnAbove: 380, critAbove: 450 },
      { key: 'satcomSnr', label: 'SATCOM C-band SNR', unit: 'dB', base: 9.6, jitter: 0.35, min: 0, max: 14, decimals: 1, warnBelow: 6, critBelow: 4 },
      { key: 'satcomLatency', label: 'Uplink/downlink latency', unit: 'ms', base: 250, jitter: 26, min: 120, max: 2400, decimals: 0, warnAbove: 800, critAbove: 1400 },
      { key: 'radomeHeater', label: 'Radome heater draw', unit: 'A', base: 2.2, jitter: 0.16, min: 0, max: 8, decimals: 2 },
    ],
  },
  {
    id: 'BharatiFuelFarm',
    label: 'Fuel Farm',
    category: 'Energy',
    status: 'nominal',
    summary:
      'Cluster of bulk Arctic-grade storage tanks feeding the station generators. Level sensors and bund leak detectors are polled continuously.',
    anchor: FACILITIES.fuelFarm,
    channels: [
      { key: 'tankLevel', label: 'Active tank level', unit: '%', base: 78, jitter: 0.02, min: 0, max: 95, decimals: 2, warnBelow: 25, critBelow: 15 },
      { key: 'transferPressure', label: 'Transfer line pressure', unit: 'bar', base: 4.6, jitter: 0.12, min: 0, max: 7, decimals: 2, warnBelow: 2.2, critBelow: 1.5 },
      { key: 'fuelTemp', label: 'Fuel temperature', unit: '°C', base: -6, jitter: 0.3, min: -30, max: 8, decimals: 1 },
      { key: 'burnRate', label: 'Daily burn rate', unit: 'L/h', base: 24, jitter: 0.7, min: 4, max: 140, decimals: 1 },
      { key: 'leakPpm', label: 'Leak detector', unit: 'PPM', base: 2, jitter: 0.5, min: 0, max: 200, decimals: 1, warnAbove: 25, critAbove: 60 },
    ],
  },
  {
    id: 'BharatiFuelStation',
    label: 'Fuel Station',
    category: 'Energy',
    status: 'elevated',
    summary:
      'Dispensing point between the fuel farm and vehicle fleet. A transfer line is under elevated pressure monitoring after the last convoy refill.',
    anchor: FACILITIES.fuelStation,
    channels: [
      { key: 'dispensePressure', label: 'Dispensing line pressure', unit: 'bar', base: 4.2, jitter: 0.14, min: 0, max: 7, decimals: 2, warnBelow: 2, critBelow: 1.2 },
      { key: 'hoseTraceTemp', label: 'Hose trace heating', unit: '°C', base: 9, jitter: 0.4, min: -15, max: 25, decimals: 1, warnBelow: 3, critBelow: 0.5 },
      { key: 'dispensedToday', label: 'Dispensed today', unit: 'L', base: 1840, jitter: 18, min: 0, max: 6000, decimals: 0 },
    ],
  },
  {
    id: 'BharatiWaterPump',
    label: 'Seawater & Water Pump Infrastructure',
    category: 'Water',
    status: 'nominal',
    summary:
      'Seawater intake pump house, trace-heated pipelines and the reverse-osmosis freshwater treatment chain supplying the station.',
    anchor: FACILITIES.waterPump,
    channels: [
      { key: 'intakeFlow', label: 'Seawater intake flow', unit: 'L/min', base: 240, jitter: 7, min: 0, max: 420, decimals: 0 },
      { key: 'traceTemp', label: 'Trace heating conductor temp', unit: '°C', base: 8.5, jitter: 0.3, min: -8, max: 22, decimals: 1, warnBelow: 3, critBelow: 0.5 },
      { key: 'pipePressure', label: 'Pipeline pressure', unit: 'bar', base: 3.4, jitter: 0.09, min: 0, max: 6, decimals: 2, warnBelow: 2.5, critBelow: 1.8 },
      { key: 'roFilterDiff', label: 'RO filter differential', unit: 'kPa', base: 56, jitter: 1.6, min: 20, max: 160, decimals: 1, warnAbove: 85, critAbove: 110 },
      { key: 'freshReserve', label: 'Freshwater reserve', unit: '%', base: 82, jitter: 0.01, min: 0, max: 98, decimals: 2, warnBelow: 30, critBelow: 15 },
    ],
  },
  {
    id: 'BharatiSummerCamp',
    label: 'Summer Camp',
    category: 'Habitat',
    status: 'nominal',
    summary:
      'Modular summer accommodation blocks for expedition-season personnel overflow, with independent heating loops and emergency heat backup.',
    anchor: FACILITIES.summerCamp,
    channels: [
      { key: 'campPower', label: 'Power draw', unit: 'kW', base: 30, jitter: 1.4, min: 6, max: 90, decimals: 0 },
      { key: 'campTemp', label: 'Internal temp', unit: '°C', base: 19.2, jitter: 0.22, min: 0, max: 26, decimals: 1, warnBelow: 12, critBelow: 5 },
      { key: 'campOccupancy', label: 'Occupancy', unit: 'pax', base: 11, jitter: 0.35, min: 0, max: 24, decimals: 0 },
      { key: 'emergencyHeat', label: 'Emergency heat status', unit: 'flag', base: 0, jitter: 0.02, min: 0, max: 1, decimals: 0, warnAbove: 0.5 },
    ],
  },
  {
    id: 'BharatiContainerModules',
    label: 'Containerized Modules',
    category: 'Logistics',
    status: 'nominal',
    summary:
      'Standard-container based storage and workshop modules in rows, tracked by RFID. Unheated external hulls are monitored for ice accretion.',
    anchor: FACILITIES.containers,
    channels: [
      { key: 'modulesTracked', label: 'Modules tracked', unit: 'units', base: 38, jitter: 0.08, min: 30, max: 44, decimals: 0 },
      { key: 'crateMoves', label: 'Crate moves today', unit: 'ops', base: 57, jitter: 2.2, min: 0, max: 160, decimals: 0 },
      { key: 'zoneTemp', label: 'Storage zone temp', unit: '°C', base: -9, jitter: 0.5, min: -30, max: 6, decimals: 1 },
      { key: 'hullIcing', label: 'Hull icing index', unit: '%', base: 8, jitter: 1.1, min: 0, max: 100, decimals: 1, warnAbove: 55, critAbove: 80 },
    ],
  },
  {
    id: 'BharatiUtilityArea',
    label: 'Utility & Generator Bay',
    category: 'Support',
    status: 'maintenance',
    summary:
      'Three 120 kW gensets with heat-recovery plant and heavy-vehicle bay. Generator 2 is in scheduled maintenance until the next weather window.',
    anchor: FACILITIES.utility,
    channels: [
      { key: 'genOutput', label: 'Active generator output', unit: 'kW', base: 150, jitter: 3.4, min: 40, max: 360, decimals: 0 },
      { key: 'engineRpm', label: 'Engine RPM', unit: 'rpm', base: 1500, jitter: 9, min: 1200, max: 1800, decimals: 0 },
      { key: 'lubeOil', label: 'Lube oil pressure', unit: 'bar', base: 3.2, jitter: 0.07, min: 0, max: 6, decimals: 2, warnBelow: 2.4, critBelow: 1.8 },
      { key: 'vibration', label: 'Vibration RMS', unit: 'mm/s', base: 1.7, jitter: 0.09, min: 0, max: 12, decimals: 2, warnAbove: 4.2, critAbove: 6.5 },
      { key: 'exhaustTemp', label: 'Exhaust gas temp', unit: '°C', base: 78, jitter: 1.4, min: 40, max: 140, decimals: 1, warnAbove: 85, critAbove: 95 },
    ],
  },
  {
    id: 'MaitriMainBuilding',
    label: 'Maitri Main Building',
    category: 'Habitat',
    status: 'nominal',
    summary: 'Long horizontal modular structure on steel stilts containing living quarters and labs.',
    anchor: MAITRI_FACILITIES.mainBuilding,
    channels: [
      { key: 'hvacLoad', label: 'HVAC thermal load', unit: 'kW', base: 45, jitter: 2.1, min: 20, max: 210, decimals: 0 },
      { key: 'indoorTemp', label: 'Indoor temp', unit: '°C', base: 19.5, jitter: 0.2, min: 14, max: 26, decimals: 1, warnBelow: 18, warnAbove: 22, critBelow: 16, critAbove: 24 },
      { key: 'co2', label: 'CO₂ level', unit: 'ppm', base: 580, jitter: 14, min: 420, max: 1500, decimals: 0, warnAbove: 900, critAbove: 1100 },
      { key: 'hullStrain', label: 'Structural wind strain', unit: 'με', base: 75, jitter: 12, min: 0, max: 700, decimals: 0, warnAbove: 380, critAbove: 450 }
    ],
  },
  {
    id: 'MaitriFuelFarm',
    label: 'Maitri Fuel Farm',
    category: 'Energy',
    status: 'nominal',
    summary: 'Fuel storage for Maitri station.',
    anchor: MAITRI_FACILITIES.fuelFarm,
    channels: [
      { key: 'tankLevel', label: 'Active tank level', unit: '%', base: 65, jitter: 0.02, min: 0, max: 95, decimals: 2, warnBelow: 25, critBelow: 15 },
      { key: 'transferPressure', label: 'Transfer line pressure', unit: 'bar', base: 4.2, jitter: 0.1, min: 0, max: 7, decimals: 2, warnBelow: 2.2, critBelow: 1.5 },
      { key: 'fuelTemp', label: 'Fuel temperature', unit: '°C', base: -8, jitter: 0.4, min: -30, max: 8, decimals: 1 }
    ],
  },
  {
    id: 'MaitriFuelStation',
    label: 'Maitri Fuel Station',
    category: 'Energy',
    status: 'nominal',
    summary: 'Fuel dispensing point.',
    anchor: MAITRI_FACILITIES.fuelStation,
    channels: [
      { key: 'dispensePressure', label: 'Dispensing line pressure', unit: 'bar', base: 3.8, jitter: 0.12, min: 0, max: 7, decimals: 2, warnBelow: 2, critBelow: 1.2 },
      { key: 'hoseTraceTemp', label: 'Hose trace heating', unit: '°C', base: 7.5, jitter: 0.4, min: -15, max: 25, decimals: 1, warnBelow: 3, critBelow: 0.5 }
    ],
  },
  {
    id: 'MaitriLakeWaterPumpHouse',
    label: 'Maitri Lake Water Pump House',
    category: 'Water',
    status: 'nominal',
    summary: 'Freshwater infrastructure drawing from Lake Priyadarshini.',
    anchor: MAITRI_FACILITIES.waterPumpHouse,
    channels: [
      { key: 'intakeFlow', label: 'Lake intake flow', unit: 'L/min', base: 180, jitter: 6, min: 0, max: 420, decimals: 0 },
      { key: 'traceTemp', label: 'Trace heating conductor temp', unit: '°C', base: 6.2, jitter: 0.3, min: -8, max: 22, decimals: 1, warnBelow: 3, critBelow: 0.5 },
      { key: 'pipePressure', label: 'Pipeline pressure', unit: 'bar', base: 2.8, jitter: 0.08, min: 0, max: 6, decimals: 2, warnBelow: 2.0, critBelow: 1.5 }
    ],
  },
  {
    id: 'MaitriSummerCamp',
    label: 'Maitri Summer Camp',
    category: 'Habitat',
    status: 'nominal',
    summary: 'Containerized living modules for summer personnel.',
    anchor: MAITRI_FACILITIES.summerCamp,
    channels: [
      { key: 'campPower', label: 'Power draw', unit: 'kW', base: 22, jitter: 1.2, min: 6, max: 90, decimals: 0 },
      { key: 'campTemp', label: 'Internal temp', unit: '°C', base: 18.5, jitter: 0.25, min: 0, max: 26, decimals: 1, warnBelow: 12, critBelow: 5 },
      { key: 'campOccupancy', label: 'Occupancy', unit: 'pax', base: 8, jitter: 0.2, min: 0, max: 24, decimals: 0 }
    ],
  },
  {
    id: 'MaitriUtilityArea',
    label: 'Maitri Utility Area',
    category: 'Support',
    status: 'nominal',
    summary: 'Additional practical infrastructure.',
    anchor: MAITRI_FACILITIES.utilityArea,
    channels: [
      { key: 'genOutput', label: 'Active generator output', unit: 'kW', base: 110, jitter: 2.8, min: 40, max: 360, decimals: 0 },
      { key: 'engineRpm', label: 'Engine RPM', unit: 'rpm', base: 1500, jitter: 8, min: 1200, max: 1800, decimals: 0 },
      { key: 'exhaustTemp', label: 'Exhaust gas temp', unit: '°C', base: 72, jitter: 1.2, min: 40, max: 140, decimals: 1, warnAbove: 85, critAbove: 95 }
    ],
  },
]

const SYSTEM_MAP = new Map(STATION_SYSTEMS.map((s) => [s.id, s]))

export function getStationSystem(id: string): StationSystem | undefined {
  return SYSTEM_MAP.get(id)
}

/** Operator-facing badge text for each underlying telemetry status. */
export const STATUS_BADGE: Record<SystemStatus, string> = {
  nominal: 'OPERATIONAL',
  elevated: 'STANDBY',
  critical: 'CRITICAL',
  maintenance: 'OFFLINE',
}

/** Base (non-overridden, non-alert) status per system id. */
export const BASE_STATUS: Record<string, SystemStatus> = Object.fromEntries(
  STATION_SYSTEMS.map((s) => [s.id, s.status]),
)

/** Plant capacities used by the predictive engine. */
export const PLANT = {
  fuelTankLiters: 120_000,
  waterTankLiters: 80_000,
  gensetCount: 3,
  gensetKw: 120,
  /** Station base load not attributed to instrumented subsystems (kW). */
  auxiliaryLoadKw: 26,
  /** Freshwater consumption at full occupancy (L/h). */
  waterConsumptionLph: 30,
} as const
