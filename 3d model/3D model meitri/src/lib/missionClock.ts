// Mission clock: the single 1 Hz driver. When the backend is reachable it is
// the source of truth — environment, alerts, predictive metrics and system
// status are all derived from live backend data. When the backend is offline
// the original coupled-physics engines take over so the demo is never blank.

import { useStationStore } from './stationStore'
import { missionEngine, environmentFromMode, TELEMETRY_TICK_MS } from './telemetry'
import { evaluateAlerts, playCriticalChime } from './alertEngine'
import { computePredictiveMetrics } from './predictiveEngine'
import { stepAiEngine } from './aiPredictiveEngine'
import {
  backendState,
  startBackendSync,
  stopBackendSync,
  backendEnvironment,
  buildStatusOverrides,
  mapBackendAlerts,
  computePredictiveFromBackend,
} from './backend'

let timer: ReturnType<typeof setInterval> | null = null
let syncedStation: 'bharati' | 'maitri' | null = null

function ensureSync(active: 'bharati' | 'maitri'): void {
  if (syncedStation !== active) {
    syncedStation = active
    startBackendSync(active)
  }
}

function tick(): void {
  const s = useStationStore.getState()
  const active = s.activeStation
  ensureSync(active)

  const baseEnv = environmentFromMode(s.visualMode, s.weather)
  const env = missionEngine.step(baseEnv, s.faults, s.mitigations, active)

  // ---- Backend authoritative path ----
  if (backendState.connected && backendState.dashboard) {
    const liveEnv = backendEnvironment(backendState) ?? env
    const alerts = mapBackendAlerts(
      backendState.dashboard.alerts,
      backendState.dashboard.equipment,
      active,
    )
    const predictive = computePredictiveFromBackend(backendState, active, s.predictive) ?? computePredictiveMetrics(liveEnv)
    const backendOverrides = buildStatusOverrides(backendState.dashboard.equipment, active)

    // Auto-clear the local scenario preset when the backend has reverted to
    // NORMAL_OPERATION (scenario expired) so the UI stays in sync without a
    // manual "clear" click. Manual statusOverrides are preserved.
    const scenarioCleared =
      backendState.activeScenario === 'NORMAL_OPERATION' && s.scenario != null
        ? { scenario: null as null, faults: { fuelLeak: false, genBearing: false } }
        : {}

    useStationStore.setState({
      ...scenarioCleared,
      environment: liveEnv,
      alerts,
      alertLog: [...s.alertLog].slice(0, 60),
      predictive,
      aiInsights: [],
      backendStatusOverrides: backendOverrides,
      missionTick: s.missionTick + 1,
    })
    return
  }

  // ---- Offline fallback: local engines over the physics snapshot ----
  const { active: eActive, resolved, newCritical } = evaluateAlerts(s.alerts, missionEngine.snapshot())
  const predictive = computePredictiveMetrics(env)
  const aiInsights = stepAiEngine(missionEngine.snapshot())

  useStationStore.setState({
    environment: env,
    alerts: eActive,
    alertLog: [...resolved, ...s.alertLog].slice(0, 60),
    predictive,
    aiInsights,
    missionTick: s.missionTick + 1,
  })

  if (newCritical.some((a) => !a.muted)) playCriticalChime()
}

/** Idempotent start; returns a stop function. */
export function startMissionClock(): () => void {
  if (timer !== null) return () => {}
  const active = useStationStore.getState().activeStation
  syncedStation = active
  startBackendSync(active)
  tick() // prime the pipeline so the header is populated on first paint
  timer = setInterval(tick, TELEMETRY_TICK_MS)
  return () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    stopBackendSync()
    syncedStation = null
  }
}
