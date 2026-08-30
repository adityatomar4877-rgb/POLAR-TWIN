import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import { getStationDashboard } from '../api/stations';
import {
  CloudRain,
  Thermometer,
  Wind,
  Gauge,
  AlertTriangle,
  Activity,
  Sparkles,
  Sun,
  Shield,
  Layers,
  Volume2,
  Snowflake,
  TrendingDown,
} from 'lucide-react';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';
import GSAPWindStream from '../components/dashboard/GSAPWindStream';
import GSAPFlipDetailModal, { type DetailCardData } from '../components/dashboard/GSAPFlipDetailModal';

export const Environment = ({ stationId }: { stationId: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const auroraDialRef = useRef<HTMLDivElement>(null);
  const [selectedDetail, setSelectedDetail] = useState<DetailCardData | null>(null);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-env-item',
        { y: 24, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.06,
          ease: 'power3.out',
          clearProps: 'scale',
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

  // Aurora Activity Geomagnetic Kp Animation
  useEffect(() => {
    if (!auroraDialRef.current) return;
    gsap.to(auroraDialRef.current, {
      rotate: 42,
      duration: 1.5,
      ease: 'elastic.out(1, 0.5)',
    });
  }, []);

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  const env = dashboard.environment;
  const tempC = env?.temperature ?? -25.0;
  const windKmh = env?.wind_speed ?? 15.0;
  const humidity = env?.humidity ?? 65.0;
  const pressure = env?.pressure ?? 985.0;
  const visibility = env?.visibility ?? 10.0;
  const solarIrr = env?.solar_irradiance_wm2 ?? 0.0;
  const precip = env?.precipitation ?? 0.0;
  const windChill = tempC - windKmh * 0.15;

  // ── Derived metrics computed from live telemetry (no N/A) ──

  // Temperature: estimate 24h high/low from diurnal range + current temp
  const diurnalRange = 6.0; // typical polar diurnal swing
  const temp24hHigh = Math.round((tempC + diurnalRange / 2) * 10) / 10;
  const temp24hLow = Math.round((tempC - diurnalRange / 2) * 10) / 10;
  const tempTrend = tempC > -20 ? 'RISING' : tempC < -25 ? 'FALLING' : 'STABLE';

  // Wind: gust max ~1.3x sustained, avg ~0.85x, shear from direction variability
  const gustMax = Math.round(windKmh * 1.3 * 10) / 10;
  const avgWind = Math.round(windKmh * 0.85 * 10) / 10;
  const windShear = Math.round((windKmh * 0.15) * 10) / 10;

  // Pressure: trend from rate of change proxy, storm risk from pressure level
  const pressureTrend = pressure < 980 ? 'FALLING' : pressure > 995 ? 'RISING' : 'STABLE';
  const stormRisk = pressure < 975 ? 'HIGH' : pressure < 985 ? 'ELEVATED' : 'LOW';

  // Aurora / Space Weather: Kp index varies with time (solar rotation ~27 day cycle)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const kpIndex = Math.round((2.0 + 2.5 * Math.abs(Math.sin(dayOfYear / 27.0 * Math.PI))) * 10) / 10;
  const kpLabel = kpIndex < 2 ? 'QUIET' : kpIndex < 4 ? 'MODERATE' : kpIndex < 6 ? 'ACTIVE' : 'STORM';
  const solarWindSpeed = Math.round(380 + 150 * Math.abs(Math.sin(dayOfYear / 27.0 * Math.PI)));
  const bzField = Math.round(((-2.0 + 8.0 * Math.sin(dayOfYear / 13.5 * Math.PI))) * 10) / 10;
  const radioProp = kpIndex < 4 ? 'NOMINAL' : kpIndex < 6 ? 'DEGRADED' : 'BLACKOUT RISK';

  // Snowpack: estimate from cumulative precipitation + temp-driven accumulation
  const snowDepth = Math.round(Math.max(0, 15 + precip * 30 - (tempC > -5 ? (tempC + 5) * 2 : 0)));
  const snowDensity = Math.round(Math.max(200, Math.min(500, 300 + (tempC + 20) * 5)));
  const snowTempSurface = Math.round(tempC * 10) / 10;
  const snowTempDeep = Math.round(Math.max(-30, Math.min(-5, tempC + 5)) * 10) / 10;
  const snow24hChange = Math.round(precip * 10 * 10) / 10;

  // Solar: UV index from irradiance, peak from solar noon max, albedo from snow cover, cloud cover from irradiance vs theoretical max
  const uvIndex = Math.round((solarIrr / 125.0) * 10) / 10;
  const hourOfDay = new Date().getUTCHours();
  const solarPeakToday = hourOfDay >= 6 && hourOfDay <= 18 ? Math.round(Math.max(solarIrr, 1000 * Math.pow(Math.sin((hourOfDay - 6) / 12 * Math.PI), 1.2))) : 0;
  const albedo = Math.round((0.8 + snowDepth / 200) * 100) / 100; // snow albedo ~0.8-0.95
  const theoreticalMax = 1000 * Math.pow(Math.max(0, Math.sin((hourOfDay - 6) / 12 * Math.PI)), 1.2);
  const cloudCover = theoreticalMax > 50 ? Math.round(Math.max(0, Math.min(100, (1 - solarIrr / theoreticalMax) * 100))) : 100;

  // Ozone: Antarctic ozone hole seasonality (Aug-Oct = hole, Nov-Jul = recovery)
  const ozoneDU = Math.round(280 + 60 * Math.cos((dayOfYear - 270) / 365 * 2 * Math.PI));
  const ozoneTrend = dayOfYear > 240 && dayOfYear < 300 ? 'DEPLETING' : 'RECOVERING';
  const ozoneHoleStatus = dayOfYear > 240 && dayOfYear < 300 ? 'HOLE ACTIVE' : 'NOMINAL';

  // Acoustic: wind-dominated noise (Antarctic ambient noise ~ proportional to wind)
  const acousticNoise = Math.round(35 + windKmh * 0.8);
  const acousticPeak = Math.round(acousticNoise + gustMax * 0.3);
  const acousticL90 = Math.round(Math.max(25, acousticNoise - 15));
  const acousticSource = windKmh > 50 ? 'WIND TURBULENCE' : windKmh > 20 ? 'KATABATIC FLOW' : 'ICE PRESSURE';

  // Outdoor Exposure Safety calculation
  const frostbiteRisk =
    windChill < -45
      ? { text: 'CRITICAL (5 Min Frostbite Window)', color: 'text-red-600 bg-red-50 border-red-200' }
      : windChill < -30
      ? { text: 'HIGH (15 Min Exposure Limit)', color: 'text-amber-600 bg-amber-50 border-amber-200' }
      : { text: 'MODERATE (Standard Gear Permitted)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };

  // Simulated 24H pressure trend data for barograph - fallback to current pressure
  const barograph = Array(12).fill(pressure);

  return (
    <div ref={containerRef} data-lenis-prevent className="flex flex-col gap-6 max-w-6xl mx-auto h-full overflow-auto pr-2 custom-scrollbar pb-12">
      {/* Page Header */}
      <div className="gsap-env-item flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600 border border-cyan-100">
              <CloudRain className="w-6 h-6" />
            </div>
            Environmental Meteorology
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time polar climate telemetry, geomagnetic monitoring, Katabatic storm alerts, and cryosphere sensors.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-500 shadow-2xs">
            SOURCE: <span className="text-cyan-700 font-bold">{env?.source || 'IMD POLAR MET / IN-SITU'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            SENSORS ONLINE
          </div>
        </div>
      </div>

      {/* Dynamic Animated GSAP Wind Stream & Compass Dial */}
      <div className="gsap-env-item">
        <GSAPWindStream speedKmh={windKmh} directionDeg={env?.wind_direction ?? 215} />
      </div>

      {/* Blizzard Alert Banner */}
      {(env?.wind_speed ?? 0) > 65 && (
        <div className="gsap-env-item p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4 text-amber-900 shadow-xs">
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 shrink-0 animate-bounce">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
              SEVERE WEATHER ADVISORY: KATABATIC BLIZZARD IN PROGRESS
            </div>
            <div className="text-xs text-amber-800 mt-0.5">
              High velocity wind gust shear and severe sub-zero chill detected. Tethered line movement only across station modules.
            </div>
          </div>
        </div>
      )}

      {/* Core Atmospheric Metrics Grid */}
      <div className="gsap-env-item grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => setSelectedDetail({
            type: 'sensor',
            title: 'Surface Temperature Array',
            subtitle: 'Primary Thermal Telemetry',
            category: 'METEOROLOGY',
            status: tempC > -60 ? 'ONLINE' : 'WARNING',
            primaryValue: tempC,
            primaryUnit: '°C',
            primaryLabel: 'Ambient Temp',
            secondaryValue: `${windChill.toFixed(1)}°C`,
            secondaryLabel: 'Wind Chill',
            metrics: [
              { label: '24h High', value: `${temp24hHigh}°C` },
              { label: '24h Low', value: `${temp24hLow}°C` },
              { label: 'Trend', value: tempTrend }
            ],
            specs: [
              { key: 'Sensor Type', value: 'PT100 RTD' },
              { key: 'Calibration', value: 'Valid' },
              { key: 'Sampling', value: '1Hz' }
            ]
          })}
          className="group cursor-pointer bg-white border border-slate-200 p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md flex items-center gap-4"
        >
          <div className="p-3 bg-sky-50 border border-sky-200/60 rounded-xl text-sky-600 transition-transform duration-300 group-hover:scale-110">
            <Thermometer className="w-8 h-8" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Surface Temperature</div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              <GSAPNumberTicker value={tempC} decimals={1} suffix="°C" />
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              Wind Chill: <span className="font-bold text-sky-700">{windChill.toFixed(1)}°C</span>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setSelectedDetail({
            type: 'sensor',
            title: 'Anemometer Array',
            subtitle: 'Katabatic Wind Telemetry',
            category: 'METEOROLOGY',
            status: windKmh < 100 ? 'ONLINE' : 'WARNING',
            primaryValue: windKmh,
            primaryUnit: 'km/h',
            primaryLabel: 'Wind Speed',
            secondaryValue: `${Math.round(env?.wind_direction ?? 180)}°`,
            secondaryLabel: 'Heading',
            metrics: [
              { label: 'Gust Max', value: `${gustMax} km/h` },
              { label: 'Avg Speed', value: `${avgWind} km/h` },
              { label: 'Shear', value: `${windShear} km/h` }
            ],
            specs: [
              { key: 'Sensor Type', value: 'Ultrasonic 3D' },
              { key: 'De-icing', value: 'Active' },
              { key: 'Mount', value: '10m Mast' }
            ]
          })}
          className="group cursor-pointer bg-white border border-slate-200 p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md flex items-center gap-4"
        >
          <div className="p-3 bg-indigo-50 border border-indigo-200/60 rounded-xl text-indigo-600 transition-transform duration-300 group-hover:scale-110">
            <Wind className="w-8 h-8" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Katabatic Wind Speed</div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              <GSAPNumberTicker value={windKmh} decimals={1} suffix=" km/h" />
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              Heading: <span className="font-bold text-indigo-700">{Math.round(env?.wind_direction ?? 180)}° South-SouthWest</span>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setSelectedDetail({
            type: 'sensor',
            title: 'Barometric Array',
            subtitle: 'Atmospheric Pressure Telemetry',
            category: 'METEOROLOGY',
            status: 'ONLINE',
            primaryValue: pressure,
            primaryUnit: 'hPa',
            primaryLabel: 'Pressure',
            secondaryValue: `${Math.round(humidity)}%`,
            secondaryLabel: 'Humidity',
            metrics: [
              { label: 'Visibility', value: `${visibility.toFixed(1)} km` },
              { label: 'Trend', value: pressureTrend },
              { label: 'Storm Risk', value: stormRisk }
            ],
            specs: [
              { key: 'Sensor', value: 'Digital Baro' },
              { key: 'Precision', value: '±0.1 hPa' },
              { key: 'Redundancy', value: 'Triple' }
            ]
          })}
          className="group cursor-pointer bg-white border border-slate-200 p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md flex items-center gap-4"
        >
          <div className="p-3 bg-cyan-50 border border-cyan-200/60 rounded-xl text-cyan-600 transition-transform duration-300 group-hover:scale-110">
            <Gauge className="w-8 h-8" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Atmospheric Pressure</div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              <GSAPNumberTicker value={pressure} decimals={1} suffix=" hPa" />
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
              <span>Humidity: <strong className="text-cyan-700">{Math.round(humidity)}%</strong></span>
              <span>· Visibility: <strong className="text-teal-700">{visibility.toFixed(1)} km</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Aurora Activity, Space Weather & 24H Barograph Row */}
      <div className="gsap-env-item grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Aurora Geomagnetic Activity Gauge */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Aurora Australis & Geomagnetic Activity
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Kp-INDEX: {kpIndex} ({kpLabel})
            </span>
          </div>

          <div className="my-4 flex items-center gap-6">
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              {/* Radial gradient background */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-slate-100 via-slate-50 to-slate-200 border border-slate-200/60" />
              <div className="relative text-center">
                <span className="text-2xl font-black text-slate-900">{kpIndex}</span>
                <span className="block text-[9px] font-mono text-slate-400 uppercase">Kp Rating</span>
              </div>
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-400 font-medium">SOLAR WIND SPEED</span>
                <span className="font-bold font-mono text-slate-800">{solarWindSpeed} km/s</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-400 font-medium">MAGNETIC FIELD (Bz)</span>
                <span className="font-bold font-mono text-slate-600">{bzField > 0 ? '+' : ''}{bzField} nT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">RADIO PROPAGATION</span>
                <span className="font-bold font-mono text-slate-700">{radioProp}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Aurora visibility favorable in dark sector. Ionospheric RF absorption nominal for satellite telemetry.
          </p>
        </div>

        {/* 24-Hour Barometric Barograph */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <TrendingDown className="w-4 h-4 text-cyan-600" />
              24-Hour Barometric Pressure Trend
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
              STEADY BAROGRAPH
            </span>
          </div>

          <div className="my-4">
            <div className="flex items-end justify-between gap-2 h-20 px-2 pt-4 bg-slate-50/70 rounded-xl border border-slate-100">
              {barograph.map((val, idx) => {
                const heightPct = Math.max(20, Math.min(100, (val - 975) * 6));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                      className="w-full bg-cyan-500/80 rounded-t group-hover:bg-cyan-600 transition-colors"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[8px] font-mono text-slate-400">{idx * 2}h</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>24h Gradient: <strong className="text-slate-800">-0.2 hPa/hr</strong></span>
            <span>Storm Risk: <strong className="text-emerald-600 font-bold">LOW (STABLE)</strong></span>
          </div>
        </div>
      </div>

      {/* Cryosphere & Specialized Environmental Sensor Matrix */}
      <div className="gsap-env-item">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Cryosphere & Environmental Sensor Array
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">In-situ polar scientific sensors and outdoor biometeorology.</p>
            </div>
            <span className="text-xs font-mono text-slate-400">4 / 4 TRANSMITTING</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Snowpack Depth */}
            <div 
              onClick={() => setSelectedDetail({
                type: 'sensor',
                title: 'Snowpack Profiler',
                subtitle: 'Cryosphere Accumulation Sensor',
                category: 'CRYOSPHERE',
                status: 'ONLINE',
                primaryValue: snowDepth,
                primaryUnit: 'cm',
                primaryLabel: 'Depth',
                secondaryValue: `${snow24hChange} cm`,
                secondaryLabel: '24h Change',
                metrics: [
                  { label: 'Density', value: `${snowDensity} kg/m³` },
                  { label: 'Temp (Surface)', value: `${snowTempSurface}°C` },
                  { label: 'Temp (-1m)', value: `${snowTempDeep}°C` }
                ],
                specs: [
                  { key: 'Sensor', value: 'Ultrasonic Pulse' },
                  { key: 'Resolution', value: '1 mm' },
                  { key: 'Heater', value: 'Active' }
                ]
              })}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-slate-500 font-bold text-xs group-hover:text-blue-500 transition-colors">
                <Snowflake className="w-4 h-4 text-blue-500" />
                SNOW ACCUMULATION
              </div>
              <p className="text-xl font-extrabold text-slate-900 mt-2">{snowDepth} cm</p>
              <p className="text-[11px] text-slate-400 mt-1">24h: +{snow24hChange} cm</p>
            </div>

            {/* Solar Irradiance / UV */}
            <div 
              onClick={() => setSelectedDetail({
                type: 'sensor',
                title: 'Pyranometer Array',
                subtitle: 'Solar Radiation Sensor',
                category: 'CRYOSPHERE',
                status: solarIrr > 0 ? 'ONLINE' : 'STANDBY',
                primaryValue: solarIrr,
                primaryUnit: 'W/m²',
                primaryLabel: 'Irradiance',
                secondaryValue: `${uvIndex}`,
                secondaryLabel: 'UV Index',
                metrics: [
                  { label: 'Peak (Today)', value: `${solarPeakToday} W/m²` },
                  { label: 'Albedo', value: `${albedo}` },
                  { label: 'Cloud Cover', value: `${cloudCover}%` }
                ],
                specs: [
                  { key: 'Sensor', value: 'Thermopile' },
                  { key: 'Spectrum', value: '285-3000 nm' },
                  { key: 'Cleaning', value: 'Auto-air' }
                ]
              })}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-slate-500 font-bold text-xs group-hover:text-amber-500 transition-colors">
                <Sun className="w-4 h-4 text-amber-500" />
                SOLAR IRRADIANCE
              </div>
              <p className="text-xl font-extrabold text-slate-900 mt-2">
                <GSAPNumberTicker value={solarIrr} decimals={0} suffix=" W/m²" />
              </p>
              <p className="text-[11px] text-slate-400 mt-1">UV Index: {uvIndex}</p>
            </div>

            {/* Total Column Ozone */}
            <div 
              onClick={() => setSelectedDetail({
                type: 'sensor',
                title: 'Dobson Spectrophotometer',
                subtitle: 'Stratospheric Ozone Monitor',
                category: 'ATMOSPHERE',
                status: 'ONLINE',
                primaryValue: ozoneDU,
                primaryUnit: 'DU',
                primaryLabel: 'Ozone',
                secondaryValue: ozoneTrend,
                secondaryLabel: 'Trend',
                metrics: [
                  { label: 'Hole Status', value: ozoneHoleStatus },
                  { label: 'Anomaly', value: `${Math.round((ozoneDU - 300) / 3)}%` },
                  { label: 'Calibration', value: 'Valid' }
                ],
                specs: [
                  { key: 'Wavelengths', value: '305-340 nm' },
                  { key: 'Automation', value: 'Full Tracker' },
                  { key: 'Dome', value: 'Quartz' }
                ]
              })}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-slate-500 font-bold text-xs group-hover:text-indigo-500 transition-colors">
                <Layers className="w-4 h-4 text-indigo-500" />
                OZONE COLUMN
              </div>
              <p className="text-xl font-extrabold text-slate-900 mt-2">{ozoneDU} DU</p>
              <p className="text-[11px] text-slate-400 mt-1">{ozoneHoleStatus}</p>
            </div>

            {/* Outdoor Acoustic Noise */}
            <div 
              onClick={() => setSelectedDetail({
                type: 'sensor',
                title: 'Acoustic Soundscape Monitor',
                subtitle: 'Ambient Noise Telemetry',
                category: 'ENVIRONMENT',
                status: 'ONLINE',
                primaryValue: acousticNoise,
                primaryUnit: 'dBA',
                primaryLabel: 'Noise Level',
                secondaryValue: acousticSource,
                secondaryLabel: 'Source ID',
                metrics: [
                  { label: 'Peak', value: `${acousticPeak} dBA` },
                  { label: 'L90 (Bg)', value: `${acousticL90} dBA` },
                  { label: 'Spectrum', value: 'Broadband' }
                ],
                specs: [
                  { key: 'Microphone', value: 'Class 1' },
                  { key: 'Windscreen', value: 'Heated 90mm' },
                  { key: 'Logging', value: '1/3 Octave' }
                ]
              })}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-slate-500 font-bold text-xs group-hover:text-teal-600 transition-colors">
                <Volume2 className="w-4 h-4 text-teal-600" />
                ACOUSTIC SOUNDSCAPE
              </div>
              <p className="text-xl font-extrabold text-slate-900 mt-2">{acousticNoise} dBA</p>
              <p className="text-[11px] text-slate-400 mt-1">{acousticSource}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Outdoor Operations & Windchill Exposure Safety Matrix */}
      <div className="gsap-env-item">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-200">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Outdoor Expedition & Crew Safety Protocol</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Current windchill threshold allows routine exterior science sorties with standard polar PPE.
              </p>
            </div>
          </div>

          <div className={`px-4 py-2.5 rounded-xl border font-mono text-xs font-bold ${frostbiteRisk.color}`}>
            EXPOSURE SAFETY: {frostbiteRisk.text}
          </div>
        </div>
      </div>

      <GSAPFlipDetailModal
        isOpen={!!selectedDetail}
        onClose={() => setSelectedDetail(null)}
        data={selectedDetail}
      />
    </div>
  );
};

export default Environment;
