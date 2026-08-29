// Backend integration layer for the standalone 3D twin.
//
// Replaces the local physics simulation with live FastAPI data: the backend
// is the single source of truth for system status, environment, alerts and
// predictive metrics whenever it is reachable. Channels without a backend
// source hold their last value (they do not random-walk) — i.e. they go dark.
// When the backend is unreachable the original coupled-physics model remains
// available as an offline fallback so the demo is never blank.

import { getStationSystem, PLANT, type SystemStatus } from './stationSystems'
import { stationTimeNow, type AlertSeverity, type StationAlert } from './alertEngine'
import type { PredictiveMetrics } from './predictiveEngine'
import type { EnvironmentState } from './telemetry'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'
const WS_BASE = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8000/ws'

/* --------------------------- backend data shapes --------------------------- */

export interface BackendStation {
  id: number
  name: string
  code: string
  latitude: number
  longitude: number
  elevation: number
  status: string
}

export interface BackendEquipment {
  id: number
  station_id: number
  name: string
  equipment_type: string
  status: string
  health_score: number
  temperature: number
  runtime_hours: number
  efficiency: number
}

export interface BackendEnergy {
  generation_kw: number
  consumption_kw: number
  energy_balance: number
  battery_percentage: number
  battery_power_kw: number
  diesel_generation_kw: number
  solar_generation_kw: number
  wind_generation_kw: number
  fuel_percentage: number
  grid_status: string
}

export interface BackendEnvironment {
  temperature: number
  wind_speed: number
  wind_direction: number
  pressure: number
  humidity: number
  precipitation: number
  visibility: number
  solar_irradiance_wm2: number
}

export interface BackendAlert {
  id: number
  station_id: number
  alert_type: string
  severity: string
  title: string
  message: string
  source: string
  related_entity_id?: number | null
  acknowledged: boolean
  created_at: string
  resolved_at?: string | null
}

export interface BackendFuelForecast {
  current_fuel_percentage: number
  estimated_daily_consumption_liters: number
  days_until_critical: number
  status: string
}

export interface StationDashboardOut {
  station: BackendStation
  environment?: BackendEnvironment
  energy?: BackendEnergy
  equipment: BackendEquipment[]
  alerts: BackendAlert[]
  predictions: Record<string, any>
}

/* ------------------------------ state singleton ----------------------------- */

export interface BackendState {
  connected: boolean
  stationId: number | null
  stationCode: string | null
  dashboard: StationDashboardOut | null
  liveEnergy: BackendEnergy | null
  liveEnvironment: BackendEnvironment | null
  /** Latest `active_scenario` from the WS tick (e.g. 'NORMAL_OPERATION'). */
  activeScenario: string | null
}

export const backendState: BackendState = {
  connected: false,
  stationId: null,
  stationCode: null,
  dashboard: null,
  liveEnergy: null,
  liveEnvironment: null,
  activeScenario: null,
}

/* -------------------------------- transport -------------------------------- */

const CODE_OF: Record<'bharati' | 'maitri', string> = { bharati: 'BHARATI', maitri: 'MAITRI' }
const FALLBACK_ID: Record<'bharati' | 'maitri', number> = { bharati: 2, maitri: 1 }

let ws: WebSocket | null = null
let dashTimer: ReturnType<typeof setInterval> | null = null
let activeKey: 'bharati' | 'maitri' | null = null
let lastWsDashRefresh = 0
let lastWsMessage = 0
const WS_DASH_REFRESH_MS = 10_000

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} ${r.status}`)
  return (await r.json()) as T
}

export function fetchStations(): Promise<BackendStation[]> {
  return fetchJson<BackendStation[]>(`${API_BASE}/stations`)
}

export function fetchDashboard(stationId: number): Promise<StationDashboardOut> {
  return fetchJson<StationDashboardOut>(`${API_BASE}/stations/${stationId}/dashboard`)
}

export interface BackendScenarioResponse {
  applied_to_simulation: boolean
  active_until: string | null
  scenario: string
}

/** Inject a scenario into the live backend simulation. */
export async function runBackendScenario(
  stationId: number,
  scenario: string,
  conditions: Record<string, any> | null,
  durationMinutes = 60,
): Promise<BackendScenarioResponse> {
  const r = await fetch(`${API_BASE}/simulation/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      station_id: stationId,
      scenario,
      apply_to_live: true,
      duration_minutes: durationMinutes,
      custom_conditions: conditions,
    }),
  })
  if (!r.ok) throw new Error(`scenario ${r.status}`)
  return (await r.json()) as BackendScenarioResponse
}

/** Reset the backend simulation to nominal. */
export async function resetBackendScenario(stationId: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/simulation/reset`, { method: 'POST' })
    await refreshDashboard(stationId)
  } catch {
    // offline — ignore
  }
}

async function refreshDashboard(stationId: number): Promise<void> {
  const wsFresh = Date.now() - lastWsMessage < 30_000
  try {
    const d = await fetchDashboard(stationId)
    backendState.dashboard = d
    // Only populate live values from the dashboard when the WS isn't already
    // keeping them fresh (first fetch or WS disconnect > 30s ago).
    if (d.energy && (backendState.liveEnergy == null || !wsFresh)) backendState.liveEnergy = d.energy
    if (d.environment && (backendState.liveEnvironment == null || !wsFresh))
      backendState.liveEnvironment = d.environment
    backendState.connected = true
  } catch {
    backendState.connected = false
  }
}

/** Begin polling + WS for the active station. Idempotent per station. */
export async function startBackendSync(activeStation: 'bharati' | 'maitri'): Promise<void> {
  stopBackendSync()
  activeKey = activeStation
  const code = CODE_OF[activeStation]
  backendState.stationCode = code.toLowerCase()

  let stationId = FALLBACK_ID[activeStation]
  try {
    const stations = await fetchStations()
    const found = stations.find((s) => s.code.toUpperCase() === code)
    if (found) stationId = found.id
  } catch {
    // offline: fall back to the canonical seeded ids
  }
  backendState.stationId = stationId
  await refreshDashboard(stationId)
  dashTimer = setInterval(() => {
    if (activeKey === activeStation) refreshDashboard(stationId)
  }, 15000)

  try {
    ws = new WebSocket(`${WS_BASE}/stations/${code.toLowerCase()}`)
    ws.onopen = () => {
      if (activeKey !== activeStation) return
      backendState.connected = true
      refreshDashboard(stationId)
    }
    ws.onclose = () => {
      if (activeKey === activeStation) backendState.connected = false
    }
    ws.onerror = () => ws?.close()
    ws.onmessage = (ev) => {
      if (activeKey !== activeStation) return
      lastWsMessage = Date.now()
      try {
        const m = JSON.parse(ev.data)
        if (m.event) {
          // command event — refresh dashboard to pick up equipment/alert changes
          refreshDashboard(stationId)
          return
        }
        if (m.energy) backendState.liveEnergy = { ...(backendState.liveEnergy ?? {}), ...m.energy }
        if (m.environment)
          backendState.liveEnvironment = { ...(backendState.liveEnvironment ?? {}), ...m.environment }
        if (typeof m.active_scenario === 'string') backendState.activeScenario = m.active_scenario
        backendState.connected = true
        // Throttled dashboard refresh so scenario-driven equipment status
        // changes (not carried in the WS energy/environment payload) reach
        // the 3D beacons within ~10s instead of waiting for the 15s poll.
        const now = Date.now()
        if (now - lastWsDashRefresh > WS_DASH_REFRESH_MS) {
          lastWsDashRefresh = now
          refreshDashboard(stationId)
        }
      } catch {
        // malformed frame; ignore
      }
    }
  } catch {
    // WS unavailable; polling still drives updates
  }
}

export function stopBackendSync(): void {
  if (dashTimer) {
    clearInterval(dashTimer)
    dashTimer = null
  }
  if (ws) {
    ws.onclose = null
    ws.close()
    ws = null
  }
  activeKey = null
}

/* --------------------------- equipment -> system --------------------------- */

const STATUS_TO_SYS: Record<string, SystemStatus> = {
  RUNNING: 'nominal',
  ONLINE: 'nominal',
  CHARGING: 'nominal',
  DISCHARGING: 'nominal',
  STARTING: 'nominal',
  WARNING: 'elevated',
  DEGRADED: 'elevated',
  CRITICAL: 'critical',
  FAILED: 'critical',
  OFFLINE: 'maintenance',
  ISOLATED: 'maintenance',
  MAINTENANCE: 'maintenance',
}

const SEVERITY_RANK: Record<SystemStatus, number> = {
  nominal: 0,
  maintenance: 1,
  elevated: 2,
  critical: 3,
}

/** Map a backend equipment record onto a 3D station-system id (null = no match). */
export function equipmentSystemId(
  eq: BackendEquipment,
  activeStation: 'bharati' | 'maitri',
): string | null {
  const key = `${eq.name} ${eq.equipment_type ?? ''}`.toUpperCase()
  const prefix = activeStation === 'bharati' ? 'Bharati' : 'Maitri'
  if (/GENERATOR|GENSET|BATTERY|INVERTER|UPS|SWITCHGEAR|POWER/.test(key)) return `${prefix}UtilityArea`
  if (/FUEL/.test(key)) return `${prefix}FuelFarm`
  if (/WATER|PUMP|OSMOSIS|REVERSE/.test(key))
    return activeStation === 'bharati' ? 'BharatiWaterPump' : 'MaitriLakeWaterPumpHouse'
  if (/HVAC|HEATER|VENTILATION|THERMAL|AIR/.test(key)) return `${prefix}MainBuilding`
  if (/CONTAINER|STORAGE|WAREHOUSE|CRATE/.test(key))
    return activeStation === 'bharati' ? 'BharatiContainerModules' : null
  if (/CAMP|SHELTER|SUMMER|HABITAT|LIVING|QUARTER/.test(key)) return `${prefix}SummerCamp`
  return null
}

/** Translate live equipment into 3D station-system status overrides. */
export function buildStatusOverrides(
  equipment: BackendEquipment[] | undefined,
  activeStation: 'bharati' | 'maitri',
): Record<string, SystemStatus> {
  const overrides: Record<string, SystemStatus> = {}
  for (const eq of equipment ?? []) {
    const id = equipmentSystemId(eq, activeStation)
    if (!id) continue
    const st = STATUS_TO_SYS[(eq.status ?? '').toUpperCase()] ?? 'nominal'
    if (!overrides[id] || SEVERITY_RANK[st] > SEVERITY_RANK[overrides[id]]) overrides[id] = st
  }
  return overrides
}

/* ------------------------------ alerts -> 3D ------------------------------- */

/** Translate backend alerts into the 3D StationAlert shape (resolved alerts dropped). */
export function mapBackendAlerts(
  alerts: BackendAlert[] | undefined,
  equipment: BackendEquipment[] | undefined,
  activeStation: 'bharati' | 'maitri',
): StationAlert[] {
  if (!alerts) return []
  const eqById = new Map<number, BackendEquipment>()
  equipment?.forEach((e) => eqById.set(e.id, e))
  const prefix = activeStation === 'bharati' ? 'Bharati' : 'Maitri'

  const out: StationAlert[] = []
  for (const a of alerts) {
    if (a.resolved_at) continue
    const sev = (a.severity ?? '').toUpperCase()
    const severity: AlertSeverity =
      sev === 'CRITICAL' ? 'CRITICAL' : sev === 'WARNING' ? 'WARNING' : 'INFO'

    let systemId: string | null = null
    const type = (a.alert_type ?? '').toUpperCase()
    const rel = a.related_entity_id
    if (rel != null && eqById.has(rel)) systemId = equipmentSystemId(eqById.get(rel)!, activeStation)
    if (!systemId) {
      const title = `${a.title} ${a.message}`.toUpperCase()
      if (type === 'ENERGY')
        systemId = /FUEL|TANK|DIESEL/.test(title) ? `${prefix}FuelFarm` : `${prefix}UtilityArea`
      else if (type === 'ENVIRONMENT') systemId = `${prefix}MainBuilding`
      else if (type === 'LOGISTICS')
        systemId = activeStation === 'bharati' ? 'BharatiContainerModules' : null
    }
    if (!systemId) continue

    const sys = getStationSystem(systemId)
    out.push({
      id: String(a.id),
      systemId,
      systemLabel: sys?.label ?? systemId,
      channel: a.alert_type ?? '',
      channelLabel: a.alert_type ?? '',
      severity,
      message: a.message ? `${a.title} — ${a.message}` : a.title,
      timestamp: stationTimeNow(),
      acknowledged: a.acknowledged ?? false,
      muted: false,
      autoResolved: false,
      value: 0,
      unit: '',
    })
  }
  return out
}

/* -------------------------- channel -> backend value ----------------------- */

/**
 * Resolve a 3D telemetry channel from live backend data. Returns null when no
 * backend source exists for that channel (the caller leaves it unchanged so
 * the channel goes dark rather than random-walking).
 */
export function resolveLiveChannelValue(
  systemId: string,
  channelKey: string,
  state: BackendState,
  activeStation: 'bharati' | 'maitri',
): number | null {
  const energy = state.liveEnergy
  const env = state.liveEnvironment
  const equipment = state.dashboard?.equipment
  const prefix = activeStation === 'bharati' ? 'Bharati' : 'Maitri'

  switch (systemId) {
    case `${prefix}FuelFarm`:
      if (channelKey === 'tankLevel' && energy) return energy.fuel_percentage
      break
    case `${prefix}UtilityArea`:
      if (channelKey === 'genOutput' && energy)
        return energy.diesel_generation_kw || energy.generation_kw
      if (channelKey === 'exhaustTemp') {
        const gen = equipment?.find((e) => e.equipment_type === 'GENERATOR' && e.temperature != null)
        if (gen) return gen.temperature
      }
      break
    case `${prefix}MainBuilding`:
      if (channelKey === 'hullStrain' && env)
        return 26 + Math.pow(env.wind_speed / 1.852, 1.62) * 0.85
      break
    case 'BharatiContainerModules':
      if (channelKey === 'zoneTemp' && env) return env.temperature * 0.62 + 2
      break
  }
  return null
}

/* --------------------------- environment -> 3D ------------------------------ */

export function backendEnvironment(state: BackendState): EnvironmentState | null {
  const env = state.liveEnvironment
  if (!env) return null
  const windKts = env.wind_speed / 1.852
  const blizzard = env.wind_speed > 60 || (env.visibility != null && env.visibility < 2)
  const night = (env.solar_irradiance_wm2 ?? 0) < 50
  const label = blizzard
    ? night
      ? 'BLIZZARD · POLAR NIGHT'
      : 'BLIZZARD · WHITEOUT'
    : night
      ? 'POLAR NIGHT · DEEP FREEZE'
      : 'LIVE · BACKEND'
  return { ambientTemp: env.temperature, windKts, label, blizzard, night }
}

/* ----------------------- predictive metrics -> backend --------------------- */

const clampScore = (v: number) => Math.max(0, Math.min(100, v))

/** Build predictive metrics from backend data, carrying forward any sub-score
 *  the backend cannot supply so the header never shows misleading zeros. */
export function computePredictiveFromBackend(
  state: BackendState,
  activeStation: 'bharati' | 'maitri',
  prev: PredictiveMetrics | null,
): PredictiveMetrics | null {
  const energy = state.liveEnergy
  if (!energy) return null
  const isMaitri = activeStation === 'maitri'
  const equipment = state.dashboard?.equipment ?? []
  const fuel = state.dashboard?.predictions?.fuel_forecast as BackendFuelForecast | undefined

  const genCap = isMaitri ? 240 : PLANT.gensetCount * PLANT.gensetKw
  const stationLoadKw = energy.consumption_kw
  const reserveHeadroomKw = energy.generation_kw - energy.consumption_kw
  const nPlusOneOk = reserveHeadroomKw > (isMaitri ? 120 : PLANT.gensetKw)

  const avgHealth = equipment.length
    ? equipment.reduce((a, e) => a + e.health_score, 0) / equipment.length
    : (prev?.healthIndex ?? 80)
  const grid = (energy.grid_status ?? '').toUpperCase()
  const powerStability =
    grid === 'EMERGENCY' ? 20 : grid === 'ISLANDED' ? 55 : grid === 'DEGRADED' ? 70 : 92

  let fuelHours = prev?.fuelHours ?? 0
  if (fuel && fuel.days_until_critical != null) {
    fuelHours = fuel.days_until_critical * 24
  } else if (fuel) {
    const liters = (fuel.current_fuel_percentage / 100) * (isMaitri ? 75_000 : PLANT.fuelTankLiters)
    fuelHours = liters / Math.max(1, fuel.estimated_daily_consumption_liters / 24)
  }
  const days = Math.floor(fuelHours / 24)
  const hours = Math.floor(fuelHours % 24)
  const fuelDaysLabel =
    fuelHours > 96
      ? `${days} Days ${hours} h`
      : `${Math.floor(fuelHours)} h ${Math.round((fuelHours % 1) * 60)} m`

  const healthIndex = Math.round(avgHealth)
  return {
    healthIndex,
    powerStability: clampScore(Math.round(powerStability)),
    lifeSupport: prev?.lifeSupport ?? 80,
    environmentalRisk: prev?.environmentalRisk ?? 80,
    commsIntegrity: prev?.commsIntegrity ?? 80,
    fuelHours,
    fuelDaysLabel,
    generationCapacityKw: genCap,
    stationLoadKw: Math.round(stationLoadKw),
    reserveHeadroomKw: Math.round(reserveHeadroomKw),
    nPlusOneOk,
    waterReservePercent: prev?.waterReservePercent ?? 0,
    waterAutonomyHours: prev?.waterAutonomyHours ?? 0,
  }
}
