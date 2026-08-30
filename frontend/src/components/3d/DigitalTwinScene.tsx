import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStationEquipment, getActiveAlerts } from '../../api/stations';
import type { Alert, Equipment } from '../../api/types';
import { useStationStore, type StationAlert, type SystemStatus } from '../../lib/3d/stationStore';
import { BharatiScene } from './bharati/BharatiScene';
import { MaitriScene } from './maitri/MaitriScene';
import { ModeToolbar } from './ModeToolbar';

interface DigitalTwinSceneProps {
  stationId: number;
  interactive?: boolean;
  compact?: boolean;
  lightMode?: boolean;
  selectedEquipmentId?: number | null;
  onSubsystemSelect?: (equipmentId: number | null, label: string | null) => void;
}

/* Map backend equipment status strings onto the 3D scene's SystemStatus. */
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
};

const SEVERITY_RANK: Record<SystemStatus, number> = {
  nominal: 0,
  maintenance: 1,
  elevated: 2,
  critical: 3,
};

/** Map a single equipment record onto a 3D station-system id (null = no match). */
function equipmentSystemId(eq: Equipment, activeStation: 'bharati' | 'maitri'): string | null {
  const key = `${eq.name} ${eq.equipment_type ?? ''}`.toUpperCase();
  const prefix = activeStation === 'bharati' ? 'Bharati' : 'Maitri';
  if (/GENERATOR|GENSET|BATTERY|INVERTER|UPS|SWITCHGEAR|POWER/.test(key)) return `${prefix}UtilityArea`;
  if (/FUEL/.test(key)) return `${prefix}FuelFarm`;
  if (/WATER|PUMP|OSMOSIS|REVERSE/.test(key))
    return activeStation === 'bharati' ? 'BharatiWaterPump' : 'MaitriLakeWaterPumpHouse';
  if (/HVAC|HEATER|VENTILATION|THERMAL|AIR/.test(key)) return `${prefix}MainBuilding`;
  if (/CONTAINER|STORAGE|WAREHOUSE|CRATE/.test(key))
    return activeStation === 'bharati' ? 'BharatiContainerModules' : null;
  if (/CAMP|SHELTER|SUMMER|HABITAT|LIVING|QUARTER/.test(key)) return `${prefix}SummerCamp`;
  return null;
}

/** Translate live equipment into 3D station-system status overrides. */
function buildStatusOverrides(
  equipment: Equipment[] | undefined,
  activeStation: 'bharati' | 'maitri',
): Record<string, SystemStatus> {
  const overrides: Record<string, SystemStatus> = {};
  if (!equipment) return overrides;
  for (const eq of equipment) {
    const id = equipmentSystemId(eq, activeStation);
    if (!id) continue;
    const st: SystemStatus = STATUS_TO_SYS[(eq.status ?? '').toUpperCase()] ?? 'nominal';
    if (!overrides[id] || SEVERITY_RANK[st] > SEVERITY_RANK[overrides[id]]) {
      overrides[id] = st;
    }
  }
  return overrides;
}

/**
 * Translate backend alerts into the lean 3D `StationAlert` shape so beacons,
 * utility flows and the selection ring can escalate from real anomalies.
 * Resolved alerts are dropped (they must not escalate a system).
 */
function buildStationAlerts(
  alerts: Alert[] | undefined,
  equipment: Equipment[] | undefined,
  activeStation: 'bharati' | 'maitri',
): StationAlert[] {
  if (!alerts) return [];
  const prefix = activeStation === 'bharati' ? 'Bharati' : 'Maitri';
  const eqById = new Map<number, Equipment>();
  equipment?.forEach((e) => eqById.set(e.id, e));

  const out: StationAlert[] = [];
  for (const a of alerts) {
    if (a.resolved_at) continue;
    const sev = (a.severity ?? '').toUpperCase();
    const severity: StationAlert['severity'] =
      sev === 'CRITICAL' ? 'CRITICAL' : sev === 'WARNING' ? 'WARNING' : 'INFO';

    let systemId: string | null = null;
    const type = (a.alert_type ?? '').toUpperCase();
    // Prefer an explicit equipment link (EQUIPMENT alerts carry related_entity_id = equipment.id).
    const rel = a.related_entity_id;
    if (rel != null && eqById.has(rel)) {
      systemId = equipmentSystemId(eqById.get(rel)!, activeStation);
    }
    // Fall back to a category-derived system so non-equipment alerts still light up the twin.
    if (!systemId) {
      const title = (a.title + ' ' + a.message).toUpperCase();
      if (type === 'ENERGY') {
        systemId = /FUEL|TANK|DIESEL/.test(title) ? `${prefix}FuelFarm` : `${prefix}UtilityArea`;
      } else if (type === 'ENVIRONMENT') {
        systemId = `${prefix}MainBuilding`;
      } else if (type === 'LOGISTICS') {
        systemId = activeStation === 'bharati' ? 'BharatiContainerModules' : null;
      } else if (type === 'EQUIPMENT') {
        // No entity link + generic equipment alert: leave to the equipment status overrides.
        systemId = null;
      }
    }
    if (!systemId) continue;
    out.push({ id: String(a.id), systemId, severity });
  }
  return out;
}

/**
 * Phase 4 digital twin. Renders the rich procedural Bharati / Maitri 3D model
 * for the selected station and binds live telemetry into the shared 3D store:
 *  - station id      -> active campus (Bharati vs Maitri architecture + terrain)
 *  - equipment status -> beacons, utility flows and the thermal overlay
 * Blizzard is NOT auto-triggered: the operator toggles it manually via the
 * floating ModeToolbar so high winds never override a deliberate view choice.
 */
export const DigitalTwinScene = ({ stationId, interactive = true }: DigitalTwinSceneProps) => {
  const activeStation: 'bharati' | 'maitri' = stationId === 1 ? 'maitri' : 'bharati';

  const { data: equipment } = useQuery({
    queryKey: ['equipment', stationId],
    queryFn: () => getStationEquipment(stationId),
    enabled: stationId != null,
    staleTime: 30000,
    refetchInterval: 15000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', stationId],
    queryFn: () => getActiveAlerts(stationId),
    enabled: stationId != null,
    staleTime: 30000,
    refetchInterval: 15000,
  });

  const setActiveStation = useStationStore((s) => s.setActiveStation);
  const resetStatusOverrides = useStationStore((s) => s.resetStatusOverrides);
  const setStatusOverride = useStationStore((s) => s.setStatusOverride);
  const setAlerts = useStationStore((s) => s.setAlerts);

  // Swap the 3D campus only when the station actually changes (avoids
  // clobbering an in-progress inspection on unrelated re-renders).
  useEffect(() => {
    if (useStationStore.getState().activeStation !== activeStation) {
      setActiveStation(activeStation);
    }
  }, [activeStation, setActiveStation]);

  // Push live equipment status into the 3D beacons / utility flows / thermal map.
  useEffect(() => {
    const overrides = buildStatusOverrides(equipment, activeStation);
    resetStatusOverrides();
    for (const [id, st] of Object.entries(overrides)) setStatusOverride(id, st);
  }, [equipment, activeStation, resetStatusOverrides, setStatusOverride]);

  // Push live backend alerts into the 3D store so beacons / flows escalate from
  // real anomalies (equipment status overrides still take precedence).
  useEffect(() => {
    setAlerts(buildStationAlerts(alerts, equipment, activeStation));
  }, [alerts, equipment, activeStation, setAlerts]);

  return (
    <div className={`relative h-full w-full${interactive ? '' : ' pointer-events-none'}`}>
      {activeStation === 'maitri' ? <MaitriScene /> : <BharatiScene />}
      {interactive && <ModeToolbar />}
    </div>
  );
};

export default DigitalTwinScene;
