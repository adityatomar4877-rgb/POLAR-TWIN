// Mission clock (Phase 5): the single 1 Hz driver that steps the coupled
// telemetry engine, evaluates the anomaly pipeline, refreshes predictive
// metrics and syncs everything into the store.

import { useStationStore } from './stationStore'
import { environmentFromMode, missionEngine, TELEMETRY_TICK_MS } from './telemetry'
import { evaluateAlerts, playCriticalChime } from './alertEngine'
import { computePredictiveMetrics } from './predictiveEngine'
import { stepAiEngine } from './aiPredictiveEngine'

let timer: ReturnType<typeof setInterval> | null = null

function tick(): void {
  const s = useStationStore.getState()
  const baseEnv = environmentFromMode(s.visualMode, s.weather)
  const env = missionEngine.step(baseEnv, s.faults, s.mitigations)
  const { active, resolved, newCritical } = evaluateAlerts(s.alerts, missionEngine.snapshot())
  const predictive = computePredictiveMetrics(env)
  const aiInsights = stepAiEngine(missionEngine.snapshot())

  useStationStore.setState({
    environment: env,
    alerts: active,
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
  tick() // prime the pipeline so the header is populated on first paint
  timer = setInterval(tick, TELEMETRY_TICK_MS)
  return () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}
