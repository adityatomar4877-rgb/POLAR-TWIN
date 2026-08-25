import { apiClient } from './client';
import type { ScenarioRequest, ScenarioResponse } from './types';

export const runSimulationScenario = async (
  stationId: number | string,
  scenarioType: string
): Promise<ScenarioResponse> => {
  const req: ScenarioRequest = {
    station_id: stationId,
    scenario: scenarioType,
    apply_to_live: true,
  };
  const { data } = await apiClient.post<ScenarioResponse>('/simulation/scenario', req);
  return data;
};

export const resetSimulation = async () => {
  const { data } = await apiClient.post('/simulation/reset');
  return data;
};
