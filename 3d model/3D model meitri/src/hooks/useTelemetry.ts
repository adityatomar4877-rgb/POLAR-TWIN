import { useMemo } from 'react'
import { readSystem, type TelemetryReading } from '../lib/telemetry'
import { useStationStore } from '../lib/stationStore'

/**
 * Live 1 Hz telemetry readings for a station system, driven by the mission
 * clock tick (all systems advance every tick whether inspected or not).
 */
export function useTelemetry(systemId: string | null): TelemetryReading[] {
  const tick = useStationStore((s) => s.missionTick)
  return useMemo(() => (systemId ? readSystem(systemId) : []), [systemId, tick])
}
