import { apiClient, OPERATOR_ID, OPERATOR_ROLE, SUPERVISOR_ROLE } from './client';
import type {
  CommandPreviewRequest,
  CommandPreviewResponse,
  CommandRequest,
  CommandResponse,
  AuditLogOut,
  EmergencyModeRequest,
} from './types';

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

/* ---------- Operations History (Audit Trail) ---------- */

export const getOperationsHistory = async (
  stationId: number | string,
  limit: number = 50,
  offset: number = 0
): Promise<AuditLogOut[]> => {
  const { data } = await apiClient.get<AuditLogOut[]>(`/stations/${stationId}/operations/history`, {
    params: { limit, offset },
  });
  return data;
};

/* ---------- Emergency Mode ---------- */

export const toggleEmergencyMode = async (
  stationId: number | string,
  enabled: boolean,
  reason?: string
): Promise<CommandResponse> => {
  const body: EmergencyModeRequest = { enabled, reason };
  const { data } = await apiClient.post<CommandResponse>(
    `/stations/${stationId}/commands/emergency-mode`,
    body,
    { params: { requested_by: OPERATOR_ID, role: SUPERVISOR_ROLE } }
  );
  return data;
};

/* ---------- Load Shedding / Restoration ---------- */

export const shedLoad = async (
  stationId: number | string,
  group: string = 'NON_CRITICAL',
  reason?: string
): Promise<CommandResponse> => {
  const { data } = await apiClient.post<CommandResponse>(
    `/stations/${stationId}/commands/load-shed`,
    { load_group: group, reason },
    { params: { requested_by: OPERATOR_ID, role: OPERATOR_ROLE } }
  );
  return data;
};

export const restoreLoad = async (
  stationId: number | string,
  group: string = 'ALL',
  reason?: string
): Promise<CommandResponse> => {
  const { data } = await apiClient.post<CommandResponse>(
    `/stations/${stationId}/commands/load-restore`,
    { load_group: group, reason },
    { params: { requested_by: OPERATOR_ID, role: OPERATOR_ROLE } }
  );
  return data;
};

/* ---------- Direct Equipment Actions ---------- */

export const restartEquipment = async (
  stationId: number | string,
  equipmentId: number
): Promise<CommandResponse> => {
  const { data } = await apiClient.post<CommandResponse>(
    `/stations/${stationId}/commands/equipment/${equipmentId}/restart`,
    null,
    { params: { requested_by: OPERATOR_ID, role: OPERATOR_ROLE } }
  );
  return data;
};

export const shutdownEquipment = async (
  stationId: number | string,
  equipmentId: number,
  confirmed: boolean
): Promise<CommandResponse> => {
  const { data } = await apiClient.post<CommandResponse>(
    `/stations/${stationId}/commands/equipment/${equipmentId}/shutdown`,
    null,
    { params: { confirmed, requested_by: OPERATOR_ID, role: SUPERVISOR_ROLE } }
  );
  return data;
};

export const isolateEquipment = async (
  stationId: number | string,
  equipmentId: number
): Promise<CommandResponse> => {
  const { data } = await apiClient.post<CommandResponse>(
    `/stations/${stationId}/commands/equipment/${equipmentId}/isolate`,
    null,
    { params: { requested_by: OPERATOR_ID, role: SUPERVISOR_ROLE } }
  );
  return data;
};

