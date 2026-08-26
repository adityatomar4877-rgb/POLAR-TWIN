export interface Station {
  id: number;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  established_year: number;
  capacity: number;
  current_population: number;
  status: string;
}

export interface SensorTelemetry {
  id: number;
  station_id: number;
  timestamp: string;
  temperature_c: number;
  humidity_percent: number;
  pressure_hpa: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  solar_irradiance_wm2: number;
  visibility_km: number;
  blizzard_warning: boolean;
  extreme_cold_alert: boolean;
  high_wind_alert: boolean;
  data_source: string;
  is_simulated: boolean;
}

export interface EnergyTelemetry {
  id: number;
  station_id: number;
  timestamp: string;
  generation_kw: number;
  consumption_kw: number;
  energy_balance: number;
  battery_percentage: number;
  battery_power_kw: number;
  diesel_generation_kw: number;
  solar_generation_kw: number;
  fuel_percentage: number;
  grid_status: string;
  source: string;
  is_simulated: boolean;
}

export interface Equipment {
  id: number;
  station_id: number;
  name: string;
  equipment_type: string;
  status: string;
  health_score: number;
  temperature?: number;
  runtime_hours?: number;
  efficiency?: number;
  last_maintenance: string;
  next_maintenance?: string;
  is_critical?: boolean;
}

export interface Alert {
  id: number;
  station_id: number;
  severity: string;
  alert_type?: string;
  title: string;
  message: string;
  source: string;
  related_entity_id?: number | null;
  is_active?: boolean;
  acknowledged: boolean;
  created_at: string;
  resolved_at?: string;
}

export interface LoadGroup {
  id: number;
  station_id: number;
  name: string;
  category: string;
  current_power_kw: number;
  priority: number;
  enabled: boolean;
  shedable: boolean;
}

export interface StationDashboardOut {
  station: Station;
  environment?: SensorTelemetry;
  energy?: EnergyTelemetry;
  equipment: Equipment[];
  logistics: any[];
  alerts: Alert[];
  predictions: Record<string, any>;
  simulation: Record<string, any>;
  operations?: Record<string, any>;
  recommendations?: any[];
  maintenance_summary?: Record<string, any>;
  resupply_summary?: Record<string, any>;
  loads?: LoadGroup[];
}

export interface CommandRequest {
  command_type: string;
  target_type?: string;
  target_id?: number;
  parameters?: Record<string, any>;
  reason?: string;
  requested_by?: string;
  role?: string;
  confirmed?: boolean;
}

export interface CommandPreviewRequest {
  command_type: string;
  target_id?: number;
  parameters?: Record<string, any>;
}

export interface CommandPreviewResponse {
  command_type: string;
  safe: boolean;
  requires_confirmation: boolean;
  current_state: Record<string, any>;
  projected_state: Record<string, any>;
  impact: {
    energy_delta_kw?: number;
    generation_change_kw?: number;
    battery_drop_percent?: number;
    fuel_consumption_change_percent?: number;
    risk_level?: string;
    description?: string;
    [key: string]: any;
  };
  warnings: string[];
  recommendations: string[];
}

export interface CommandResponse {
  success: boolean;
  command_id: number;
  command_type: string;
  station_id: number;
  station_code: string;
  status: string;
  target: Record<string, any>;
  previous_state: Record<string, any>;
  new_state: Record<string, any>;
  system_impact: Record<string, any>;
  message: string;
  executed_at?: string;
}

export interface CustomConditions {
  temperature_c?: number;
  wind_speed_kmh?: number;
  solar_factor?: number;
  blizzard_warning?: boolean;
  load_modifier_kw?: number;
  generator_1_online?: boolean;
  generator_2_online?: boolean;
  battery_percentage?: number;
  target_equipment_id?: number;
  equipment_state?: string;
  equipment_efficiency?: number;
  equipment_temp_offset?: number;
  fuel_percentage?: number;
  fuel_burn_multiplier?: number;
  resupply_delay_days?: number;
}

export interface ScenarioRequest {
  station_id: number | string;
  scenario: string;
  equipment_id?: number;
  duration_minutes?: number;
  apply_to_live?: boolean;
  custom_conditions?: CustomConditions;
}

export interface ScenarioResponse {
  station_id: number;
  station_code: string;
  scenario: string;
  impact: Record<string, any>;
  affected_systems: string[];
  recommendations: string[];
  applied_to_simulation: boolean;
  active_until?: string;
  custom_conditions?: Record<string, any>;
}

/* ---------- Operational Recommendations ---------- */

export interface OperationalRecommendation {
  id: number;
  station_id: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | string;
  category: 'ENERGY' | 'EQUIPMENT' | 'LOGISTICS' | 'ENVIRONMENT' | string;
  title: string;
  explanation: string;
  suggested_action: string;
  target_command_type?: string | null;
  target_equipment_id?: number | null;
  status: 'ACTIVE' | 'ACCEPTED' | 'DISMISSED' | 'EXECUTED' | 'EXPIRED' | string;
  created_at: string;
  expires_at?: string | null;
}

/* ---------- Audit Trail ---------- */

export interface AuditLogOut {
  id: number;
  station_id: number;
  command_id?: number | null;
  actor: string;
  action: string;
  target: string;
  result: string;
  timestamp: string;
  previous_state_json?: string | null;
  new_state_json?: string | null;
}

/* ---------- Emergency Mode ---------- */

export interface EmergencyModeRequest {
  enabled: boolean;
  reason?: string;
}

/* ---------- Maintenance ---------- */

export interface MaintenanceTask {
  id: number;
  station_id: number;
  equipment_id?: number | null;
  title: string;
  description?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  status: 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | string;
  recommended_by: string;
  assigned_to?: string | null;
  created_at: string;
  scheduled_for?: string | null;
  completed_at?: string | null;
}

export interface MaintenanceTaskCreate {
  equipment_id?: number | null;
  title: string;
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  recommended_by?: string;
  assigned_to?: string | null;
  scheduled_for?: string | null;
}

/* ---------- Resupply ---------- */

export interface ResupplyRequest {
  id: number;
  station_id: number;
  item: string;
  quantity: number;
  unit: string;
  priority: string;
  reason?: string | null;
  status: string;
  requested_by: string;
  requested_at: string;
  expected_arrival?: string | null;
  completed_at?: string | null;
}

export interface ResupplyRequestCreate {
  item: string;
  quantity: number;
  unit?: string;
  priority?: string;
  reason?: string | null;
  requested_by?: string;
}

/* ---------- Predictions ---------- */

export interface EnergyPredictionPoint {
  timestamp: string;
  predicted_consumption_kw: number;
  predicted_generation_kw: number;
  predicted_balance_kw: number;
  lower_bound_kw: number;
  upper_bound_kw: number;
  confidence: number;
}

export interface EnergyForecast {
  station_id: number;
  station_code: string;
  generated_at: string;
  horizon_hours: number;
  model_name: string;
  is_fallback: boolean;
  current_consumption_kw: number;
  average_predicted_consumption_kw: number;
  forecast: EnergyPredictionPoint[];
}

export interface FuelForecast {
  station_id: number;
  station_code: string;
  current_fuel_percentage: number;
  current_fuel_liters: number;
  estimated_daily_consumption_liters: number;
  days_until_critical: number;
  critical_threshold_percentage: number;
  projected_critical_date?: string | null;
  projected_depletion_date?: string | null;
  recommended_resupply: boolean;
  status: string;
  advisory_notes: string;
}

export interface PredictionSummaryOut {
  station_id: number;
  energy_forecast_24h: EnergyForecast;
  fuel_depletion_forecast: FuelForecast;
}

/* ---------- Simulation Status ---------- */

export interface SimulationStatusOut {
  is_running: boolean;
  interval_seconds: number;
  last_tick_at?: string | null;
  active_scenarios: Record<string, string>;
  active_scenario_expiry: Record<string, string | null>;
  total_cycles_executed: number;
}
