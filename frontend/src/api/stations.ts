import { apiClient } from './client';
import type { Station, StationDashboardOut, Equipment, Alert, OperationalRecommendation, CommandResponse } from './types';

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

export const acknowledgeAlert = async (alertId: number): Promise<Alert> => {
  const { data } = await apiClient.patch<Alert>(`/alerts/${alertId}/acknowledge`);
  return data;
};

export const getStationRecommendations = async (stationId: number | string): Promise<OperationalRecommendation[]> => {
  const { data } = await apiClient.get<OperationalRecommendation[]>(`/stations/${stationId}/recommendations`);
  return data;
};

export const executeRecommendation = async (
  recId: number,
  stationId: number | string,
  requestedBy: string = 'Operator_Demo',
  role: string = 'OPERATOR'
): Promise<CommandResponse> => {
  const { data } = await apiClient.post<CommandResponse>(
    `/recommendations/${recId}/execute`,
    null,
    { params: { station_id: String(stationId), requested_by: requestedBy, role } }
  );
  return data;
};
