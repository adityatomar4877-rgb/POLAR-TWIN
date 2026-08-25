import { useQuery } from '@tanstack/react-query';
import { getStationDashboard } from '../api/stations';
import { CloudRain, Thermometer, Wind, Eye, Compass, Gauge, AlertTriangle, Activity } from 'lucide-react';

export const Environment = ({ stationId }: { stationId: number }) => {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const env = dashboard.environment;
  const tempC = env?.temperature_c ?? -25.0;
  const windKmh = env?.wind_speed_kmh ?? 15.0;
  const humidity = env?.humidity_percent ?? 65.0;
  const pressure = env?.pressure_hpa ?? 985.0;
  const visibility = env?.visibility_km ?? 10.0;
  const solarIrr = env?.solar_irradiance_wm2 ?? 120.0;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto h-full overflow-auto pr-2 custom-scrollbar pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-slate-100 flex items-center gap-3">
            <CloudRain className="w-6 h-6 text-cyan-400" />
            ENVIRONMENTAL_METEOROLOGY
          </h1>
          <p className="text-slate-400 text-sm mt-1">Live polar weather telemetry, atmospheric sensors, and blizzard hazard alerts.</p>
        </div>
        <div className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-400">
          SOURCE: <span className="text-cyan-400">{env?.data_source || 'OPEN-METEO / IN-SITU SENSORS'}</span>
        </div>
      </div>

      {env?.blizzard_warning && (
        <div className="p-4 bg-amber-950/30 border border-amber-900/60 rounded-lg flex items-center gap-3 text-amber-400 animate-pulse">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-bold font-mono">SEVERE_WEATHER_ALERT: BLIZZARD CONDITIONS ACTIVE</div>
            <div className="text-xs text-amber-200/80 mt-1">High wind velocity and sub-zero temperatures detected. Restrict outdoor movements.</div>
          </div>
        </div>
      )}

      {/* Atmospheric Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-cyan-950/50 border border-cyan-900/40 rounded-lg text-cyan-400">
            <Thermometer className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500">SURFACE_TEMPERATURE</div>
            <div className="text-2xl font-bold font-mono text-slate-100">{tempC.toFixed(1)}°C</div>
            <div className="text-xs text-slate-400 mt-1">Wind Chill: {(tempC - (windKmh * 0.15)).toFixed(1)}°C</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-cyan-950/50 border border-cyan-900/40 rounded-lg text-cyan-400">
            <Wind className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500">WIND_VELOCITY</div>
            <div className="text-2xl font-bold font-mono text-slate-100">{windKmh.toFixed(1)} km/h</div>
            <div className="text-xs text-slate-400 mt-1">Direction: {env?.wind_direction_deg ?? 180}° S</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-cyan-950/50 border border-cyan-900/40 rounded-lg text-cyan-400">
            <Gauge className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500">SURFACE_PRESSURE</div>
            <div className="text-2xl font-bold font-mono text-slate-100">{pressure.toFixed(1)} hPa</div>
            <div className="text-xs text-slate-400 mt-1">Relative Humidity: {humidity.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Optical & Solar Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
          <div className="flex items-center gap-2 text-slate-300 font-bold font-mono mb-3">
            <Eye className="w-4 h-4 text-cyan-400" />
            OPTICAL_VISIBILITY
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{visibility.toFixed(1)} km</div>
          <p className="text-xs text-slate-400 mt-2">Station optical sensor horizon clear visibility telemetry.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
          <div className="flex items-center gap-2 text-slate-300 font-bold font-mono mb-3">
            <Compass className="w-4 h-4 text-amber-400" />
            SOLAR_IRRADIANCE
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{solarIrr.toFixed(1)} W/m²</div>
          <p className="text-xs text-slate-400 mt-2">Direct global solar flux on photovoltaic panels.</p>
        </div>
      </div>
    </div>
  );
};
