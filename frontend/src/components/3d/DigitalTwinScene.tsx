import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStationEquipment, getStationDashboard } from '../../api/stations';
import type { Equipment } from '../../api/types';
import { useStationStore, type SystemStatus } from '../../lib/3d/stationStore';
import { BharatiScene } from './bharati/BharatiScene';
import { MaitriScene } from './maitri/MaitriScene';

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

/** Translate live equipment into 3D station-system status overrides. */
function buildStatusOverrides(
  equipment: Equipment[] | undefined,
  activeStation: 'bharati' | 'maitri',
): Record<string, SystemStatus> {
  const overrides: Record<string, SystemStatus> = {};
  if (!equipment) return overrides;
  const prefix = activeStation === 'bharati' ? 'Bharati' : 'Maitri';
  for (const eq of equipment) {
    const key = `${eq.name} ${eq.equipment_type ?? ''}`.toUpperCase();
    let id: string | null = null;
    if (/GENERATOR|GENSET|BATTERY|INVERTER|UPS|SWITCHGEAR|POWER/.test(key)) {
      id = `${prefix}UtilityArea`;
    } else if (/FUEL/.test(key)) {
      id = `${prefix}FuelFarm`;
    } else if (/WATER|PUMP|OSMOSIS|REVERSE/.test(key)) {
      id = activeStation === 'bharati' ? 'BharatiWaterPump' : 'MaitriLakeWaterPumpHouse';
    } else if (/HVAC|HEATER|VENTILATION|THERMAL|AIR/.test(key)) {
      id = `${prefix}MainBuilding`;
    } else if (/CONTAINER|STORAGE|WAREHOUSE|CRATE/.test(key)) {
      id = activeStation === 'bharati' ? 'BharatiContainerModules' : null;
    } else if (/CAMP|SHELTER|SUMMER|HABITAT|LIVING|QUARTER/.test(key)) {
      id = `${prefix}SummerCamp`;
    }
    if (!id) continue;
    const st: SystemStatus = STATUS_TO_SYS[(eq.status ?? '').toUpperCase()] ?? 'nominal';
    if (!overrides[id] || SEVERITY_RANK[st] > SEVERITY_RANK[overrides[id]]) {
      overrides[id] = st;
    }
  }
  return overrides;
}

/**
 * Phase 4 digital twin. Renders the rich procedural Bharati / Maitri 3D model
 * for the selected station and binds live telemetry into the shared 3D store:
 *  - station id  -> active campus (Bharati vs Maitri architecture + terrain)
 *  - wind speed  -> blizzard / whiteout atmosphere
 *  - equipment status -> beacons, utility flows and the thermal overlay
 */
export const DigitalTwinScene = ({ stationId, interactive = true }: DigitalTwinSceneProps) => {
  const activeStation: 'bharati' | 'maitri' = stationId === 1 ? 'maitri' : 'bharati';

  const { data: equipment } = useQuery({
    queryKey: ['equipment', stationId],
    queryFn: () => getStationEquipment(stationId),
    enabled: stationId != null,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  // Shares the StationContext dashboard cache (same query key), so no extra
  // network cost; keeps wind/atmosphere in sync with the polled dashboard.
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
    enabled: stationId != null,
    staleTime: 10000,
  });

  const setActiveStation = useStationStore((s) => s.setActiveStation);
  const setWeather = useStationStore((s) => s.setWeather);
  const resetStatusOverrides = useStationStore((s) => s.resetStatusOverrides);
  const setStatusOverride = useStationStore((s) => s.setStatusOverride);

  // Swap the 3D campus only when the station actually changes (avoids
  // clobbering an in-progress inspection on unrelated re-renders).
  useEffect(() => {
    if (useStationStore.getState().activeStation !== activeStation) {
      setActiveStation(activeStation);
    }
  }, [activeStation, setActiveStation]);

  // High winds drive the blizzard particle system + whiteout lighting.
  const windSpeed = dashboard?.environment?.wind_speed ?? 0;
  useEffect(() => {
    setWeather(windSpeed > 55 ? 'blizzard' : 'clear');
  }, [windSpeed, setWeather]);

  // Push live equipment status into the 3D beacons / utility flows / thermal map.
  useEffect(() => {
    const overrides = buildStatusOverrides(equipment, activeStation);
    resetStatusOverrides();
    for (const [id, st] of Object.entries(overrides)) setStatusOverride(id, st);
  }, [equipment, activeStation, resetStatusOverrides, setStatusOverride]);

  return (
    <div className={`relative h-full w-full${interactive ? '' : ' pointer-events-none'}`}>
      {activeStation === 'maitri' ? <MaitriScene /> : <BharatiScene />}
    </div>
  );
};

export default DigitalTwinScene;
