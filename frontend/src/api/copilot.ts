import { apiClient } from './client';
import type {
  ChatMessage,
  CopilotChatResponse,
  CopilotStatusOut,
  DiagnosticResponse,
  RiskAssessmentResponse,
} from './types';

export const getCopilotStatus = async (): Promise<CopilotStatusOut> => {
  const { data } = await apiClient.get<CopilotStatusOut>('/copilot/status');
  return data;
};

export const askCopilotChat = async (
  stationId: string | number,
  message: string,
  history: ChatMessage[] = [],
  provider?: string,
  model?: string
): Promise<CopilotChatResponse> => {
  const { data } = await apiClient.post<CopilotChatResponse>(
    `/stations/${stationId}/copilot/chat`,
    {
      message,
      history,
      station_id: String(stationId),
      provider: provider || undefined,
      model: model || undefined,
    }
  );
  return data;
};

export const assessStationRisk = async (
  stationId: string | number,
  provider?: string,
  model?: string
): Promise<RiskAssessmentResponse> => {
  const { data } = await apiClient.post<RiskAssessmentResponse>(
    `/stations/${stationId}/copilot/assess-risk`,
    null,
    {
      params: {
        provider: provider || undefined,
        model: model || undefined,
      },
    }
  );
  return data;
};

export const getStationDiagnostic = async (
  stationId: string | number,
  provider?: string,
  model?: string
): Promise<DiagnosticResponse> => {
  const { data } = await apiClient.post<DiagnosticResponse>(
    `/stations/${stationId}/copilot/diagnose`,
    null,
    {
      params: {
        provider: provider || undefined,
        model: model || undefined,
      },
    }
  );
  return data;
};
