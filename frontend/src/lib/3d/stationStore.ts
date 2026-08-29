import { create } from 'zustand'
import { BASE_STATUS, type SystemStatus } from './stationSystems'

export type { SystemStatus } from './stationSystems'

/** Overview = default campus framing, inspect = facility framed, free = user took manual control. */
export type ViewMode = 'overview' | 'inspect' | 'free'

/** Viewport visualization layer. */
export type VisualMode = 'standard' | 'thermal' | 'utilities' | 'night'

/** Weather lighting preset. */
export type Weather = 'clear' | 'blizzard'

/**
 * Minimal alert shape used only by `effectiveStatusOf` to escalate a system's
 * status from a live alert. The full alert engine is not part of the 3D port,
 * so this is intentionally lean; the integration layer may populate it via
 * `setAlerts` to drive beacons / utility flows from backend alerts.
 */
type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO'
export interface StationAlert {
  id: string
  systemId: string
  severity: AlertSeverity
  autoResolved?: boolean
}

// Unified 3D scene state: selection/hover/view (P3) and visual modes (P4).
export interface StationState {
  selectedSystemId: string | null
  hoveredSystemId: string | null
  viewMode: ViewMode
  visualMode: VisualMode
  weather: Weather
  statusOverrides: Record<string, SystemStatus>
  alerts: StationAlert[]
  activeStation: 'bharati' | 'maitri'
  setActiveStation: (station: 'bharati' | 'maitri') => void
  selectSystem: (id: string) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void
  setViewMode: (mode: ViewMode) => void
  setVisualMode: (mode: VisualMode) => void
  setWeather: (weather: Weather) => void
  setStatusOverride: (id: string, status: SystemStatus) => void
  resetStatusOverrides: () => void
  setAlerts: (alerts: StationAlert[]) => void
}

export const useStationStore = create<StationState>((set) => ({
  selectedSystemId: null,
  hoveredSystemId: null,
  viewMode: 'overview',
  visualMode: 'standard',
  weather: 'clear',
  statusOverrides: {},
  alerts: [],
  activeStation: 'bharati',
  setActiveStation: (station) =>
    set({ activeStation: station, selectedSystemId: null, viewMode: 'overview' }),
  selectSystem: (id) => set({ selectedSystemId: id, viewMode: 'inspect' }),
  clearSelection: () => set({ selectedSystemId: null, viewMode: 'overview' }),
  setHovered: (id) => set({ hoveredSystemId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setVisualMode: (mode) => set({ visualMode: mode }),
  setWeather: (weather) => set({ weather }),
  setStatusOverride: (id, status) =>
    set((state) => ({ statusOverrides: { ...state.statusOverrides, [id]: status } })),
  resetStatusOverrides: () => set({ statusOverrides: {} }),
  setAlerts: (alerts) => set({ alerts }),
}))

/**
 * Effective status precedence: manual override > active alert severity >
 * catalog base. Drives the 3D beacons, utility flows and the selection ring.
 */
export function effectiveStatusOf(
  s: Pick<StationState, 'statusOverrides' | 'alerts'>,
  id: string,
): SystemStatus {
  const override = s.statusOverrides[id]
  if (override) return override
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
