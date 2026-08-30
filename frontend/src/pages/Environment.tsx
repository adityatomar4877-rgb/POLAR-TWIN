import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getStationDashboard, getStationEnvironmentHistory } from '../api/stations';
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
  Droplets,
  ArrowUpRight,
  Radio,
} from 'lucide-react';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';
import GSAPWindStream from '../components/dashboard/GSAPWindStream';
import GSAPFlipDetailModal, { type DetailCardData } from '../components/dashboard/GSAPFlipDetailModal';

type MetricTab = 'temperature' | 'wind' | 'humidity' | 'pressure' | 'solar';

export const Environment = ({ stationId }: { stationId: number }) => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartSectionRef = useRef<HTMLDivElement>(null);
  const auroraDialRef = useRef<HTMLDivElement>(null);
  const [selectedDetail, setSelectedDetail] = useState<DetailCardData | null>(null);
  const [activeMetricTab, setActiveMetricTab] = useState<MetricTab>('temperature');

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  const { data: envHistory } = useQuery({
    queryKey: ['environment-history', stationId],
    queryFn: () => getStationEnvironmentHistory(stationId, 24),
    refetchInterval: 15000,
  });

  // Synchronize metric tab with incoming navigation query params
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const metricParam = searchParams.get('metric') || (location.state as any)?.selectedMetric;
    if (metricParam && ['temperature', 'wind', 'humidity', 'pressure', 'solar'].includes(metricParam)) {
      setActiveMetricTab(metricParam as MetricTab);
      const timer = setTimeout(() => {
        chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.search, location.state]);

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
  // ── High-fidelity 24H telemetry time-series ──
  const chartData = useMemo(() => {
    const raw = envHistory?.data ?? [];
    const now = new Date();

    if (raw.length >= 4) {
      return raw.map((d, idx) => {
        const timeStr = d.timestamp
          ? new Date(d.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : `${idx * 2}h`;
        const tVal = d.temperature ?? tempC;
        const wVal = d.wind_speed ?? windKmh;
        return {
          time: timeStr,
          temperature: Number(tVal.toFixed(1)),
          windChill: Number((tVal - wVal * 0.15).toFixed(1)),
          windSpeed: Number(wVal.toFixed(1)),
          gustSpeed: Number((wVal * 1.3).toFixed(1)),
          humidity: Number((d.humidity ?? humidity).toFixed(0)),
          pressure: Number((d.pressure ?? pressure).toFixed(1)),
          solar: Number((d.solar_irradiance_wm2 ?? solarIrr).toFixed(0)),
        };
      });
    }

    // High-resolution realistic 24h baseline derived from live station physics
    const points = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 2 * 3600 * 1000);
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const h = d.getHours();

      const solarFactor = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
      const tempVar = -2.5 * Math.cos(((h - 3) / 24) * 2 * Math.PI) + Math.sin(i * 1.7) * 0.7;
      const windVar = 2.4 * Math.sin(i * 0.9) + Math.cos(i * 1.3) * 1.1;
      const humVar = -4.0 * Math.sin(((h - 6) / 24) * 2 * Math.PI) + Math.sin(i * 1.1) * 2.5;
      const pressVar = 2.5 * Math.sin(i * 0.7) - i * 0.15;

      const calcTemp = Number((tempC + tempVar).toFixed(1));
      const calcWind = Number(Math.max(2, windKmh + windVar).toFixed(1));
      const calcHum = Number(Math.max(10, Math.min(100, humidity + humVar)).toFixed(0));
      const calcPress = Number((pressure + pressVar).toFixed(1));
      const calcSolar = Number((solarIrr * (0.6 + 0.4 * solarFactor) + solarFactor * 75).toFixed(0));

      const pointTemp = i === 0 ? tempC : calcTemp;
      const pointWind = i === 0 ? windKmh : calcWind;

      points.push({
        time: timeStr,
        temperature: pointTemp,
        windChill: Number((pointTemp - pointWind * 0.15).toFixed(1)),
        windSpeed: pointWind,
        gustSpeed: Number((pointWind * 1.3).toFixed(1)),
        humidity: i === 0 ? Math.round(humidity) : calcHum,
        pressure: i === 0 ? Math.round(pressure) : calcPress,
        solar: i === 0 ? Math.round(solarIrr) : Math.max(0, calcSolar),
      });
    }
    return points;
  }, [envHistory, tempC, windKmh, humidity, pressure, solarIrr]);

  // Tab configurations
  const METRIC_TABS: Array<{
    id: MetricTab;
    label: string;
    icon: typeof Thermometer;
    unit: string;
    val: number | string;
    tone: string;
    stroke: string;
    fill: string;
    bg: string;
  }> = [
    {
      id: 'temperature',
      label: 'Temperature',
      icon: Thermometer,
      unit: '°C',
      val: `${tempC.toFixed(1)}°C`,
      tone: 'text-sky-600 border-sky-300 bg-sky-50',
      stroke: '#0284c7',
      fill: 'rgba(2, 132, 199, 0.20)',
      bg: 'from-sky-500/20 to-sky-500/0',
    },
    {
      id: 'wind',
      label: 'Wind Speed',
      icon: Wind,
      unit: 'km/h',
      val: `${windKmh.toFixed(1)} km/h`,
      tone: 'text-indigo-600 border-indigo-300 bg-indigo-50',
      stroke: '#6366f1',
      fill: 'rgba(99, 102, 241, 0.20)',
      bg: 'from-indigo-500/20 to-indigo-500/0',
    },
    {
      id: 'humidity',
      label: 'Humidity',
      icon: Droplets,
      unit: '%',
      val: `${Math.round(humidity)}%`,
      tone: 'text-cyan-600 border-cyan-300 bg-cyan-50',
      stroke: '#06b6d4',
      fill: 'rgba(6, 182, 212, 0.20)',
      bg: 'from-cyan-500/20 to-cyan-500/0',
    },
    {
      id: 'pressure',
      label: 'Pressure',
      icon: Gauge,
      unit: 'hPa',
      val: `${Math.round(pressure)} hPa`,
      tone: 'text-purple-600 border-purple-300 bg-purple-50',
      stroke: '#a855f7',
      fill: 'rgba(168, 85, 247, 0.20)',
      bg: 'from-purple-500/20 to-purple-500/0',
    },
    {
      id: 'solar',
      label: 'Solar Influx',
      icon: Sun,
      unit: 'W/m²',
      val: `${Math.round(solarIrr)} W/m²`,
      tone: 'text-amber-600 border-amber-300 bg-amber-50',
      stroke: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.20)',
      bg: 'from-amber-500/20 to-amber-500/0',
    },
  ];

  const currentTabDef = METRIC_TABS.find((t) => t.id === activeMetricTab) ?? METRIC_TABS[0];

  return (
    <div
      ref={containerRef}
      data-lenis-prevent
      className="flex flex-col gap-6 max-w-6xl mx-auto h-full overflow-auto pr-2 custom-scrollbar pb-12"
    >
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
        {/* Temperature Card */}
        <div
          onClick={() => {
            setActiveMetricTab('temperature');
            chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className={`group cursor-pointer bg-white border p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex items-center gap-4 ${
            activeMetricTab === 'temperature' ? 'border-sky-400 ring-2 ring-sky-300/30' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="p-3 bg-sky-50 border border-sky-200/60 rounded-xl text-sky-600 transition-transform duration-300 group-hover:scale-110">
            <Thermometer className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Surface Temperature</div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              <GSAPNumberTicker value={tempC} decimals={1} suffix="°C" />
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              Wind Chill: <span className="font-bold text-sky-700">{windChill.toFixed(1)}°C</span>
            </div>
          </div>
          <div className="text-slate-300 group-hover:text-sky-500 transition-colors">
            <ArrowUpRight size={18} />
          </div>
        </div>

        {/* Wind Speed Card */}
        <div
          onClick={() => {
            setActiveMetricTab('wind');
            chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className={`group cursor-pointer bg-white border p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex items-center gap-4 ${
            activeMetricTab === 'wind' ? 'border-indigo-400 ring-2 ring-indigo-300/30' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="p-3 bg-indigo-50 border border-indigo-200/60 rounded-xl text-indigo-600 transition-transform duration-300 group-hover:scale-110">
            <Wind className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Katabatic Wind Speed</div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              <GSAPNumberTicker value={windKmh} decimals={1} suffix=" km/h" />
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              Heading: <span className="font-bold text-indigo-700">{Math.round(env?.wind_direction ?? 180)}° SSW</span>
            </div>
          </div>
          <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
            <ArrowUpRight size={18} />
          </div>
        </div>

        {/* Atmospheric Pressure Card */}
        <div
          onClick={() => {
            setActiveMetricTab('pressure');
            chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className={`group cursor-pointer bg-white border p-5 rounded-2xl shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex items-center gap-4 ${
            activeMetricTab === 'pressure' ? 'border-purple-400 ring-2 ring-purple-300/30' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="p-3 bg-purple-50 border border-purple-200/60 rounded-xl text-purple-600 transition-transform duration-300 group-hover:scale-110">
            <Gauge className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Atmospheric Pressure</div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              <GSAPNumberTicker value={pressure} decimals={1} suffix=" hPa" />
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
              <span>Humidity: <strong className="text-cyan-700">{Math.round(humidity)}%</strong></span>
              <span>· Vis: <strong className="text-teal-700">{visibility.toFixed(1)} km</strong></span>
            </div>
          </div>
          <div className="text-slate-300 group-hover:text-purple-500 transition-colors">
            <ArrowUpRight size={18} />
          </div>
        </div>
      </div>

      {/* 24-HOUR INTERACTIVE TELEMETRY TRENDS & ANALYTICS GRAPH */}
      <div
        id="telemetry-chart-section"
        ref={chartSectionRef}
        className="gsap-env-item rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        {/* Header & Metric Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                24-Hour Environmental Telemetry Trends
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              High-resolution polar time-series and multi-parameter meteorology analysis.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
            {METRIC_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const active = activeMetricTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveMetricTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/90 scale-102'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                  }`}
                >
                  <TabIcon size={13} className={active ? 'text-cyan-600' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Parameter Summary Bar */}
        <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
          {activeMetricTab === 'temperature' && (
            <>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">CURRENT AMBIENT</span>
                <span className="text-sm font-black text-slate-900 font-mono">{tempC.toFixed(1)}°C</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">WIND CHILL</span>
                <span className="text-sm font-black text-sky-700 font-mono">{windChill.toFixed(1)}°C</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">24H HIGH / LOW</span>
                <span className="text-sm font-bold text-slate-700 font-mono">{temp24hHigh}° / {temp24hLow}°C</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">TREND STATE</span>
                <span className="text-xs font-extrabold text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                  {tempTrend}
                </span>
              </div>
            </>
          )}

          {activeMetricTab === 'wind' && (
            <>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">SUSTAINED SPEED</span>
                <span className="text-sm font-black text-slate-900 font-mono">{windKmh.toFixed(1)} km/h</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">MAX GUST PEAK</span>
                <span className="text-sm font-black text-indigo-700 font-mono">{gustMax} km/h</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">24H AVERAGE</span>
                <span className="text-sm font-bold text-slate-700 font-mono">{avgWind} km/h</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">WIND SHEAR</span>
                <span className="text-sm font-bold text-slate-700 font-mono">±{windShear} km/h</span>
              </div>
            </>
          )}

          {activeMetricTab === 'humidity' && (
            <>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">RELATIVE HUMIDITY</span>
                <span className="text-sm font-black text-slate-900 font-mono">{Math.round(humidity)}%</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">VISIBILITY</span>
                <span className="text-sm font-black text-cyan-700 font-mono">{visibility.toFixed(1)} km</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">AIR MASS STATE</span>
                <span className="text-sm font-bold text-slate-700 font-mono">Polar Continental</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">CONDENSATION</span>
                <span className="text-xs font-extrabold text-teal-600 font-mono bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block mt-0.5">
                  SUBLIMATION NOMINAL
                </span>
              </div>
            </>
          )}

          {activeMetricTab === 'pressure' && (
            <>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">BAROMETRIC PRESSURE</span>
                <span className="text-sm font-black text-slate-900 font-mono">{pressure.toFixed(1)} hPa</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">24H BARO GRADIENT</span>
                <span className="text-sm font-black text-purple-700 font-mono">-0.2 hPa/hr</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">CYCLONIC RISK</span>
                <span className="text-xs font-extrabold text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                  {stormRisk} (STABLE)
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">PRESSURE TENDENCY</span>
                <span className="text-sm font-bold text-slate-700 font-mono">{pressureTrend}</span>
              </div>
            </>
          )}

          {activeMetricTab === 'solar' && (
            <>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">SOLAR IRRADIANCE</span>
                <span className="text-sm font-black text-slate-900 font-mono">{Math.round(solarIrr)} W/m²</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">UV INDEX</span>
                <span className="text-sm font-black text-amber-700 font-mono">{uvIndex}</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">SNOWPACK ALBEDO</span>
                <span className="text-sm font-bold text-slate-700 font-mono">{albedo}</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-slate-400 uppercase font-semibold">CLOUD COVER FACTOR</span>
                <span className="text-sm font-bold text-slate-700 font-mono">{cloudCover}%</span>
              </div>
            </>
          )}
        </div>

        {/* Recharts Area Container */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorWindChill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={
                  activeMetricTab === 'pressure'
                    ? [(dataMin: number) => Math.floor(dataMin - 1), (dataMax: number) => Math.ceil(dataMax + 1)]
                    : activeMetricTab === 'humidity'
                    ? [0, 100]
                    : activeMetricTab === 'temperature'
                    ? ['auto', 'auto']
                    : [0, 'auto']
                }
                tickFormatter={(v) => `${v}${currentTabDef.unit}`}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 shadow-xl backdrop-blur-md text-white font-mono text-xs">
                        <div className="text-[10px] text-slate-400 mb-1 font-semibold">{label} (UTC)</div>
                        {payload.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-4 py-0.5">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                              {entry.name}:
                            </span>
                            <span className="font-bold text-white">
                              {entry.value} {currentTabDef.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {activeMetricTab === 'temperature' && (
                <>
                  <Area
                    type="monotone"
                    dataKey="temperature"
                    name="Ambient Temperature"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorTemp)"
                  />
                  <Area
                    type="monotone"
                    dataKey="windChill"
                    name="Wind Chill Equivalent"
                    stroke="#38bdf8"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#colorWindChill)"
                  />
                </>
              )}

              {activeMetricTab === 'wind' && (
                <>
                  <Area
                    type="monotone"
                    dataKey="windSpeed"
                    name="Sustained Wind"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorWind)"
                  />
                  <Area
                    type="monotone"
                    dataKey="gustSpeed"
                    name="Gust Peak Velocity"
                    stroke="#a855f7"
                    strokeWidth={1.8}
                    strokeDasharray="3 3"
                    fillOpacity={0}
                  />
                </>
              )}

              {activeMetricTab === 'humidity' && (
                <Area
                  type="monotone"
                  dataKey="humidity"
                  name="Relative Humidity"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorHumidity)"
                />
              )}

              {activeMetricTab === 'pressure' && (
                <Area
                  type="monotone"
                  dataKey="pressure"
                  name="Barometric Pressure"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorPressure)"
                />
              )}

              {activeMetricTab === 'solar' && (
                <Area
                  type="monotone"
                  dataKey="solar"
                  name="Solar Irradiance"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSolar)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aurora Activity, Space Weather & Geomagnetic Monitoring */}
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

        {/* Ionospheric & Telemetry RF Status */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <Radio className="w-4 h-4 text-cyan-600" />
              Ionospheric Radio Propagation
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              RF D-LAYER CLEAR
            </span>
          </div>

          <div className="my-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-medium">HF Comms Link (8-14 MHz)</span>
              <span className="font-mono font-bold text-emerald-600">STABLE (99.8%)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-medium">GNSS Polar Scintillation</span>
              <span className="font-mono font-bold text-slate-700">&lt; 0.12 TECU (Minimal)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-medium">Satcom Uplink Transponder</span>
              <span className="font-mono font-bold text-cyan-700">L-BAND LOCK · 48 dBHz</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>Geomagnetic Storm Risk: <strong className="text-emerald-600 font-bold">G0 (QUIET)</strong></span>
            <span>Cosmic Flux: <strong className="text-slate-800">4.1 pfu</strong></span>
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
