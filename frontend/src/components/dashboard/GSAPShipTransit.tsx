import { useEffect, useRef, useState, useMemo } from 'react';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Anchor,
  Snowflake,
  Gauge,
  Clock,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Navigation,
  MountainSnow,
  MapPin,
  Package,
  Wind,
  Thermometer,
  Waves,
  Info,
  Calendar,
  Radio,
  X,
  Compass,
  Check,
} from 'lucide-react';
import { useStation } from '../../context/StationContext';
import polarVesselImg from '../../assets/r_v_bharati.webp';

export interface GSAPShipTransitProps {
  progress?: number;
  origin?: string;
  originDetails?: string;
  departedDate?: string;
  destination?: string;
  destinationDetails?: string;
  totalDistanceKm?: number;
  vesselName?: string;
  voyageNumber?: string;
}

interface Waypoint {
  id: string;
  name: string;
  location: string;
  distanceKm: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  passedDate?: string;
  remainingKm?: number;
  etaString?: string;
  coordinates: string;
  sector: string;
  iceConditions: string;
  bathymetry: string;
}

/* -------------------------------------------------------------------------
 * R/V Bharati Indian Antarctic Program Expedition Vessel Graphic
 * ------------------------------------------------------------------------- */
function PolarVesselIllustration({ className = 'h-10 w-auto md:h-12' }: { className?: string }) {
  return (
    <div className="relative flex items-center justify-center select-none">
      <img
        src={polarVesselImg}
        alt="R/V Bharati Polar Expedition Vessel · Indian Antarctic Program"
        className={`${className} object-contain drop-shadow-[0_6px_14px_rgba(2,132,199,0.4)] transition-transform duration-300 pointer-events-none`}
        draggable={false}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Background Polar Mountain Contour SVG
 * ------------------------------------------------------------------------- */
function PolarBackgroundContour() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 select-none">
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft distant mountain ridge */}
        <path
          d="M0 160 Q120 120 220 145 T450 110 T680 150 T880 105 T1000 130 L1000 300 L0 300 Z"
          fill="url(#polar-mountain-gradient)"
        />
        {/* Subtle ice pack shelf lines */}
        <path
          d="M0 210 C150 200 280 225 420 215 C600 205 750 230 1000 210"
          stroke="#93c5fd"
          strokeWidth="1.2"
          strokeDasharray="4 8"
          opacity="0.6"
        />
        <path
          d="M0 245 C200 235 400 260 620 240 C800 225 900 250 1000 235"
          stroke="#60a5fa"
          strokeWidth="1"
          strokeDasharray="6 12"
          opacity="0.4"
        />
        <defs>
          <linearGradient id="polar-mountain-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Main Enhanced GSAPShipTransit Component
 * ------------------------------------------------------------------------- */
export default function GSAPShipTransit({
  progress: customProgress,
  origin = 'Mormugao Port',
  originDetails = 'Goa, India',
  departedDate = '12 Aug 2026',
  destination = 'Lasermann Hills',
  destinationDetails = 'Ice Edge, Antarctica',
  totalDistanceKm = 9450,
  vesselName = 'R/V Bharati Polar Expedition Vessel',
  voyageNumber = 'Voyage #44',
}: GSAPShipTransitProps) {
  const { dashboard } = useStation();

  const containerRef = useRef<HTMLDivElement>(null);
  const shipMarkerRef = useRef<HTMLDivElement>(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);
  const [isVesselModalOpen, setIsVesselModalOpen] = useState(false);

  // Digital Twin Environment & Simulation State
  const env = dashboard?.environment;
  const sim = dashboard?.simulation;
  const isSimulated = Boolean(env?.is_simulated || sim?.is_running);
  const activeScenario = sim?.active_scenario ?? 'NORMAL_OPERATION';

  // Calculate dynamic progress
  const progress = useMemo(() => {
    if (typeof customProgress === 'number') return customProgress;
    if (activeScenario === 'SUPPLY_DELAY') return 54;
    return 68;
  }, [customProgress, activeScenario]);

  // Dynamic calculations based on backend telemetry
  const distanceTravelled = useMemo(() => {
    return Math.round((progress / 100) * totalDistanceKm);
  }, [progress, totalDistanceKm]);

  const remainingDistance = useMemo(() => {
    return totalDistanceKm - distanceTravelled;
  }, [totalDistanceKm, distanceTravelled]);

  // Adjust speed and ETA if simulation scenario introduces adverse polar weather or route delay
  const telemetry = useMemo(() => {
    let speed = 14.2;
    let etaDays = 14;
    let etaSub = 'Estimated Arrival';
    let iceRisk = 'LOW';
    let seaState = 'Moderate';

    const windSpeed = env?.wind_speed ?? 18.6;
    const tempC = env?.temperature ?? -21.8;

    if (activeScenario === 'SUPPLY_DELAY') {
      speed = 8.4;
      etaDays = 18.5;
      etaSub = '+4.5d Severe Sea Ice Delay';
      iceRisk = 'HIGH';
      seaState = 'Heavy Pack Ice (8/10)';
    } else if ((env?.wind_speed ?? 0) > 65 || activeScenario === 'EXTREME_COLD') {
      speed = 10.1;
      etaDays = 16.0;
      etaSub = '+2.0d Storm Throttling';
      iceRisk = 'MODERATE';
      seaState = 'Rough Swell (3.5m)';
    } else if (windSpeed > 50) {
      speed = 11.5;
      etaDays = 15.2;
      iceRisk = 'MODERATE';
      seaState = 'Rough Swell (2.8m)';
    }

    return {
      speed: speed.toFixed(1),
      etaDays: Math.round(etaDays),
      etaSub,
      iceRisk,
      seaState,
      windSpeed: windSpeed.toFixed(1),
      windDir: env?.wind_direction ? `${Math.round(env.wind_direction)}° SW` : '195° SW',
      temperature: tempC.toFixed(1),
      cargoUtilized: 82,
    };
  }, [env, activeScenario]);

  // Waypoints configuration
  const waypoints: Waypoint[] = useMemo(
    () => [
      {
        id: 'departure',
        name: 'Departure',
        location: `${origin}, ${originDetails}`,
        distanceKm: 0,
        status: 'COMPLETED',
        passedDate: departedDate,
        coordinates: "15°24'N, 73°47'E",
        sector: 'Arabian Sea / Indian Ocean Sector 1',
        iceConditions: 'Open Water (Sea Temp +28°C)',
        bathymetry: 'Continental Shelf · Depth 18m',
      },
      {
        id: 'southern-ocean',
        name: 'Southern Ocean',
        location: 'Southern Ocean Transit Corridor',
        distanceKm: 4250,
        status: 'COMPLETED',
        passedDate: '20 Aug 2026',
        coordinates: "38°40'S, 64°15'E",
        sector: 'Sub-Antarctic Roaring Forties',
        iceConditions: 'Open Swell · First Iceberg Watch',
        bathymetry: 'Abyssal Plain · Depth 4,100m',
      },
      {
        id: 'antarctic-approach',
        name: 'Antarctic Approach',
        location: 'Prydz Bay Gateway Approach',
        distanceKm: 7600,
        status: progress >= 80 ? 'COMPLETED' : progress >= 50 ? 'IN_PROGRESS' : 'PENDING',
        remainingKm: Math.max(0, 7600 - distanceTravelled),
        etaString: 'ETA: 4d 18h',
        coordinates: "64°30'S, 72°10'E",
        sector: 'Prydz Bay Outer Polar Sector',
        iceConditions: 'Grease Ice & Pancake Ice Formation (2/10)',
        bathymetry: 'Polar Slope · Depth 1,250m',
      },
      {
        id: 'destination',
        name: 'Lasermann Hills',
        location: `${destination}, ${destinationDetails}`,
        distanceKm: totalDistanceKm,
        status: progress >= 100 ? 'COMPLETED' : 'PENDING',
        remainingKm: remainingDistance,
        etaString: `ETA: ${telemetry.etaDays} Days`,
        coordinates: "69°24'S, 76°11'E",
        sector: 'Larsemann Hills Coastal Polarity Zone',
        iceConditions: 'Fast-Ice Belt (Thickness 1.4m · Polar Class 5 Escort Ready)',
        bathymetry: 'Quilty Bay Fjord · Depth 140m',
      },
    ],
    [
      origin,
      originDetails,
      departedDate,
      destination,
      destinationDetails,
      totalDistanceKm,
      progress,
      distanceTravelled,
      remainingDistance,
      telemetry.etaDays,
    ]
  );

  // GSAP Smooth Vessel & Progress Animation
  useEffect(() => {
    if (!shipMarkerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(shipMarkerRef.current, {
        left: `${progress}%`,
        duration: 1.6,
        ease: 'power3.out',
      });
    }, containerRef);

    return () => ctx.revert();
  }, [progress]);

  return (
    <div
      ref={containerRef}
      className="group relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white font-sans shadow-sm transition-all duration-300 hover:shadow-md"
    >
      {/* -------------------------------------------------------------------------
       * Header Section
       * ------------------------------------------------------------------------- */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-extrabold uppercase tracking-widest text-blue-600">
              Active Maritime Resupply Voyage
            </span>
            <span className="text-slate-300 font-bold">·</span>
            {isSimulated && activeScenario !== 'NORMAL_OPERATION' ? (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                SIMULATION ACTIVE: {activeScenario.replace(/_/g, ' ')}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 md:text-2xl">
            {vesselName} · {voyageNumber}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            Antarctic Resupply Mission · NCPOR Goa Logistics Cell → {destination}
          </p>
        </div>

        {/* Circular Progress Ring */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-3 shadow-xs">
          <div className="text-right">
            <div className="text-xl font-extrabold font-mono text-blue-700 tracking-tight">
              {progress}% COMPLETE
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Voyage Progress
            </div>
          </div>
          <div className="relative h-12 w-12 shrink-0">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-slate-200"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-blue-600 transition-all duration-1000 ease-out"
                strokeDasharray={`${progress}, 100`}
                strokeWidth="3.8"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------------
       * Polar Route Canvas (Centerpiece Map)
       * ------------------------------------------------------------------------- */}
      <div className="relative min-h-[380px] w-full overflow-hidden bg-gradient-to-b from-sky-50/70 via-blue-50/40 to-slate-50/80 px-6 py-8 border-b border-slate-100 flex flex-col justify-center select-none">
        <PolarBackgroundContour />

        {/* Polar Sea Subtle Ice Floes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
          <div className="absolute top-[28%] left-[22%] w-12 h-4 rounded-[40%] bg-white/80 border border-sky-200/60 shadow-xs" />
          <div className="absolute top-[68%] left-[16%] w-16 h-5 rounded-[45%] bg-white/70 border border-sky-200/50 shadow-xs" />
          <div className="absolute top-[32%] right-[26%] w-14 h-4.5 rounded-[50%] bg-white/80 border border-sky-200/60 shadow-xs" />
          <div className="absolute top-[72%] right-[18%] w-20 h-6 rounded-[40%] bg-white/75 border border-sky-200/50 shadow-xs" />
        </div>

        <div className="relative mx-auto w-full max-w-5xl h-[280px]">
          {/* Curved SVG Nautical Route Track */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1000 280"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="active-route-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="60%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0284c7" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* Background Remaining Dashed Track */}
            <path
              d="M 120 148 C 280 128, 460 128, 620 140 C 760 152, 840 156, 900 148"
              stroke="#cbd5e1"
              strokeWidth="3"
              strokeDasharray="6 6"
              strokeLinecap="round"
            />

            {/* Active Completed Route Line (Interpolated by Progress) */}
            <path
              d="M 120 148 C 280 128, 460 128, 620 140 C 760 152, 840 156, 900 148"
              stroke="url(#active-route-gradient)"
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#route-glow)"
              style={{
                strokeDasharray: '800',
                strokeDashoffset: `${800 - (progress / 100) * 800}`,
                transition: 'stroke-dashoffset 1.2s ease-out',
              }}
            />
          </svg>

          {/* 1. Departure Card & Node (Left) */}
          <div className="absolute left-[12%] top-[53%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              onClick={() => setSelectedWaypoint(waypoints[0])}
              className="absolute -top-34 flex w-38 cursor-pointer flex-col items-center rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 text-center shadow-sm backdrop-blur-md transition-all hover:border-blue-400 hover:shadow-md"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-600 shadow-xs">
                <Anchor size={16} />
              </div>
              <span className="mb-0.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                Departure
              </span>
              <span className="text-xs font-extrabold leading-tight text-slate-900">
                {origin}
                <br />
                <span className="text-[10px] font-semibold text-slate-500">{originDetails}</span>
              </span>
              <div className="mt-2 flex items-center gap-1 rounded-md bg-blue-50/70 px-2 py-0.5 font-mono text-[9px] font-bold text-blue-700">
                <Calendar size={10} />
                <span>{departedDate}</span>
              </div>
            </motion.div>
            <div className="h-5 w-5 rounded-full border-[3.5px] border-white bg-blue-600 shadow-md ring-2 ring-blue-400" />
          </div>

          {/* 2. Southern Ocean Node */}
          <div className="absolute left-[36%] top-[47%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
            <motion.div
              whileHover={{ scale: 1.05 }}
              onClick={() => setSelectedWaypoint(waypoints[1])}
              className="absolute -top-16 flex cursor-pointer flex-col items-center text-center w-28"
            >
              <span className="mb-1 text-xs font-extrabold text-slate-800">Southern Ocean</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm transition-transform hover:scale-110">
                <CheckCircle2 size={16} />
              </div>
            </motion.div>
            <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
          </div>

          {/* 3. The Moving Ship Marker */}
          <div
            ref={shipMarkerRef}
            style={{ left: `${Math.max(14, Math.min(86, progress))}%` }}
            className="absolute top-[50%] -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center"
          >
            {/* Callout Above Vessel */}
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              onClick={() => setIsVesselModalOpen(true)}
              className="absolute -top-20 flex cursor-pointer flex-col items-center whitespace-nowrap rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-1.5 text-center shadow-lg backdrop-blur-md transition-all hover:border-blue-400 hover:shadow-xl z-40"
            >
              <div className="flex items-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-widest text-emerald-600 mb-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Vessel In Transit
              </div>
              <div className="font-mono text-[10.5px] font-extrabold text-slate-800">
                {telemetry.speed} kn · 48°12'S, 52.4°E
              </div>
              {/* Downward triangle pointer */}
              <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
            </motion.div>

            {/* Radar Ripple Waves & 3D Polar Research Vessel */}
            <div
              className="relative flex items-center justify-center cursor-pointer group/ship"
              onClick={() => setIsVesselModalOpen(true)}
            >
              {/* Concentric Elliptical Water Ripple Rings */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                <span className="absolute h-9 w-24 rounded-[100%] border border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_12px_rgba(34,211,238,0.3)] animate-pulse" />
                <span className="absolute h-14 w-32 rounded-[100%] border border-sky-400/30 animate-ping opacity-40" />
                <span className="absolute h-19 w-42 rounded-[100%] border border-blue-400/20" />
              </div>

              {/* 3D Polar Research Vessel Image Graphic */}
              <div className="relative z-10 transition-transform duration-300 group-hover/ship:scale-108 group-hover/ship:-translate-y-0.5">
                <PolarVesselIllustration className="h-11 w-auto md:h-13 drop-shadow-[0_6px_14px_rgba(2,132,199,0.35)]" />
              </div>
            </div>

            {/* Coordinates Badge Below Ship */}
            <div
              onClick={() => setIsVesselModalOpen(true)}
              className="mt-1 cursor-pointer rounded-full bg-slate-900/90 px-2.5 py-0.5 font-mono text-[8.5px] font-bold text-cyan-300 shadow-md ring-1 ring-cyan-400/40 backdrop-blur-sm transition-all hover:bg-blue-900 hover:ring-cyan-300"
            >
              48°12'S · 52.4°E
            </div>
          </div>

          {/* 4. Antarctic Approach Node */}
          <div className="absolute left-[76%] top-[51%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
            <motion.div
              whileHover={{ scale: 1.05 }}
              onClick={() => setSelectedWaypoint(waypoints[2])}
              className="absolute -top-18 flex cursor-pointer flex-col items-center text-center w-32"
            >
              <span className="mb-1 text-xs font-extrabold text-slate-800 leading-tight">
                Antarctic
                <br />
                Approach
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-400 bg-blue-50 text-blue-600 shadow-sm ring-2 ring-blue-200">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              </div>
            </motion.div>
            <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-sm" />
          </div>

          {/* 5. Destination Card & Node (Right) */}
          <div className="absolute right-[10%] top-[53%] translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              onClick={() => setSelectedWaypoint(waypoints[3])}
              className="absolute -top-34 flex w-40 cursor-pointer flex-col items-center rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 text-center shadow-sm backdrop-blur-md transition-all hover:border-blue-400 hover:shadow-md"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sky-600 shadow-xs">
                <Snowflake size={16} />
              </div>
              <span className="mb-0.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                Destination
              </span>
              <span className="text-xs font-extrabold leading-tight text-slate-900">
                {destination}
                <br />
                <span className="text-[10px] font-semibold text-slate-500">{destinationDetails}</span>
              </span>
              <div className="mt-2 flex items-center gap-1 rounded-md bg-emerald-50/70 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700">
                <Calendar size={10} />
                <span>ETA: {telemetry.etaDays} Days</span>
              </div>
            </motion.div>
            <div className="h-5 w-5 rounded-full border-[3.5px] border-white bg-slate-300 shadow-md" />
          </div>

          {/* Floating Distance Travelled Badge (Center-Lower) */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="absolute left-1/2 top-[82%] -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-5 py-2.5 shadow-sm backdrop-blur-md select-none z-20"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
              <MapPin size={16} />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5 font-mono leading-none">
                <span className="text-sm font-extrabold text-blue-600">
                  {distanceTravelled.toLocaleString()} km
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  of {totalDistanceKm.toLocaleString()} km
                </span>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                Distance Travelled
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* -------------------------------------------------------------------------
       * Voyage Telemetry Strip (5 Metric Cards Across)
       * ------------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 divide-y divide-slate-100 border-b border-slate-100 bg-white sm:grid-cols-3 md:grid-cols-5 md:divide-x md:divide-y-0">
        {/* Speed */}
        <div className="flex items-center gap-3.5 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
            <Gauge size={20} />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Speed
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl font-extrabold text-slate-900">{telemetry.speed}</span>
              <span className="text-xs font-bold text-slate-500">kn</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Current Speed</span>
          </div>
        </div>

        {/* Distance Travelled */}
        <div className="flex items-center gap-3.5 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
            <Navigation size={20} />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Distance Travelled
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl font-extrabold text-slate-900">
                {distanceTravelled.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-500">km</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">
              of {totalDistanceKm.toLocaleString()} km
            </span>
          </div>
        </div>

        {/* ETA */}
        <div className="flex items-center gap-3.5 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
            <Clock size={20} />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ETA
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl font-extrabold text-slate-900">{telemetry.etaDays}</span>
              <span className="text-xs font-bold text-slate-500">Days</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">{telemetry.etaSub}</span>
          </div>
        </div>

        {/* Ice Risk */}
        <div className="flex items-center gap-3.5 p-5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
              telemetry.iceRisk === 'LOW'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                : 'border-amber-100 bg-amber-50 text-amber-600'
            }`}
          >
            {telemetry.iceRisk === 'LOW' ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Ice Risk
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className={`font-mono text-xl font-extrabold ${
                  telemetry.iceRisk === 'LOW' ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {telemetry.iceRisk}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Current Conditions</span>
          </div>
        </div>

        {/* Cargo Status */}
        <div className="flex items-center gap-3.5 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-600">
            <Package size={20} />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Cargo Status
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl font-extrabold text-slate-900">
                {telemetry.cargoUtilized}%
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Capacity Utilized</span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------------
       * Voyage Milestones & Next Milestone Panel
       * ------------------------------------------------------------------------- */}
      <div className="flex flex-col gap-6 bg-slate-50/40 p-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: Milestones Stepper */}
        <div className="flex-1">
          <span className="mb-4 block font-mono text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            Voyage Milestones
          </span>

          <div className="relative px-2">
            {/* Connecting Track */}
            <div className="absolute left-6 right-6 top-3 h-[2px] bg-slate-200" />
            <div
              className="absolute left-6 top-3 h-[2.5px] bg-blue-600 transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, (progress / 100) * 100))}%` }}
            />

            <div className="relative flex justify-between">
              {waypoints.map((wp) => {
                const isCompleted = wp.status === 'COMPLETED';
                const isInProgress = wp.status === 'IN_PROGRESS';

                return (
                  <div
                    key={wp.id}
                    onClick={() => setSelectedWaypoint(wp)}
                    className="group flex cursor-pointer flex-col items-center text-center"
                  >
                    <div
                      className={`mb-2 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ring-4 ring-slate-50 ${
                        isCompleted
                          ? 'bg-blue-600 text-white shadow-xs'
                          : isInProgress
                          ? 'border-2 border-blue-600 bg-white text-blue-600 shadow-sm ring-blue-100'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check size={13} strokeWidth={3} />
                      ) : isInProgress ? (
                        <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      )}
                    </div>
                    <span className="block text-xs font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">
                      {wp.name}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-500">
                      {wp.passedDate ??
                        (wp.remainingKm ? `${wp.remainingKm.toLocaleString()} km remaining` : `${wp.distanceKm.toLocaleString()} km total`)}
                    </span>
                    <span
                      className={`mt-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider ${
                        isCompleted
                          ? 'text-emerald-600'
                          : isInProgress
                          ? 'text-blue-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {wp.status.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Next Milestone Highlight Card */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={() => setSelectedWaypoint(waypoints[2])}
          className="flex cursor-pointer items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-4.5 shadow-xs transition-all hover:bg-blue-50 hover:shadow-sm lg:w-84 shrink-0"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-100 text-blue-600">
            <MountainSnow size={24} />
          </div>
          <div className="flex-1">
            <span className="block text-[9px] font-extrabold uppercase tracking-widest text-blue-600">
              Next Milestone
            </span>
            <h4 className="text-sm font-extrabold text-slate-900">Antarctic Approach</h4>
            <span className="block text-[11px] font-mono font-medium text-slate-600">
              ~1,850 km remaining
            </span>
          </div>
          <div className="text-right">
            <span className="block font-mono text-[10px] font-bold text-blue-500">ETA</span>
            <span className="block font-mono text-sm font-extrabold text-blue-700">4d 18h</span>
          </div>
        </motion.div>
      </div>

      {/* -------------------------------------------------------------------------
       * Live Environment Footer Strip
       * ------------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-white px-6 py-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Wind size={15} className="text-blue-500" />
            <span className="font-mono text-slate-400 font-bold uppercase text-[10px]">WIND</span>
            <span className="font-mono font-bold text-slate-800">{telemetry.windSpeed} km/h {telemetry.windDir}</span>
          </div>
          <div className="flex items-center gap-2">
            <Thermometer size={15} className="text-cyan-500" />
            <span className="font-mono text-slate-400 font-bold uppercase text-[10px]">TEMP</span>
            <span className="font-mono font-bold text-slate-800">{telemetry.temperature}°C</span>
          </div>
          <div className="flex items-center gap-2">
            <Waves size={15} className="text-sky-500" />
            <span className="font-mono text-slate-400 font-bold uppercase text-[10px]">SEA STATE</span>
            <span className="font-semibold text-slate-800">{telemetry.seaState}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Info size={13} />
          <span>All times and estimates are based on current polar weather conditions.</span>
        </div>
      </div>

      {/* -------------------------------------------------------------------------
       * Vessel Telemetry & Manifest Inspection Modal
       * ------------------------------------------------------------------------- */}
      <AnimatePresence>
        {isVesselModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-800"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50/70 p-1 shadow-xs overflow-hidden">
                    <img src={polarVesselImg} alt="R/V Bharati" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-blue-600">
                        POLAR EXPEDITION VESSEL TELEMETRY
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700 border border-emerald-200">
                        NOMINAL PROPULSION
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900">{vesselName}</h3>
                    <p className="font-mono text-xs text-slate-400">
                      IMO: 9654123 · MMSI: 419001284 · Call Sign: VTBH · Polar Class PC-5
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsVesselModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Navigation Specs */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    <Compass size={14} className="text-blue-600" />
                    Navigation Fix & Propulsion
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                      <span className="text-slate-500">Current Position:</span>
                      <span className="font-mono font-bold text-slate-800">48°12'S, 52.4°E</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                      <span className="text-slate-500">True Heading:</span>
                      <span className="font-mono font-bold text-slate-800">194° SSW</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                      <span className="text-slate-500">Speed Over Ground (SOG):</span>
                      <span className="font-mono font-bold text-blue-600">{telemetry.speed} knots</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                      <span className="text-slate-500">Vessel Draft:</span>
                      <span className="font-mono font-bold text-slate-800">8.2 meters (Ice Load)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bunker Fuel (Arctic MGO):</span>
                      <span className="font-mono font-bold text-emerald-700">420 MT (38d runway)</span>
                    </div>
                  </div>
                </div>

                {/* Cargo Consignments */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    <Package size={14} className="text-purple-600" />
                    Station Consignment Manifest
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center border-b border-slate-200/50 pb-1.5">
                      <span className="font-medium text-slate-700">Arctic Low-Pour Diesel</span>
                      <span className="font-mono font-bold text-amber-600">15,000 L</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/50 pb-1.5">
                      <span className="font-medium text-slate-700">Freeze-Dried Polar Meals</span>
                      <span className="font-mono font-bold text-emerald-700">3,200 Meals</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/50 pb-1.5">
                      <span className="font-medium text-slate-700">Cryo Physics Science Kits</span>
                      <span className="font-mono font-bold text-purple-700">85 Vials</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700">Critical Mechanical Spares</span>
                      <span className="font-mono font-bold text-blue-700">120 Units</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comms & Satellite Link Footer */}
              <div className="mt-5 flex flex-wrap items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <Radio size={16} className="text-blue-600 animate-pulse" />
                  <div>
                    <span className="font-bold text-slate-800">Satellite Comms Uplink: Inmarsat-C Fleet</span>
                    <p className="text-[10px] text-slate-500 font-mono">NCPOR Goa Remote Ground Station · Latency 640ms</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsVesselModalOpen(false)}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  Close Telemetry
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------------------
       * Waypoint Details Modal
       * ------------------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedWaypoint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-800"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-blue-600">
                      VOYAGE WAYPOINT TELEMETRY
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">{selectedWaypoint.name}</h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedWaypoint(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Ocean Sector:</span>
                  <span className="font-semibold text-slate-800">{selectedWaypoint.sector}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Coordinates:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedWaypoint.coordinates}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Ice Conditions:</span>
                  <span className="font-medium text-slate-700">{selectedWaypoint.iceConditions}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Bathymetry:</span>
                  <span className="font-mono text-slate-700">{selectedWaypoint.bathymetry}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Waypoint Status:</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-md text-[10px] ${
                      selectedWaypoint.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedWaypoint.status === 'IN_PROGRESS'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {selectedWaypoint.status}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setSelectedWaypoint(null)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

