// Automated SOP incident-response engine (Phase 6).
// Maps active alerts to NCPOR-style operational checklists. Executing the
// auto-command flips a mitigation flag that feeds back into the telemetry
// physics, so corrective actions visibly resolve the anomaly.

import type { StationAlert } from './alertEngine'
import type { Mitigations } from './telemetry'

export interface SopStep {
  label: string
  /** Auto-command steps apply a mitigation to the simulation when executed. */
  auto?: keyof Mitigations
}

export interface SopProtocol {
  id: string
  title: string
  triggerLabel: string
  systemId: string
  steps: SopStep[]
}

export const SOP_PROTOCOLS: SopProtocol[] = [
  {
    id: 'sop-fuel-leak',
    title: 'Fuel Transfer Line Leak',
    triggerLabel: 'Fuel Farm leak / transfer pressure anomaly',
    systemId: 'BharatiFuelFarm',
    steps: [
      { label: 'AUTO-COMMAND: Cut Fuel Booster Pump P-01', auto: 'fuelPumpCut' },
      { label: 'Isolate manual containment valve V-104 at Fuel Farm bund' },
      { label: 'Switch main station power feed to secondary Day Tank storage' },
      { label: 'Dispatch station engineering crew with spill-containment kit' },
    ],
  },
  {
    id: 'sop-intake-freeze',
    title: 'Seawater Intake Freeze Risk',
    triggerLabel: 'Trace heating / pipeline pressure anomaly',
    systemId: 'BharatiWaterPump',
    steps: [
      { label: 'AUTO-COMMAND: Ramp trace heating conductor to 100% duty cycle', auto: 'traceBoost' },
      { label: 'Engage reverse hot-water backflush cycle' },
      { label: 'Verify auxiliary fresh water reservoir autonomy' },
    ],
  },
  {
    id: 'sop-genset-fault',
    title: 'Generator Mechanical Fault / Bearing Trip',
    triggerLabel: 'Vibration / EGT / lube oil anomaly',
    systemId: 'BharatiUtilityArea',
    steps: [
      { label: 'AUTO-COMMAND: Auto-spin and synchronize Backup Genset #2 (N+1 switch)', auto: 'backupGenset' },
      { label: 'Transfer load, grid-shedding non-essential scientific experiments' },
      { label: 'Lockout/Tagout (LOTO) Genset #1 for bearing inspection' },
    ],
  },
]

export interface ActiveSop {
  protocol: SopProtocol
  /** Alert severities that triggered this SOP right now. */
  triggeredBy: StationAlert[]
}

/** Which protocols are relevant given the currently active alert set. */
export function getActiveSops(alerts: StationAlert[]): ActiveSop[] {
  const out: ActiveSop[] = []
  for (const protocol of SOP_PROTOCOLS) {
    const triggeredBy = alerts.filter(
      (a) => a.systemId === protocol.systemId && !a.autoResolved,
    )
    if (triggeredBy.length > 0) out.push({ protocol, triggeredBy })
  }
  return out
}

/** The mitigation a protocol's auto-command applies, if any. */
export function autoMitigation(protocol: SopProtocol): keyof Mitigations | null {
  return protocol.steps.find((s) => s.auto)?.auto ?? null
}
