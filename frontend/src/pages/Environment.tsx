import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import { getStationDashboard } from '../api/stations';
import { CloudRain, Thermometer, Wind, Eye, Compass, Gauge, AlertTriangle, Activity } from 'lucide-react';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';
import GSAPWindStream from '../components/dashboard/GSAPWindStream';

export const Environment = ({ stationId }: { stationId: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-env-item',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="w-8 h-8 text-cyan-600 animate-spin" />
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
  const windChill = tempC - windKmh * 0.15;

  return (
    <div ref={containerRef} className="flex flex-col gap-6 max-w-6xl mx-auto h-full overflow-auto pr-2 custom-scrollbar pb-10">
      <div className="gsap-env-item flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-slate-800 flex items-center gap-3">
            <CloudRain className="w-6 h-6 text-cyan-600" />
            ENVIRONMENTAL_METEOROLOGY
          </h1>
          <p className="text-slate-500 text-sm mt-1">Live polar weather telemetry, atmospheric sensors, and blizzard hazard alerts.</p>
        </div>
        <div className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono text-slate-500">
          SOURCE: <span className="text-cyan-600">{env?.data_source || 'OPEN-METEO / IN-SITU SENSORS'}</span>
        </div>
      </div>

      {/* Dynamic Animated GSAP Wind Stream & Compass Dial */}
      <div className="gsap-env-item">
        <GSAPWindStream speedKmh={windKmh} directionDeg={env?.wind_direction_deg ?? 215} />
      </div>

      {env?.blizzard_warning && (
        <div className="gsap-env-item p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-600 animate-pulse">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-bold font-mono">SEVERE_WEATHER_ALERT: BLIZZARD CONDITIONS ACTIVE</div>
            <div className="text-xs text-amber-700 mt-1">High wind velocity and sub-zero temperatures detected. Restrict outdoor movements.</div>
          </div>
        </div>
      )}

      {/* Atmospheric Metrics Grid */}
      <div className="gsap-env-item grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="group bg-white border border-slate-200 p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md flex items-center gap-4">
          <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-600 transition-transform duration-300 group-hover:scale-110">
            <Thermometer className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500">SURFACE_TEMPERATURE</div>
            <div className="text-2xl font-bold font-mono text-slate-800">
              <GSAPNumberTicker value={tempC} decimals={1} suffix="°C" />
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Wind Chill: <GSAPNumberTicker value={windChill} decimals={1} suffix="°C" />
            </div>
          </div>
        </div>

        <div className="group bg-white border border-slate-200 p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md flex items-center gap-4">
          <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-600 transition-transform duration-300 group-hover:scale-110">
            <Wind className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500">WIND_VELOCITY</div>
            <div className="text-2xl font-bold font-mono text-slate-800">
              <GSAPNumberTicker value={windKmh} decimals={1} suffix=" km/h" />
            </div>
            <div className="text-xs text-slate-500 mt-1">Direction: {env?.wind_direction_deg ?? 180}° S</div>
          </div>
        </div>

        <div className="group bg-white border border-slate-200 p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md flex items-center gap-4">
          <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-600 transition-transform duration-300 group-hover:scale-110">
            <Gauge className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500">SURFACE_PRESSURE</div>
            <div className="text-2xl font-bold font-mono text-slate-800">
              <GSAPNumberTicker value={pressure} decimals={1} suffix=" hPa" />
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Relative Humidity: <GSAPNumberTicker value={humidity} decimals={1} suffix="%" />
            </div>
          </div>
        </div>
      </div>

      {/* Optical & Solar Telemetry */}
      <div className="gsap-env-item grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="group bg-white border border-slate-200 p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
          <div className="flex items-center gap-2 text-slate-600 font-bold font-mono mb-3">
            <Eye className="w-4 h-4 text-cyan-600" />
            OPTICAL_VISIBILITY
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">
            <GSAPNumberTicker value={visibility} decimals={1} suffix=" km" />
          </div>
          <p className="text-xs text-slate-500 mt-2">Station optical sensor horizon clear visibility telemetry.</p>
        </div>

        <div className="group bg-white border border-slate-200 p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
          <div className="flex items-center gap-2 text-slate-600 font-bold font-mono mb-3">
            <Compass className="w-4 h-4 text-amber-600" />
            SOLAR_IRRADIANCE
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">
            <GSAPNumberTicker value={solarIrr} decimals={1} suffix=" W/m²" />
          </div>
          <p className="text-xs text-slate-500 mt-2">Direct global solar flux on photovoltaic panels.</p>
        </div>
      </div>
    </div>
  );
};

export default Environment;

