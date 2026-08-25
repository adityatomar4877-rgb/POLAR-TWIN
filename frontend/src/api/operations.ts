import { apiClient } from './client';
import type { CommandPreviewRequest, CommandPreviewResponse, CommandRequest, CommandResponse } from './types';

export const previewCommand = async (
  stationId: number | string,
  request: CommandPreviewRequest
): Promise<CommandPreviewResponse> => {
  const { data } = await apiClient.post<CommandPreviewResponse>(`/stations/${stationId}/commands/preview`, request);
  return data;
};

export const executeCommand = async (
  stationId: number | string,
  request: CommandRequest
): Promise<CommandResponse> => {
  const { data } = await apiClient.post<CommandResponse>(`/stations/${stationId}/commands`, request);
  return data;
};

export const startGenerator = async (
  stationId: number | string,
  equipmentId: number
): Promise<CommandResponse> => {
  const { data } = await apiClient.post<CommandResponse>(`/stations/${stationId}/commands/generators/${equipmentId}/start`);
  return data;
};

export const stopGenerator = async (
  stationId: number | string,
  equipmentId: number
): Promise<CommandResponse> => {
  const { data } = await apiClient.post<CommandResponse>(`/stations/${stationId}/commands/generators/${equipmentId}/stop`);
  return data;
};
