// Antarctic Mission AI Copilot knowledge core (Phase 6).
// Fast deterministic client-side intent matching over live telemetry —
// no network, no keys, fully offline for judging environments.

import { getStationSystem, STATUS_BADGE, PLANT } from './stationSystems'
import { effectiveStatusOf, type StationState } from './stationStore'
import { missionEngine, environmentFromMode } from './telemetry'
import { simulateWhatIf, WHAT_IF_DEFAULTS } from './whatIfSimulator'
import type { AiInsight } from './aiPredictiveEngine'

export interface CopilotReply {
  text: string
  /** Optional facility the copilot wants the 3D scene to focus + pulse. */
  focusSystemId?: string
}

const g = (sys: string, key: string) => missionEngine.getValue(sys, key)

function findSystem(text: string) {
  const t = text.toLowerCase()
  const aliases: Record<string, string[]> = {
    BharatiMainBuilding: ['bharati main building', 'bharati habitat', 'bharati building', 'main building', 'habitat', 'station building', 'building', 'comms', 'satcom', 'mast'],
    BharatiFuelFarm: ['bharati fuel farm', 'fuel farm', 'fuel tank', 'tank farm', 'fuel'],
    BharatiFuelStation: ['bharati fuel station', 'fuel station', 'dispensing', 'bowser'],
    BharatiWaterPump: ['bharati water pump', 'seawater', 'pump', 'water intake', 'desal', 'water'],
    BharatiSummerCamp: ['bharati summer camp', 'summer camp', 'camp', 'cabins'],
    BharatiContainerModules: ['container', 'modules', 'storage', 'labs'],
    BharatiUtilityArea: ['bharati generator', 'bharati utility', 'generator', 'genset', 'utility', 'power plant', 'generators'],
    MaitriMainBuilding: ['maitri main building', 'maitri habitat', 'maitri building', 'maitri main', 'maitri'],
    MaitriFuelFarm: ['maitri fuel farm', 'maitri fuel', 'maitri tank'],
    MaitriFuelStation: ['maitri fuel station', 'maitri bowser', 'maitri dispensing'],
    MaitriLakeWaterPumpHouse: ['maitri lake pump', 'lake water', 'pump house', 'priyadarshini', 'lake pump'],
    MaitriSummerCamp: ['maitri summer camp', 'maitri camp'],
    MaitriUtilityArea: ['maitri utility', 'maitri generator', 'maitri power'],
  }
  for (const [id, words] of Object.entries(aliases)) {
    if (words.some((w) => t.includes(w))) return getStationSystem(id)
  }
  return undefined
}

function systemSummary(id: string, state: StationState): string {
  const system = getStationSystem(id)
  if (!system) return 'Unknown system.'
  const status = effectiveStatusOf(state, id)
  const lines: string[] = [
    `${system.label} — ${STATUS_BADGE[status]}${status !== 'nominal' ? '' : ' (all channels in nominal band)'}.`,
  ]
  for (const ch of system.channels) {
    const v = g(id, ch.key)
    const flags: string[] = []
    if (ch.critBelow !== undefined && v <= ch.critBelow) flags.push('CRITICAL LOW')
    else if (ch.critAbove !== undefined && v >= ch.critAbove) flags.push('CRITICAL HIGH')
    else if (ch.warnBelow !== undefined && v <= ch.warnBelow) flags.push('LOW')
    else if (ch.warnAbove !== undefined && v >= ch.warnAbove) flags.push('HIGH')
    lines.push(`• ${ch.label}: ${v.toFixed(ch.decimals)} ${ch.unit}${flags.length ? ` (${flags.join('/')})` : ''}`)
  }
  const sysAlerts = state.alerts.filter((a) => a.systemId === id && !a.autoResolved)
  if (sysAlerts.length > 0) {
    lines.push(`Active alerts: ${sysAlerts.map((a) => `${a.severity} ${a.channelLabel}`).join('; ')}.`)
  }
  return lines.join('\n')
}

type Handler = (text: string, state: StationState) => CopilotReply | null

const handlers: { test: RegExp; run: Handler }[] = [
  {
    // "focus on the generators", "show me the water pump", "go to fuel farm"
    test: /\b(focus|show|go to|navigate|inspect|open)\b/i,
    run: (text) => {
      const system = findSystem(text)
      if (!system) return null
      return {
        text: `Focusing the twin on ${system.label}. Camera is gliding in and the facility is pulsing — telemetry panel pinned on the right.`,
        focusSystemId: system.id,
      }
    },
  },
  {
    // "how long will our fuel last if the blizzard continues for 10 days"
    test: /\b(how long|runway|last|depletion|exhaust).*(fuel|diesel)|\bfuel\b.*\b(last|runway|how long)\b/i,
    run: (text, state) => {
      if (!state.predictive) return null
      const blizzardMatch = /blizzard[^0-9]*(\d+)|(\d+)\s*day[s]?\s*(?:of\s*)?blizzard/i.exec(text)
      const days = blizzardMatch ? Number(blizzardMatch[1] ?? blizzardMatch[2]) : 0
      if (days > 0) {
        const sim = simulateWhatIf(
          { ...WHAT_IF_DEFAULTS, blizzardDays: days, vesselDelayDays: 30 },
          state.predictive,
        )
        return {
          text:
            `If the blizzard holds for ${days} day(s): fuel depletion lands on day ${sim.fuelDepletionDay ?? '120+'} ` +
            `at the current ${g('BharatiFuelFarm', 'burnRate').toFixed(1)} L/h burn (storm burn roughly ×2.35). ` +
            `${sim.recommendation}`,
        }
      }
      const hours = state.predictive.fuelHours
      return {
        text:
          `Fuel autonomy is ${state.predictive.fuelDaysLabel} (${Math.round(hours)} h) at the current burn of ` +
          `${g('BharatiFuelFarm', 'burnRate').toFixed(1)} L/h. Tank at ${g('BharatiFuelFarm', 'tankLevel').toFixed(1)}% ` +
          `(${Math.round((g('BharatiFuelFarm', 'tankLevel') / 100) * PLANT.fuelTankLiters).toLocaleString()} L of ${PLANT.fuelTankLiters.toLocaleString()} L). ` +
          `Ask me "what if the blizzard continues for 10 days" for a stress forecast.`,
      }
    },
  },
  {
    // "why is the seawater pump in warning state"
    test: /\bwhy\b/i,
    run: (text, state) => {
      const system = findSystem(text)
      const sysId = system?.id ?? state.alerts[0]?.systemId
      if (!sysId) return null
      const sysAlerts = state.alerts.filter((a) => a.systemId === sysId && !a.autoResolved)
      const env = state.environment ?? environmentFromMode(state.visualMode, state.weather)
      const causes: string[] = []
      if (sysAlerts.length === 0) {
        causes.push('No active threshold breaches right now — the status you saw may have just auto-resolved.')
      }
      for (const a of sysAlerts) causes.push(`• ${a.severity}: ${a.message}`)
      if (sysId === 'BharatiWaterPump' && (env.blizzard || env.ambientTemp < -15)) {
        causes.push(
          `Root cause chain: ambient ${env.ambientTemp.toFixed(0)}°C with ${env.windKts.toFixed(0)} kts wind is pulling the ` +
            `trace-heating conductor down to ${g('BharatiWaterPump', 'traceTemp').toFixed(1)}°C; below 3°C the freeze-risk ` +
            `rule arms, and line pressure follows it down. The SOP engine can ramp trace heating to 100% duty — see SOP Action Center.`,
        )
      }
      if (sysId === 'BharatiUtilityArea') {
        causes.push(
          `Vibration RMS is ${g('BharatiUtilityArea', 'vibration').toFixed(2)} mm/s with EGT at ` +
            `${g('BharatiUtilityArea', 'exhaustTemp').toFixed(0)}°C — bearing degradation raises both. ` +
            `Backup Genset #2 can be auto-synchronized from the SOP Action Center.`,
        )
      }
      return {
        text: `${getStationSystem(sysId)?.label ?? 'That system'}: ${causes.join('\n')}`,
        focusSystemId: sysId,
      }
    },
  },
  {
    test: /\b(health|status|summary|report)\b.*\b(farm|pump|building|camp|station|module|generator|utility|fuel|water)\b/i,
    run: (text, state) => {
      const system = findSystem(text)
      if (system) return { text: systemSummary(system.id, state), focusSystemId: system.id }
      // Whole-station health
      const p = state.predictive
      if (!p) return null
      return {
        text:
          `Station composite health: ${p.healthIndex}% (power ${p.powerStability}, life support ${p.lifeSupport}, ` +
          `environment ${p.environmentalRisk}, comms ${p.commsIntegrity}). Fuel runway ${p.fuelDaysLabel}; ` +
          `grid ${p.stationLoadKw}/${p.generationCapacityKw} kW, N+1 ${p.nPlusOneOk ? 'intact' : 'AT RISK'}; ` +
          `water reserve ${p.waterReservePercent.toFixed(1)}%. Active alerts: ${state.alerts.length}.`,
      }
    },
  },
  {
    test: /\b(vulnerab|weak|risk|diagnose)\b/i,
    run: (_text, state) => {
      const insights = state.aiInsights.filter((i) => i.severity !== 'INFO')
      const parts: string[] = []
      if (state.predictive) {
        const scores: [string, number][] = [
          ['power stability', state.predictive.powerStability],
          ['life support', state.predictive.lifeSupport],
          ['environmental margin', state.predictive.environmentalRisk],
          ['comms integrity', state.predictive.commsIntegrity],
        ]
        scores.sort((a, b) => a[1] - b[1])
        parts.push(`Weakest axis: ${scores[0][0]} at ${scores[0][1]}%.`)
      }
      if (insights.length > 0) {
        parts.push(
          `AI correlation engine flags ${insights.length} pattern(s):\n` +
            insights.slice(0, 3).map((i: AiInsight) => `• [${i.severity}] ${i.title} — ${i.detail}`).join('\n'),
        )
      } else {
        parts.push('No cross-system anomaly patterns detected — degradation curves are nominal.')
      }
      const topAlert = state.alerts.find((a) => a.severity === 'CRITICAL') ?? state.alerts[0]
      if (topAlert) parts.push(`Priority alert: ${topAlert.systemLabel} — ${topAlert.message}`)
      return { text: parts.join('\n\n') }
    },
  },
  {
    test: /\b(fuel optimization|optimization audit|save fuel|efficiency)\b/i,
    run: (_text, state) => {
      const hvac = g('BharatiMainBuilding', 'hvacLoad')
      const camp = g('BharatiSummerCamp', 'campPower')
      const burn = g('BharatiFuelFarm', 'burnRate')
      const expected = 7 + hvac * 0.085 + camp * 0.06
      return {
        text:
          `Fuel optimization audit:\n` +
          `• Current burn ${burn.toFixed(1)} L/h; physics-expected ${expected.toFixed(1)} L/h ` +
          `(HVAC ${hvac.toFixed(0)} kW + camp ${camp.toFixed(0)} kW + base plant).` +
          (burn > expected * 1.2 ? '\n• Burn exceeds expectation — check for hull heat loss or a stuck booster pump.' : '\n• Burn matches the thermal model — no anomaly.') +
          `\n• Dropping Summer Camp loop to 16°C saves ~${(camp * 0.18).toFixed(1)} kW ≈ ${(camp * 0.18 * 0.085).toFixed(1)} L/h.` +
          `\n• At current runway (${state.predictive?.fuelDaysLabel ?? '—'}), that is roughly ${Math.round((camp * 0.18 * 0.085 * 24) / Math.max(1, burn) * 100) / 100}% runway extension.`,
      }
    },
  },
  {
    test: /\b(life support|air|co2|breathable)\b/i,
    run: (_text, _state) => {
      const co2 = g('BharatiMainBuilding', 'co2')
      const indoor = g('BharatiMainBuilding', 'indoorTemp')
      const air = g('BharatiMainBuilding', 'airPressure')
      const campTemp = g('BharatiSummerCamp', 'campTemp')
      return {
        text:
          `Life support status:\n• CO₂ ${co2.toFixed(0)} ppm (ceiling 1100)\n• Indoor ${indoor.toFixed(1)}°C (band 18–22)\n` +
          `• Cabin pressure ${air.toFixed(1)} hPa\n• Summer camp loop ${campTemp.toFixed(1)}°C\n` +
          (co2 > 900 ? '• CO₂ elevated — increase fresh-air exchange or reduce occupancy density.' : '• All life-support channels inside safe bounds.'),
      }
    },
  },
  {
    test: /\b(explain|active alerts|alarms|alerts)\b/i,
    run: (_text, state) => {
      if (state.alerts.length === 0) {
        return { text: 'No active alerts — the anomaly pipeline is quiet and every channel sits inside its warning band.' }
      }
      return {
        text:
          `${state.alerts.length} active alert(s):\n` +
          state.alerts
            .slice(0, 6)
            .map((a) => `• [${a.severity}] ${a.systemLabel}: ${a.message}`)
            .join('\n') +
          `\nOpen the alarm bell (top right) for Locate-in-3D and SOP actions.`,
      }
    },
  },
  {
    test: /\b(help|what can you)\b/i,
    run: () => ({
      text:
        'I am Bharati Intelligence — the station copilot. Try:\n' +
        '• "What is the health of the fuel farm?"\n' +
        '• "Why is the water pump in warning?"\n' +
        '• "How long will fuel last if the blizzard continues for 10 days?"\n' +
        '• "Focus on the generators" (I will glide the 3D camera there)\n' +
        '• "Diagnose station vulnerabilities"',
    }),
  },
]

/** Deterministic intent resolution over the live station state. */
export function answerQuery(query: string, state: StationState): CopilotReply {
  const text = query.trim()
  if (text.length === 0) {
    return { text: 'Ask me about any system, alert, runway or scenario — or tap a quick chip below.' }
  }
  for (const h of handlers) {
    if (h.test.test(text)) {
      const reply = h.run(text, state)
      if (reply) return reply
    }
  }
  // Fallback: fuzzy system match.
  const system = findSystem(text)
  if (system) return { text: systemSummary(system.id, state), focusSystemId: system.id }
  return {
    text:
      'I could not map that to station telemetry. Try naming a facility (fuel farm, water pump, generators, summer camp, containers, main building) ' +
      'or ask about fuel runway, active alerts, life support, or say "focus on …" to inspect in 3D.',
  }
}

export const QUICK_PROMPTS = [
  'Diagnose Station Vulnerabilities',
  'Run Fuel Optimization Audit',
  'Inspect Life Support Status',
  'Explain Active Alerts',
]
