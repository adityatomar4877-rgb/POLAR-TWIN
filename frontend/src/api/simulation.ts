import { apiClient } from './client';
import type { CustomConditions, ScenarioRequest, ScenarioResponse, SimulationStatusOut } from './types';

/**
 * The backend's VALID_SCENARIOS set. UI preset IDs that don't match a native
 * backend scenario are mapped to the closest one (or CUSTOM) so the injection
 * is never rejected with a 422.
 */
export const SCENARIO_NAME_MAP: Record<string, string> = {
  CUSTOM: 'CUSTOM',
  GENERATOR_FAILURE: 'GENERATOR_FAILURE',
  EXTREME_BLIZZARD: 'EXTREME_COLD',
  POLAR_NIGHT_SURGE: 'HIGH_ENERGY_DEMAND',
  CRITICAL_FUEL_SHORTAGE: 'FUEL_SHORTAGE',
  EXTREME_COLD: 'EXTREME_COLD',
  HIGH_ENERGY_DEMAND: 'HIGH_ENERGY_DEMAND',
  FUEL_SHORTAGE: 'FUEL_SHORTAGE',
  EQUIPMENT_DEGRADATION: 'EQUIPMENT_DEGRADATION',
  SUPPLY_DELAY: 'SUPPLY_DELAY',
  NORMAL_OPERATION: 'NORMAL_OPERATION',
};

/** Resolve a UI scenario name to a valid backend scenario name. */
export function resolveScenarioName(name: string): string {
  return SCENARIO_NAME_MAP[name] ?? 'CUSTOM';
}

export const runSimulationScenario = async (
  stationId: number | string,
  scenarioType: string = 'CUSTOM',
  conditions?: CustomConditions,
  applyToLive: boolean = true,
  durationMinutes: number = 60,
  equipmentId?: number
): Promise<ScenarioResponse> => {
  const req: ScenarioRequest = {
    station_id: stationId,
    scenario: resolveScenarioName(scenarioType),
    apply_to_live: applyToLive,
    duration_minutes: durationMinutes,
    equipment_id: equipmentId,
    custom_conditions: conditions,
  };
  const { data } = await apiClient.post<ScenarioResponse>('/simulation/scenario', req);
  return data;
};

export const getSimulationStatus = async (): Promise<SimulationStatusOut> => {
  const { data } = await apiClient.get<SimulationStatusOut>('/simulation/status');
  return data;
};

export const getActiveConditions = async (stationId: number | string) => {
  const { data } = await apiClient.get(`/simulation/active-conditions/${stationId}`);
  return data;
};

export const resetSimulation = async () => {
  const { data } = await apiClient.post('/simulation/reset');
  return data;
};
