import { apiClient } from './client';
import type { Station, StationDashboardOut, Equipment, Alert } from './types';

export const getStations = async (): Promise<Station[]> => {
  const { data } = await apiClient.get<Station[]>('/stations');
  return data;
};

export const getStationDashboard = async (stationId: number | string): Promise<StationDashboardOut> => {
  const { data } = await apiClient.get<StationDashboardOut>(`/stations/${stationId}/dashboard`);
  return data;
};

export const getStationEquipment = async (stationId: number | string): Promise<Equipment[]> => {
  const { data } = await apiClient.get<Equipment[]>(`/stations/${stationId}/equipment`);
  return data;
};

export const getActiveAlerts = async (stationId: number | string): Promise<Alert[]> => {
  const { data } = await apiClient.get<Alert[]>(`/stations/${stationId}/alerts?limit=50`);
  return data;
};
