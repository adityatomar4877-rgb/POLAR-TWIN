import { apiClient } from './client';
import type { CustomConditions, ScenarioRequest, ScenarioResponse } from './types';

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
    scenario: scenarioType,
    apply_to_live: applyToLive,
    duration_minutes: durationMinutes,
    equipment_id: equipmentId,
    custom_conditions: conditions,
  };
  const { data } = await apiClient.post<ScenarioResponse>('/simulation/scenario', req);
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

