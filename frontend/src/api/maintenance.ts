import { apiClient } from './client';
import type { MaintenanceTask, MaintenanceTaskCreate, ResupplyRequest, ResupplyRequestCreate } from './types';

/* ---------- Maintenance Tasks ---------- */

export const getMaintenanceTasks = async (
  stationId: number | string,
  status?: string
): Promise<MaintenanceTask[]> => {
  const { data } = await apiClient.get<MaintenanceTask[]>(`/stations/${stationId}/maintenance`, {
    params: status ? { status } : undefined,
  });
  return data;
};

export const createMaintenanceTask = async (
  stationId: number | string,
  task: MaintenanceTaskCreate
): Promise<MaintenanceTask> => {
  const { data } = await apiClient.post<MaintenanceTask>(`/stations/${stationId}/maintenance`, task);
  return data;
};

export const completeMaintenanceTask = async (
  taskId: number,
  completedBy: string = 'Operator_Demo'
): Promise<MaintenanceTask> => {
  const { data } = await apiClient.patch<MaintenanceTask>(`/maintenance/${taskId}/complete`, null, {
    params: { completed_by: completedBy },
  });
  return data;
};

/* ---------- Resupply Requests ---------- */

export const getResupplyRequests = async (stationId: number | string): Promise<ResupplyRequest[]> => {
  const { data } = await apiClient.get<ResupplyRequest[]>(`/stations/${stationId}/logistics/resupply`);
  return data;
};

export const createResupplyRequest = async (
  stationId: number | string,
  request: ResupplyRequestCreate
): Promise<ResupplyRequest> => {
  const { data } = await apiClient.post<ResupplyRequest>(`/stations/${stationId}/logistics/resupply`, request);
  return data;
};
