import { apiClient } from './client';
import type { PredictionSummaryOut, EnergyForecast, FuelForecast } from './types';

export const getPredictionSummary = async (
  stationId: number | string
): Promise<PredictionSummaryOut> => {
  const { data } = await apiClient.get<PredictionSummaryOut>(`/stations/${stationId}/predictions`);
  return data;
};

export const getEnergyPrediction = async (
  stationId: number | string,
  horizonHours: number = 24
): Promise<EnergyForecast> => {
  const { data } = await apiClient.get<EnergyForecast>(`/stations/${stationId}/predictions/energy`, {
    params: { horizon_hours: horizonHours },
  });
  return data;
};

export const getFuelPrediction = async (stationId: number | string): Promise<FuelForecast> => {
  const { data } = await apiClient.get<FuelForecast>(`/stations/${stationId}/predictions/fuel`);
  return data;
};
