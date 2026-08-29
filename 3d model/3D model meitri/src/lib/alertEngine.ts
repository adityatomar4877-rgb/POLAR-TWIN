// Automated anomaly & alert pipeline (Phase 5).
// Rule-based threshold evaluation over the live telemetry snapshot with
// auto-resolution when readings return to their nominal band.

import { STATION_SYSTEMS, type TelemetryChannel } from './stationSystems'
import type { TelemetrySnapshot } from './telemetry'

export type AlertSeverity = 'WARNING' | 'CRITICAL' | 'INFO'

export interface StationAlert {
  /** Unique id (timestamp + channel key). */
  id: string
  systemId: string
  systemLabel: string
  channel: string
  channelLabel: string
  severity: AlertSeverity
  message: string
  /** Formatted station time (UTC+5). */
  timestamp: string
  acknowledged: boolean
  muted: boolean
  autoResolved: boolean
  /** Live value that triggered the alert. */
  value: number
  unit: string
}

export function stationTimeNow(): string {
  const d = new Date(Date.now() + 5 * 3600_000)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes()
    .toString()
    .padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')} ST`
}

interface ThresholdBreach {
  severity: AlertSeverity
  message: string
}

function evaluateChannel(def: TelemetryChannel, value: number): ThresholdBreach | null {
  if (def.critBelow !== undefined && value <= def.critBelow) {
    return { severity: 'CRITICAL', message: `${def.label} at ${value.toFixed(def.decimals)} ${def.unit} — below critical floor ${def.critBelow} ${def.unit}` }
  }
  if (def.critAbove !== undefined && value >= def.critAbove) {
    return { severity: 'CRITICAL', message: `${def.label} at ${value.toFixed(def.decimals)} ${def.unit} — above critical ceiling ${def.critAbove} ${def.unit}` }
  }
  if (def.warnBelow !== undefined && value <= def.warnBelow) {
    return { severity: 'WARNING', message: `${def.label} at ${value.toFixed(def.decimals)} ${def.unit} — below warning floor ${def.warnBelow} ${def.unit}` }
  }
  if (def.warnAbove !== undefined && value >= def.warnAbove) {
    return { severity: 'WARNING', message: `${def.label} at ${value.toFixed(def.decimals)} ${def.unit} — above warning ceiling ${def.warnAbove} ${def.unit}` }
  }
  return null
}

export interface AlertEvaluation {
  /** Alerts that are currently active (condition still breaching). */
  active: StationAlert[]
  /** Alerts that auto-resolved this tick (for the log). */
  resolved: StationAlert[]
  /** Brand-new critical alerts this tick (for chime). */
  newCritical: StationAlert[]
}

/**
 * Reconcile the previous active set with fresh threshold evaluations.
 * Alert identity key = `${systemId}:${channel}` so a breach updates the
 * existing alert (fresh timestamp/value) instead of spamming duplicates.
 */
export function evaluateAlerts(prevActive: StationAlert[], snapshot: TelemetrySnapshot): AlertEvaluation {
  const nextActive: StationAlert[] = []
  const resolved: StationAlert[] = []
  const newCritical: StationAlert[] = []
  const seen = new Set<string>()

  for (const system of STATION_SYSTEMS) {
    const sysSnapshot = snapshot[system.id]
    for (const def of system.channels) {
      const key = `${system.id}:${def.key}`
      const value = sysSnapshot[def.key]?.value ?? def.base
      const breach = evaluateChannel(def, value)
      const previous = prevActive.find((a) => a.id.startsWith(key))

      if (!breach) {
        if (previous && !previous.autoResolved) {
          resolved.push({ ...previous, autoResolved: true, value, timestamp: stationTimeNow() })
        }
        continue
      }

      seen.add(key)
      const alert: StationAlert = {
        id: previous?.id ?? `${key}:${Date.now()}`,
        systemId: system.id,
        systemLabel: system.label,
        channel: def.key,
        channelLabel: def.label,
        severity: breach.severity,
        message: breach.message,
        timestamp: stationTimeNow(),
        acknowledged: previous?.acknowledged ?? false,
        muted: previous?.muted ?? false,
        autoResolved: false,
        value,
        unit: def.unit,
      }
      // Escalations count as fresh criticals for the chime.
      if (breach.severity === 'CRITICAL' && (!previous || previous.severity !== 'CRITICAL')) {
        newCritical.push(alert)
      }
      nextActive.push(alert)
    }
  }

  for (const stale of prevActive) {
    const key = `${stale.systemId}:${stale.channel}`
    if (!seen.has(key) && !stale.autoResolved) {
      resolved.push({ ...stale, autoResolved: true, timestamp: stationTimeNow() })
    }
  }

  return { active: nextActive, resolved, newCritical }
}

let audioCtx: AudioContext | null = null

/** Two-tone critical chime; lazily creates the AudioContext (autoplay-safe). */
export function playCriticalChime(): void {
  try {
    audioCtx ??= new AudioContext()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    const t0 = audioCtx.currentTime
    for (const [freq, start] of [
      [880, 0],
      [660, 0.16],
    ] as const) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t0 + start)
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.22)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(t0 + start)
      osc.stop(t0 + start + 0.25)
    }
  } catch {
    // Audio unavailable (headless / no gesture) — visual alerts still fire.
  }
}
