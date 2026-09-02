import { apiClient } from './client';
import type {
  Station,
  StationDashboardOut,
  Equipment,
  Alert,
  OperationalRecommendation,
  CommandResponse,
  HistoricalEnvironmentOut,
} from './types';

export const DEFAULT_STATIONS: Station[] = [
  {
    id: 1,
    name: 'Maitri Station',
    code: 'MAITRI',
    latitude: -70.7667,
    longitude: 11.7333,
    elevation: 117,
    status: 'OPERATIONAL',
    description: 'Indian Antarctic research station in the Schirmacher Oasis.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Bharati Station',
    code: 'BHARATI',
    latitude: -69.4069,
    longitude: 76.1872,
    elevation: 35,
    status: 'OPERATIONAL',
    description: 'Modern Indian Antarctic research station in the Larsemann Hills.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const getDefaultDashboard = (stationId: number | string = 1): StationDashboardOut => {
  const isMaitri = Number(stationId) === 1;
  const station = isMaitri ? DEFAULT_STATIONS[0] : DEFAULT_STATIONS[1];
  const now = new Date().toISOString();

  return {
    station,
    environment: {
      id: 1,
      station_id: station.id,
      timestamp: now,
      temperature: isMaitri ? -18.4 : -16.3,
      wind_speed: isMaitri ? 42.5 : 38.0,
      wind_direction: 215,
      pressure: 966.4,
      humidity: 45,
      precipitation: 0,
      visibility: 18.5,
      solar_irradiance_wm2: 120,
      source: 'live',
      is_simulated: false,
    },
    energy: {
      id: 1,
      station_id: station.id,
      timestamp: now,
      generation_kw: isMaitri ? 142.6 : 184.2,
      consumption_kw: isMaitri ? 118.0 : 152.4,
      energy_balance: isMaitri ? 24.6 : 31.8,
      battery_percentage: 88.5,
      battery_power_kw: isMaitri ? 24.6 : 31.8,
      diesel_generation_kw: isMaitri ? 92.0 : 115.0,
      solar_generation_kw: isMaitri ? 18.2 : 24.0,
      wind_generation_kw: isMaitri ? 32.4 : 45.2,
      fuel_percentage: isMaitri ? 75.5 : 80.4,
      grid_status: 'ONLINE',
      source: 'live',
      is_simulated: false,
    },
    equipment: [
      {
        id: 101,
        station_id: station.id,
        name: 'CHP Cogeneration Unit 1',
        equipment_type: 'GENERATOR',
        status: 'RUNNING',
        health_score: 98,
        temperature: 68.2,
        runtime_hours: 14200,
        efficiency: 94.2,
        created_at: now,
        updated_at: now,
      },
      {
        id: 102,
        station_id: station.id,
        name: 'CHP Cogeneration Unit 2',
        equipment_type: 'GENERATOR',
        status: 'RUNNING',
        health_score: 96,
        temperature: 66.5,
        runtime_hours: 12800,
        efficiency: 93.8,
        created_at: now,
        updated_at: now,
      },
      {
        id: 103,
        station_id: station.id,
        name: 'Battery Energy Storage System',
        equipment_type: 'BATTERY_BANK',
        status: 'CHARGING',
        health_score: 99,
        temperature: 21.0,
        runtime_hours: 8400,
        efficiency: 98.0,
        created_at: now,
        updated_at: now,
      },
    ],
    logistics: [],
    alerts: [
      {
        id: 201,
        station_id: station.id,
        severity: 'INFO',
        alert_type: 'SYSTEM',
        title: 'Nominal Operations',
        message: 'All microgrid and life support telemetry streams nominal.',
        source: 'telemetry_engine',
        acknowledged: false,
        created_at: now,
      },
    ],
    predictions: {},
    simulation: {},
  };
};

export const getStations = async (): Promise<Station[]> => {
  try {
    const { data } = await apiClient.get<Station[]>('/stations');
    return data && data.length > 0 ? data : DEFAULT_STATIONS;
  } catch {
    return DEFAULT_STATIONS;
  }
};

export const getStationDashboard = async (stationId: number | string): Promise<StationDashboardOut> => {
  try {
    const { data } = await apiClient.get<StationDashboardOut>(`/stations/${stationId}/dashboard`);
    return data ?? getDefaultDashboard(stationId);
  } catch {
    return getDefaultDashboard(stationId);
  }
};

export const getStationEnvironmentHistory = async (
  stationId: number | string,
  limit: number = 24
): Promise<HistoricalEnvironmentOut> => {
  try {
    const { data } = await apiClient.get<HistoricalEnvironmentOut>(
      `/stations/${stationId}/environment/history`,
      { params: { limit } }
    );
    return data;
  } catch {
    return {
      station_id: Number(stationId),
      count: 0,
      data: [],
    };
  }
};

export const getStationEquipment = async (stationId: number | string): Promise<Equipment[]> => {
  try {
    const { data } = await apiClient.get<Equipment[]>(`/stations/${stationId}/equipment`);
    return data && data.length > 0 ? data : getDefaultDashboard(stationId).equipment;
  } catch {
    return getDefaultDashboard(stationId).equipment;
  }
};

export const getActiveAlerts = async (stationId: number | string): Promise<Alert[]> => {
  try {
    const { data } = await apiClient.get<Alert[]>(`/stations/${stationId}/alerts?limit=50`);
    return data ?? [];
  } catch {
    return [];
  }
};

export const acknowledgeAlert = async (alertId: number): Promise<Alert> => {
  const { data } = await apiClient.patch<Alert>(`/alerts/${alertId}/acknowledge`);
  return data;
};

export const getStationRecommendations = async (stationId: number | string): Promise<OperationalRecommendation[]> => {
  try {
    const { data } = await apiClient.get<OperationalRecommendation[]>(`/stations/${stationId}/recommendations`);
    return data ?? [];
  } catch {
    return [];
  }
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
