// AI predictive maintenance engine (Phase 6).
// Remaining-Useful-Life degradation modeling for mission-critical hardware
// plus multi-variate cross-system anomaly correlation. Fully deterministic,
// advanced by the mission clock at 1 Hz (1 tick = 1 simulated operating hour
// of wear at demo acceleration).

import type { TelemetrySnapshot } from './telemetry'

export type InsightKind = 'RUL' | 'CORRELATION'
export type InsightSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface AiInsight {
  id: string
  kind: InsightKind
  assetOrPattern: string
  systemId?: string
  severity: InsightSeverity
  title: string
  detail: string
  /** RUL metrics (kind = RUL). */
  wearPercent?: number
  rulHours?: number
  rulConfidencePct?: number
  daysToService?: number
  failureCurve?: number[]
}

interface AssetState {
  wear: number
  freezeEpisodes: number
  inFreeze: boolean
}

const assets: Record<string, AssetState> = {
  gensetBearing: { wear: 4, freezeEpisodes: 0, inFreeze: false },
  intakeImpeller: { wear: 6, freezeEpisodes: 0, inFreeze: false },
  radomeDeicer: { wear: 3, freezeEpisodes: 0, inFreeze: false },
}

const g = (snap: TelemetrySnapshot, sys: string, key: string) => snap[sys]?.[key]?.value ?? 0

/** Wear rate per simulated operating hour (%/h) for each asset. */
function bearingWearRate(vibration: number, egt: number): number {
  const mech = 0.02 * Math.pow(Math.max(0.2, vibration) / 1.7, 2.5)
  const thermal = egt > 85 ? (egt - 85) * 0.004 : 0
  return mech + thermal
}

function impellerWearRate(traceTemp: number, roDiff: number): number {
  const base = 0.018
  const freeze = traceTemp < 1 ? 0.05 : 0
  const filterStress = Math.max(0, roDiff - 85) * 0.0012
  return base + freeze + filterStress
}

function radomeWearRate(heaterAmps: number): number {
  return 0.0035 * Math.max(0.3, heaterAmps)
}

function rulFromWear(wear: number, rate: number): { hours: number; confidence: number; daysToService: number } {
  const hours = rate > 1e-6 ? Math.min(9999, Math.max(0, (100 - wear) / rate)) : 9999
  const confidence = Math.max(6, 28 - wear * 0.22)
  const daysToService = rate > 1e-6 ? Math.max(0, (70 - wear) / rate / 24) : 999
  return { hours, confidence, daysToService }
}

function failureCurve(wear: number): number[] {
  // Probability of failure within the next N months (N = 1..12).
  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1
    return Math.min(0.99, 1 - Math.exp(-Math.pow(wear / 100, 2) * 0.55 * n))
  })
}

/** Advance asset wear one tick and produce the current insight set. */
export function stepAiEngine(snapshot: TelemetrySnapshot): AiInsight[] {
  const vibration = g(snapshot, 'BharatiUtilityArea', 'vibration')
  const egt = g(snapshot, 'BharatiUtilityArea', 'exhaustTemp')
  const traceTemp = g(snapshot, 'BharatiWaterPump', 'traceTemp')
  const roDiff = g(snapshot, 'BharatiWaterPump', 'roFilterDiff')
  const heaterAmps = g(snapshot, 'BharatiMainBuilding', 'radomeHeater')
  const intakeFlow = g(snapshot, 'BharatiWaterPump', 'intakeFlow')
  const pipePressure = g(snapshot, 'BharatiWaterPump', 'pipePressure')

  // Freeze-thaw episode detection for the impeller.
  if (traceTemp < 1 && !assets.intakeImpeller.inFreeze) {
    assets.intakeImpeller.inFreeze = true
    assets.intakeImpeller.freezeEpisodes++
  } else if (traceTemp >= 2.5) {
    assets.intakeImpeller.inFreeze = false
  }

  assets.gensetBearing.wear = Math.min(100, assets.gensetBearing.wear + bearingWearRate(vibration, egt))
  assets.intakeImpeller.wear = Math.min(100, assets.intakeImpeller.wear + impellerWearRate(traceTemp, roDiff))
  assets.radomeDeicer.wear = Math.min(100, assets.radomeDeicer.wear + radomeWearRate(heaterAmps))

  const insights: AiInsight[] = []

  // ---- RUL cards ----
  const bearing = rulFromWear(assets.gensetBearing.wear, bearingWearRate(vibration, egt))
  insights.push({
    id: 'rul-genset-bearing',
    kind: 'RUL',
    assetOrPattern: 'Primary Genset Bearing Assembly',
    systemId: 'BharatiUtilityArea',
    severity: bearing.hours < 240 ? 'CRITICAL' : bearing.hours < 900 ? 'WARNING' : 'INFO',
    title: `Bearing RUL ${bearing.hours >= 9999 ? '9999+' : Math.round(bearing.hours)} h`,
    detail: `Vibration RMS ${vibration.toFixed(2)} mm/s with exhaust ${egt.toFixed(0)}°C drives ${bearingWearRate(vibration, egt).toFixed(3)} %/h wear. Schedule LOTO inspection before failure window.`,
    wearPercent: assets.gensetBearing.wear,
    rulHours: bearing.hours,
    rulConfidencePct: bearing.confidence,
    daysToService: bearing.daysToService,
    failureCurve: failureCurve(assets.gensetBearing.wear),
  })

  const impeller = rulFromWear(assets.intakeImpeller.wear, impellerWearRate(traceTemp, roDiff))
  insights.push({
    id: 'rul-intake-impeller',
    kind: 'RUL',
    assetOrPattern: 'Seawater Intake Impeller & RO Membrane',
    systemId: 'BharatiWaterPump',
    severity: impeller.hours < 240 ? 'CRITICAL' : impeller.hours < 900 ? 'WARNING' : 'INFO',
    title: `Impeller RUL ${impeller.hours >= 9999 ? '9999+' : Math.round(impeller.hours)} h`,
    detail: `${assets.intakeImpeller.freezeEpisodes} freeze-thaw episode(s) logged; RO differential ${roDiff.toFixed(1)} kPa. Membrane backflush recommended at 70% wear.`,
    wearPercent: assets.intakeImpeller.wear,
    rulHours: impeller.hours,
    rulConfidencePct: impeller.confidence,
    daysToService: impeller.daysToService,
    failureCurve: failureCurve(assets.intakeImpeller.wear),
  })

  const radome = rulFromWear(assets.radomeDeicer.wear, radomeWearRate(heaterAmps))
  insights.push({
    id: 'rul-radome-deicer',
    kind: 'RUL',
    assetOrPattern: 'SATCOM Radome De-icing Elements',
    systemId: 'BharatiMainBuilding',
    severity: radome.hours < 240 ? 'CRITICAL' : radome.hours < 900 ? 'WARNING' : 'INFO',
    title: `Radome de-icer RUL ${radome.hours >= 9999 ? '9999+' : Math.round(radome.hours)} h`,
    detail: `Duty-cycle fatigue from ${heaterAmps.toFixed(1)} A heater draw. Element replacement window opens at 70% wear.`,
    wearPercent: assets.radomeDeicer.wear,
    rulHours: radome.hours,
    rulConfidencePct: radome.confidence,
    daysToService: radome.daysToService,
    failureCurve: failureCurve(assets.radomeDeicer.wear),
  })

  // ---- Multi-variate correlation rules ----
  const burn = g(snapshot, 'BharatiFuelFarm', 'burnRate')
  const hvac = g(snapshot, 'BharatiMainBuilding', 'hvacLoad')
  const indoor = g(snapshot, 'BharatiMainBuilding', 'indoorTemp')
  const expectedBurn = 7 + hvac * 0.085
  if (burn > expectedBurn * 1.3 && indoor < 21) {
    insights.push({
      id: 'corr-heat-loss',
      kind: 'CORRELATION',
      assetOrPattern: 'Correlated Heat Loss',
      systemId: 'BharatiMainBuilding',
      severity: burn > expectedBurn * 1.6 ? 'CRITICAL' : 'WARNING',
      title: 'Correlated heat-loss signature detected',
      detail: `Burn ${burn.toFixed(1)} L/h vs ${expectedBurn.toFixed(1)} L/h expected for ${hvac.toFixed(0)} kW HVAC load while indoor holds ${indoor.toFixed(1)}°C — possible hull insulation degradation or an unlatched vestibule door. Recommend thermal sweep of the building envelope.`,
    })
  }

  if (traceTemp < 1 && intakeFlow < 200 && pipePressure < 2.8) {
    insights.push({
      id: 'corr-cavitation',
      kind: 'CORRELATION',
      assetOrPattern: 'Intake Cavitation / Ice Slush',
      systemId: 'BharatiWaterPump',
      severity: 'CRITICAL',
      title: 'Early ice-slush formation in intake conduit',
      detail: `Flow sagging to ${intakeFlow.toFixed(0)} L/min with trace heating at ${traceTemp.toFixed(1)}°C and line pressure ${pipePressure.toFixed(2)} bar — classic pre-freeze slush signature ahead of full blockage. Backflush before the impeller ingests slush.`,
    })
  }

  const snr = g(snapshot, 'BharatiMainBuilding', 'satcomSnr')
  const latency = g(snapshot, 'BharatiMainBuilding', 'satcomLatency')
  if (snr < 6.5 && latency > 600) {
    insights.push({
      id: 'corr-comms-degradation',
      kind: 'CORRELATION',
      assetOrPattern: 'SATCOM Envelope Degradation',
      systemId: 'BharatiMainBuilding',
      severity: 'WARNING',
      title: 'Compound SATCOM degradation',
      detail: `SNR ${snr.toFixed(1)} dB with ${latency.toFixed(0)} ms round-trip — multipath + radome icing compounding. De-icing duty cycle should be verified before the next scheduled uplink.`,
    })
  }

  const load = g(snapshot, 'BharatiUtilityArea', 'genOutput')
  if (load > 235) {
    insights.push({
      id: 'corr-n-plus-one',
      kind: 'CORRELATION',
      assetOrPattern: 'Grid N+1 Redundancy Lost',
      systemId: 'BharatiUtilityArea',
      severity: load > 300 ? 'CRITICAL' : 'WARNING',
      title: 'Station load threatens N+1 redundancy',
      detail: `Aggregate demand ${load.toFixed(0)} kW vs 240 kW two-genset ceiling — a single genset trip would brown-out the campus. Shed non-essential experiments or start the reserve unit.`,
    })
  }

  return insights
}
