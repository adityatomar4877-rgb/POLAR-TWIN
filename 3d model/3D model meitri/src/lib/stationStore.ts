import { create } from 'zustand'
import { BASE_STATUS, type SystemStatus } from './stationSystems'
import type { StationAlert } from './alertEngine'
import type { EnvironmentState, FaultFlags, Mitigations } from './telemetry'
import { NO_MITIGATIONS } from './telemetry'
import type { PredictiveMetrics } from './predictiveEngine'
import type { AiInsight } from './aiPredictiveEngine'
import { backendState, runBackendScenario, resetBackendScenario } from './backend'

/** Map local demo presets to backend scenario + custom conditions. */
const PRESET_TO_BACKEND: Record<ScenarioId, { scenario: string; conditions: Record<string, any> | null }> = {
  A: { scenario: 'NORMAL_OPERATION', conditions: null },
  B: {
    scenario: 'EXTREME_COLD',
    conditions: { temperature_c: -52, wind_speed_kmh: 115, solar_factor: 0.1, blizzard_warning: true, load_modifier_kw: 35 },
  },
  C: {
    scenario: 'FUEL_SHORTAGE',
    conditions: { fuel_percentage: 12, fuel_burn_multiplier: 1.8 },
  },
  D: {
    scenario: 'EQUIPMENT_DEGRADATION',
    conditions: null,
  },
}

/** Fire-and-forget: inject the preset into the live backend simulation. */
function injectBackendScenario(id: ScenarioId): void {
  const sid = backendState.stationId
  if (sid == null || !backendState.connected) return
  const { scenario, conditions } = PRESET_TO_BACKEND[id]
  runBackendScenario(sid, scenario, conditions).catch(() => {})
}

function resetBackendScenarioIfConnected(): void {
  const sid = backendState.stationId
  if (sid == null || !backendState.connected) return
  resetBackendScenario(sid).catch(() => {})
}

/** Overview = default campus framing, inspect = facility framed, free = user took manual control. */
export type ViewMode = 'overview' | 'inspect' | 'free'

/** Viewport visualization layer (Phase 4). */
export type VisualMode = 'standard' | 'thermal' | 'utilities' | 'night'

/** Weather lighting preset (Phase 4). */
export type Weather = 'clear' | 'blizzard'

/** Mission demo presets (Phase 5). */
export type ScenarioId = 'A' | 'B' | 'C' | 'D'

/** Conversational copilot transcript entry (Phase 6). */
export interface CopilotMessage {
  role: 'user' | 'copilot'
  text: string
  at: string
}

export const SCENARIO_META: Record<ScenarioId, { label: string; description: string }> = {
  A: { label: 'NOMINAL MIDSUMMER', description: 'All green, full autonomy, low generator load' },
  B: { label: 'WINTER DEEP FREEZE', description: 'Blizzard + polar night, max heating, trace-heating strain' },
  C: { label: 'FUEL PIPELINE LEAK', description: 'Pressure drop, critical alert, red pulse, accelerated fuel loss' },
  D: { label: 'GEN BEARING WEAR', description: 'High vibration RMS, elevated EGT, backup-unit recommendation' },
}

// Unified mission operations state: selection/hover/view (P3), visual modes
// (P4), alerts, predictive metrics and scenario control (P5).
export interface StationState {
  selectedSystemId: string | null
  hoveredSystemId: string | null
  viewMode: ViewMode
  visualMode: VisualMode
  weather: Weather
  statusOverrides: Record<string, SystemStatus>
  /** Live backend equipment status (lower precedence than manual overrides). */
  backendStatusOverrides: Record<string, SystemStatus>
  // Phase 5 mission state
  alerts: StationAlert[]
  alertLog: StationAlert[]
  predictive: PredictiveMetrics | null
  environment: EnvironmentState | null
  scenario: ScenarioId | null
  faults: FaultFlags
  missionTick: number
  alertsOpen: boolean
  // Phase 6 autonomous operations state
  aiInsights: AiInsight[]
  mitigations: Mitigations
  sopProgress: Record<string, number>
  copilotOpen: boolean
  copilotMessages: CopilotMessage[]
  whatIfOpen: boolean
  reportOpen: boolean
  sopModalId: string | null
  activeStation: 'bharati' | 'maitri'
  setActiveStation: (station: 'bharati' | 'maitri') => void
  selectSystem: (id: string) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void
  setViewMode: (mode: ViewMode) => void
  setVisualMode: (mode: VisualMode) => void
  setWeather: (weather: Weather) => void
  setStatusOverride: (id: string, status: SystemStatus) => void
  setBackendStatusOverrides: (overrides: Record<string, SystemStatus>) => void
  resetStatusOverrides: () => void
  setAlerts: (active: StationAlert[], resolved: StationAlert[]) => void
  acknowledgeAlert: (id: string) => void
  muteAlert: (id: string) => void
  setPredictive: (m: PredictiveMetrics) => void
  applyScenario: (id: ScenarioId) => void
  clearScenario: () => void
  toggleAlertsDrawer: (open?: boolean) => void
  bumpTick: () => void
  // Phase 6 actions
  setAiInsights: (insights: AiInsight[]) => void
  setMitigation: (key: keyof Mitigations, value: boolean) => void
  setSopProgress: (sopId: string, executedCount: number) => void
  toggleCopilot: (open?: boolean) => void
  addCopilotMessage: (msg: Omit<CopilotMessage, 'at'>) => void
  clearCopilot: () => void
  toggleWhatIf: (open?: boolean) => void
  toggleReport: (open?: boolean) => void
  openSopModal: (sopId: string | null) => void
  closeAllOverlays: () => void
}

export const useStationStore = create<StationState>((set) => ({
  selectedSystemId: null,
  hoveredSystemId: null,
  viewMode: 'overview',
  visualMode: 'standard',
  weather: 'clear',
  statusOverrides: {},
  backendStatusOverrides: {},
  alerts: [],
  alertLog: [],
  predictive: null,
  environment: null,
  scenario: null,
  faults: { fuelLeak: false, genBearing: false },
  missionTick: 0,
  alertsOpen: false,
  aiInsights: [],
  mitigations: { ...NO_MITIGATIONS },
  sopProgress: {},
  copilotOpen: false,
  copilotMessages: [],
  whatIfOpen: false,
  reportOpen: false,
  sopModalId: null,
  activeStation: 'bharati',
  setActiveStation: (station) => set({ activeStation: station, selectedSystemId: null, viewMode: 'overview' }),
  selectSystem: (id) => set({ selectedSystemId: id, viewMode: 'inspect' }),
  clearSelection: () => set({ selectedSystemId: null, viewMode: 'overview' }),
  setHovered: (id) => set({ hoveredSystemId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setVisualMode: (mode) => set({ visualMode: mode }),
  setWeather: (weather) => set({ weather }),
  setStatusOverride: (id, status) =>
    set((state) => ({ statusOverrides: { ...state.statusOverrides, [id]: status } })),
  setBackendStatusOverrides: (overrides) => set({ backendStatusOverrides: overrides }),
  resetStatusOverrides: () => set({ statusOverrides: {} }),
  setAlerts: (active, resolved) =>
    set((state) => ({
      alerts: active,
      alertLog: [...resolved, ...state.alertLog].slice(0, 60),
    })),
  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
      alertLog: state.alertLog.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),
  muteAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, muted: !a.muted } : a)),
    })),
  setPredictive: (m) => set({ predictive: m }),
  applyScenario: (id) => {
    injectBackendScenario(id)
    switch (id) {
      case 'A':
        set({
          scenario: 'A',
          visualMode: 'standard',
          weather: 'clear',
          faults: { fuelLeak: false, genBearing: false },
          statusOverrides: { BharatiUtilityArea: 'nominal', BharatiFuelStation: 'nominal' },
        })
        break
      case 'B':
        set({
          scenario: 'B',
          visualMode: 'night',
          weather: 'blizzard',
          faults: { fuelLeak: false, genBearing: false },
          statusOverrides: {},
        })
        break
      case 'C':
        set({
          scenario: 'C',
          visualMode: 'standard',
          weather: 'clear',
          faults: { fuelLeak: true, genBearing: false },
          statusOverrides: {},
        })
        break
      case 'D':
        set({
          scenario: 'D',
          visualMode: 'standard',
          weather: 'clear',
          faults: { fuelLeak: false, genBearing: true },
          statusOverrides: {},
        })
        break
    }
  },
  clearScenario: () => {
    resetBackendScenarioIfConnected()
    set({ scenario: null, faults: { fuelLeak: false, genBearing: false }, statusOverrides: {} })
  },
  toggleAlertsDrawer: (open) =>
    set((state) => ({ alertsOpen: open ?? !state.alertsOpen })),
  bumpTick: () => set((state) => ({ missionTick: state.missionTick + 1 })),
  setAiInsights: (insights) => set({ aiInsights: insights }),
  setMitigation: (key, value) =>
    set((state) => ({ mitigations: { ...state.mitigations, [key]: value } })),
  setSopProgress: (sopId, executedCount) =>
    set((state) => ({ sopProgress: { ...state.sopProgress, [sopId]: executedCount } })),
  toggleCopilot: (open) => set((state) => ({ copilotOpen: open ?? !state.copilotOpen })),
  addCopilotMessage: (msg) =>
    set((state) => ({
      copilotMessages: [...state.copilotMessages, { ...msg, at: new Date().toISOString() }].slice(-40),
    })),
  clearCopilot: () => set({ copilotMessages: [] }),
  toggleWhatIf: (open) => set((state) => ({ whatIfOpen: open ?? !state.whatIfOpen })),
  toggleReport: (open) => set((state) => ({ reportOpen: open ?? !state.reportOpen })),
  openSopModal: (sopId) => set({ sopModalId: sopId }),
  closeAllOverlays: () =>
    set({ whatIfOpen: false, reportOpen: false, sopModalId: null, copilotOpen: false, alertsOpen: false }),
}))

/**
 * Effective status precedence: manual override > active alert severity >
 * catalog base. Drives rail badges, detail panel and the 3D beacons.
 */
export function effectiveStatusOf(
  s: Pick<StationState, 'statusOverrides' | 'backendStatusOverrides' | 'alerts'>,
  id: string,
): SystemStatus {
  const override = s.statusOverrides[id]
  if (override) return override
  const backend = s.backendStatusOverrides[id]
  if (backend) return backend
  let warned = false
  for (const a of s.alerts) {
    if (a.systemId !== id || a.autoResolved) continue
    if (a.severity === 'CRITICAL') return 'critical'
    if (a.severity === 'WARNING') warned = true
  }
  if (warned) return 'elevated'
  return BASE_STATUS[id] ?? 'nominal'
}

export const selectEffectiveStatus = (id: string) => (s: StationState): SystemStatus =>
  effectiveStatusOf(s, id)
