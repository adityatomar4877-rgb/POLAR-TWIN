import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Thermometer,
  Wind,
  Satellite,
  Globe2,
  Database,
  Activity,
  Zap,
  Fuel,
  ArrowRight,
  Layers,
  TrendingUp,
  Users,
  Droplets,
  Wifi,
} from 'lucide-react';
import { useStation } from '../../context/StationContext';
import PolarTwinTypographicHero from './PolarTwinTypographicHero';
import SolidWhite3DClusterCanvas from './SolidWhite3DClusterCanvas';
import { JerryRunner } from './JerryRunner';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════════════════════
   IMAGE & ASSET CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */
const IMAGES = {
  landscape: '/assets/antarctica/antarctica-landscape.jpg',
  ice: '/assets/antarctica/antarctica-ice.jpg',
  bharati: '/bharati_station_real.png',
  maitri: '/maitri_station_real.png',
};

/* Research domains matching the clean light dashboard graph card aesthetic */
const RESEARCH_DOMAINS = [
  {
    id: 'temperature',
    icon: Thermometer,
    label: 'TEMPERATURE',
    val: '-16.3',
    unit: '°C',
    sub: 'Feels like · -27.3°C',
    title: 'Climate & Paleoclimate',
    desc: 'Deep ice cores preserving 800k years of Earth’s atmospheric record and CO₂ fluctuations.',
    iconBg: 'bg-sky-50 text-sky-500 border border-sky-100',
    sparklineColor: '#0284C7',
    sparkline: 'M0,18 Q15,6 30,14 T60,8 T85,16 T100,5',
    sparklineFill: 'M0,18 Q15,6 30,14 T60,8 T85,16 T100,5 L100,24 L0,24 Z',
  },
  {
    id: 'wind',
    icon: Wind,
    label: 'WIND SPEED',
    val: '73.0',
    unit: 'km/h',
    sub: 'SSW 209° · 300+ km/h Gusts',
    title: 'Katabatic Meteorology',
    desc: 'Monitoring extreme katabatic wind flows, storm genesis, and polar vortex dynamics.',
    iconBg: 'bg-indigo-50 text-indigo-500 border border-indigo-100',
    sparklineColor: '#6366F1',
    sparkline: 'M0,14 Q20,20 40,7 T70,15 T100,8',
    sparklineFill: 'M0,14 Q20,20 40,7 T70,15 T100,8 L100,24 L0,24 Z',
  },
  {
    id: 'humidity',
    icon: Globe2,
    label: 'HUMIDITY',
    val: '45',
    unit: '%',
    sub: 'Normal · Ice Drift 1.4 mm/d',
    title: 'Glaciology & Ice Shelves',
    desc: 'Radar soundings tracking ice shelf velocity, crevassing dynamics, and shelf stability.',
    iconBg: 'bg-teal-50 text-teal-500 border border-teal-100',
    sparklineColor: '#06B6D4',
    sparkline: 'M0,8 Q20,18 45,10 T75,5 T100,12',
    sparklineFill: 'M0,8 Q20,18 45,10 T75,5 T100,12 L100,24 L0,24 Z',
  },
  {
    id: 'pressure',
    icon: Database,
    label: 'PRESSURE',
    val: '966',
    unit: 'hPa',
    sub: 'Stable · Barometric Base',
    title: 'Seismology & Tectonics',
    desc: 'GPS geodetic stations tracking Gondwana continental drift and Antarctic plate motion.',
    iconBg: 'bg-purple-50 text-purple-500 border border-purple-100',
    sparklineColor: '#A855F7',
    sparkline: 'M0,10 Q25,4 50,16 T80,8 T100,16',
    sparklineFill: 'M0,10 Q25,4 50,16 T80,8 T100,16 L100,24 L0,24 Z',
  },
  {
    id: 'biology',
    icon: Activity,
    label: 'CRYOBIOLOGY',
    val: '6.8',
    unit: 'pH',
    sub: 'Active · Sub-Zero Soil Lab',
    title: 'Extreme Polar Biology',
    desc: 'Cryptoendolithic organisms and cold-adapted microbial strains in sub-zero oasis soils.',
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    sparklineColor: '#10B981',
    sparkline: 'M0,16 Q20,8 45,18 T75,8 T100,12',
    sparklineFill: 'M0,16 Q20,8 45,18 T75,8 T100,12 L100,24 L0,24 Z',
  },
  {
    id: 'ionosphere',
    icon: Satellite,
    label: 'GEOMAGNETISM',
    val: '48.2',
    unit: 'k-nT',
    sub: 'Nominal · Solar Flux 120 sfu',
    title: 'Space & Ionosphere',
    desc: 'Continuous magnetometer arrays observing solar wind coupling and magnetosphere storms.',
    iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
    sparklineColor: '#F59E0B',
    sparkline: 'M0,12 Q18,4 38,20 T70,6 T100,14',
    sparklineFill: 'M0,12 Q18,4 38,20 T70,6 T100,14 L100,24 L0,24 Z',
  },
];

/* Subsystem HUD data with per-station telemetry metrics */
const STATION_SUBSYSTEM_METRICS: Record<
  number,
  Array<{
    id: string;
    label: string;
    icon: typeof Zap;
    status: string;
    statusColor: string;
    val: string;
    unit?: string;
    sub: string;
    iconBg: string;
    sparklineColor: string;
    sparkline: string;
    sparklineFill: string;
  }>
> = {
  // Station 2: Bharati Station (69°S)
  2: [
    {
      id: 'power',
      label: 'POWER MICROGRID',
      icon: Zap,
      status: 'OPTIMAL',
      statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      val: '184.2',
      unit: 'kW',
      sub: '3x Cogeneration Gensets (CHP)',
      iconBg: 'bg-sky-50 text-sky-500 border border-sky-100',
      sparklineColor: '#0284C7',
      sparkline: 'M0,16 Q18,6 36,12 T70,8 T100,5',
      sparklineFill: 'M0,16 Q18,6 36,12 T70,8 T100,5 L100,24 L0,24 Z',
    },
    {
      id: 'thermal',
      label: 'THERMAL ENVELOPE',
      icon: Thermometer,
      status: 'NOMINAL',
      statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      val: '+21.4',
      unit: '°C',
      sub: 'Ext: −24.8°C (Δ 46.2°C Differential)',
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      sparklineColor: '#10B981',
      sparkline: 'M0,12 Q20,16 45,8 T80,10 T100,6',
      sparklineFill: 'M0,12 Q20,16 45,8 T80,10 T100,6 L100,24 L0,24 Z',
    },
    {
      id: 'fuel',
      label: 'FUEL RESERVES',
      icon: Fuel,
      status: 'SECURE',
      statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      val: '88,400',
      unit: 'L',
      sub: '142 Days Winter Operation Buffer',
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      sparklineColor: '#F59E0B',
      sparkline: 'M0,8 Q25,12 50,14 T80,18 T100,19',
      sparklineFill: 'M0,8 Q25,12 50,14 T80,18 T100,19 L100,24 L0,24 Z',
    },
    {
      id: 'comms',
      label: 'SATCOM UPLINK',
      icon: Satellite,
      status: 'LOCKED',
      statusColor: 'text-sky-700 bg-sky-50 border-sky-200',
      val: '45.0',
      unit: 'Mbps',
      sub: 'Direct ISRO Ground Tracking Station',
      iconBg: 'bg-indigo-50 text-indigo-500 border border-indigo-100',
      sparklineColor: '#6366F1',
      sparkline: 'M0,14 Q20,6 45,16 T75,8 T100,6',
      sparklineFill: 'M0,14 Q20,6 45,16 T75,8 T100,6 L100,24 L0,24 Z',
    },
  ],
  // Station 1: Maitri Station (70°S)
  1: [
    {
      id: 'power',
      label: 'POWER MICROGRID',
      icon: Zap,
      status: 'ACTIVE',
      statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      val: '142.6',
      unit: 'kW',
      sub: 'Genset Grid Gen-2 Primary Load',
      iconBg: 'bg-sky-50 text-sky-500 border border-sky-100',
      sparklineColor: '#0284C7',
      sparkline: 'M0,14 Q20,18 40,10 T75,12 T100,7',
      sparklineFill: 'M0,14 Q20,18 40,10 T75,12 T100,7 L100,24 L0,24 Z',
    },
    {
      id: 'thermal',
      label: 'THERMAL ENVELOPE',
      icon: Thermometer,
      status: 'NOMINAL',
      statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      val: '+19.8',
      unit: '°C',
      sub: 'Ext: −28.4°C (Lake Oasis Bedrock)',
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      sparklineColor: '#10B981',
      sparkline: 'M0,14 Q20,10 50,14 T80,8 T100,10',
      sparklineFill: 'M0,14 Q20,10 50,14 T80,8 T100,10 L100,24 L0,24 Z',
    },
    {
      id: 'fuel',
      label: 'FUEL RESERVES',
      icon: Fuel,
      status: 'OPTIMAL',
      statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      val: '64,200',
      unit: 'L',
      sub: '118 Days Heavy Fuel Buffer',
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      sparklineColor: '#F59E0B',
      sparkline: 'M0,10 Q25,12 55,16 T85,19 T100,20',
      sparklineFill: 'M0,10 Q25,12 55,16 T85,19 T100,20 L100,24 L0,24 Z',
    },
    {
      id: 'comms',
      label: 'SATCOM UPLINK',
      icon: Satellite,
      status: 'SYNCING',
      statusColor: 'text-sky-700 bg-sky-50 border-sky-200',
      val: '28.0',
      unit: 'Mbps',
      sub: 'ISRO Polar Relay · Low Bitrate L-Band',
      iconBg: 'bg-indigo-50 text-indigo-500 border border-indigo-100',
      sparklineColor: '#6366F1',
      sparkline: 'M0,18 Q25,12 50,16 T80,10 T100,8',
      sparklineFill: 'M0,18 Q25,12 50,16 T80,10 T100,8 L100,24 L0,24 Z',
    },
  ],
};

const MARQUEE_ITEMS = [
  'BHARATI STATION',
  'MAITRI STATION',
  'REAL-TIME DIGITAL TWIN',
  '3,000 KM POLAR TELEMETRY',
  'NCPOR · MOES',
  '43 YEARS OF POLAR SCIENCE',
  '1Hz SATELLITE RELAY',
  'INDIAN ANTARCTIC PROGRAM',
];

const BHARATI_SPEC_CARDS = [
  {
    title: 'STILT ELEVATION',
    sub: 'Wind & drift clearance',
    icon: Layers,
    iconBg: 'bg-sky-50 text-sky-500 border border-sky-100',
  },
  {
    title: 'CHP COGENERATION',
    sub: '3x 100 kW Genset heating',
    icon: Zap,
    iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
  },
  {
    title: 'ISRO DOWNLINK',
    sub: 'Direct polar satellite feed',
    icon: Satellite,
    iconBg: 'bg-indigo-50 text-indigo-500 border border-indigo-100',
  },
  {
    title: 'DESALINATION',
    sub: 'Sea-water reverse osmosis',
    icon: Droplets,
    iconBg: 'bg-teal-50 text-teal-500 border border-teal-100',
  },
];

const MAITRI_SPEC_CARDS = [
  {
    title: 'SCHIRMACHER OASIS',
    sub: 'Solid bedrock valley anchor',
    icon: Globe2,
    iconBg: 'bg-rose-50 text-rose-500 border border-rose-100',
  },
  {
    title: 'LAKE PRIYADARSHINI',
    sub: 'Piped fresh water line',
    icon: Droplets,
    iconBg: 'bg-cyan-50 text-cyan-500 border border-cyan-100',
  },
  {
    title: 'GEOMAGNETISM',
    sub: 'Fluxgate magnetometer lab',
    icon: Activity,
    iconBg: 'bg-purple-50 text-purple-500 border border-purple-100',
  },
  {
    title: 'OVERWINTER CREW',
    sub: '25-person survival habitat',
    icon: Users,
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  },
];

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStarted(true);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;

    let idx = 0;
    const interval = setInterval(() => {
      idx += 2;
      if (idx <= text.length) {
        setDisplayed(text.slice(0, idx));
      } else {
        setDisplayed(text);
        clearInterval(interval);
      }
    }, 18);

    return () => clearInterval(interval);
  }, [started, text]);

  return (
    <p ref={textRef} className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium min-h-[4rem]">
      {displayed || text.slice(0, 4)}
      {started && displayed.length < text.length && (
        <span className="inline-block w-1.5 h-4 ml-1 bg-[#38BDF8] animate-pulse align-middle" />
      )}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PIXEL POP-OUT IMAGE MATRIX LOADER (LEFT TO RIGHT CASCADE)
   ═══════════════════════════════════════════════════════════════════════════ */
interface PixelPopPhotoProps {
  src: string;
  alt: string;
  className?: string;
  cols?: number;
  rows?: number;
  onComplete?: () => void;
}

function PixelPopPhoto({
  src,
  alt,
  className = '',
  cols = 18,
  rows = 11,
  onComplete,
}: PixelPopPhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let started = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          started = true;
          setIsPlaying(true);

          const totalDuration = cols * 95 + 800;
          setTimeout(() => {
            setIsFinished(true);
            onComplete?.();
          }, totalDuration);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [cols, onComplete]);

  // Generate grid tiles with left-to-right staggered wave delays (+1s extended cascade)
  const tiles = useMemo(() => {
    const arr = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Left to right wave delay extended for a dramatic 1-second longer reveal
        const colDelay = c * 95;
        const rowOffset = Math.sin((r / rows) * Math.PI) * 55 + ((r * 11) % 35);
        const delay = Math.max(0, colDelay + rowOffset);

        const leftPct = cols > 1 ? (c / (cols - 1)) * 100 : 0;
        const topPct = rows > 1 ? (r / (rows - 1)) * 100 : 0;

        arr.push({
          id: `${r}-${c}`,
          col: c,
          row: r,
          delay,
          leftPct,
          topPct,
        });
      }
    }
    return arr;
  }, [cols, rows]);

  return (
    <div
      ref={containerRef}
      className={`relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-black/60 shadow-lg ${className}`}
    >
      {/* Contiguous sharp image when finished */}
      {isFinished ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-102"
        />
      ) : (
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {tiles.map(({ id, delay, leftPct, topPct }) => (
            <div
              key={id}
              style={{
                backgroundImage: `url(${src})`,
                backgroundPosition: `${leftPct}% ${topPct}%`,
                backgroundSize: `${cols * 100}% ${rows * 100}%`,
                animation: isPlaying
                  ? `pixelPopIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms forwards`
                  : 'none',
                opacity: isPlaying ? 0 : 0,
                transform: 'scale(0)',
              }}
              className="h-full w-full bg-no-repeat will-change-transform border-[0.5px] border-black/10"
            />
          ))}
        </div>
      )}

      {/* Fallback accessibility image */}
      <img src={src} alt={alt} className="sr-only" />
    </div>
  );
}

interface Props {
  onEnterCommandCenter?: () => void;
}

export default function AntarcticStoryScroller({ onEnterCommandCenter }: Props) {
  const navigate = useNavigate();
  const { selectedStationId, setSelectedStationId } = useStation();

  const containerRef = useRef<HTMLDivElement>(null);
  const horizontalSectionRef = useRef<HTMLDivElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [cursorHovered, setCursorHovered] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [isInsideHorizontal, setIsInsideHorizontal] = useState(false);

  // Custom lagging cursor interpolation
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef({ x: -100, y: -100 });
  const currentPosRef = useRef({ x: -100, y: -100 });

  const handleSelectStation = useCallback(
    (id: number) => {
      setSelectedStationId(id);
    },
    [setSelectedStationId]
  );

  const handleNavigateCommand = useCallback(() => {
    if (onEnterCommandCenter) {
      onEnterCommandCenter();
    } else {
      navigate('/command');
    }
  }, [navigate, onEnterCommandCenter]);

  // Trigger Slide 03 spec cards after Bharati photo completes loading
  const handleBharatiPhotoComplete = useCallback(() => {
    gsap.fromTo(
      '.slide-03-card',
      { scale: 0.55, opacity: 0, y: 40, rotateX: 10 },
      {
        scale: 1,
        opacity: 1,
        y: 0,
        rotateX: 0,
        duration: 0.65,
        stagger: 0.12,
        ease: 'back.out(2.2)',
      }
    );
  }, []);

  // Trigger Slide 04 spec cards after Maitri photo completes loading
  const handleMaitriPhotoComplete = useCallback(() => {
    gsap.fromTo(
      '.slide-04-card',
      { scale: 0.55, opacity: 0, y: 40, rotateX: 10 },
      {
        scale: 1,
        opacity: 1,
        y: 0,
        rotateX: 0,
        duration: 0.65,
        stagger: 0.12,
        ease: 'back.out(2.2)',
      }
    );
  }, []);

  // Track mouse coordinates for custom cursor
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      setCursorVisible(true);
    };

    let animationFrameId: number;
    const updateCursor = () => {
      // Smooth lerp easing
      currentPosRef.current.x += (mousePosRef.current.x - currentPosRef.current.x) * 0.18;
      currentPosRef.current.y += (mousePosRef.current.y - currentPosRef.current.y) * 0.18;

      setCursorPos({
        x: currentPosRef.current.x,
        y: currentPosRef.current.y,
      });

      animationFrameId = requestAnimationFrame(updateCursor);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationFrameId = requestAnimationFrame(updateCursor);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // ═════════════════════════════════════════════════════════════════════════
  // GSAP HORIZONTAL SCROLL-JACKING & 3D BACKGROUND SHAPES CHOREOGRAPHY
  // ═════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!horizontalSectionRef.current || !horizontalTrackRef.current) return;

    const ctx = gsap.context(() => {
      const track = horizontalTrackRef.current;
      const container = horizontalSectionRef.current;
      if (!track || !container) return;

      // Horizontal ScrollTrigger with Pinning and Damped Inertia Scrub
      const getScrollAmount = () => track.scrollWidth - window.innerWidth;

      const horizontalTween = gsap.to(track, {
        x: () => -getScrollAmount(),
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          pin: true,
          scrub: 1.2, // Smooth inertia easing
          start: 'top top',
          end: () => `+=${getScrollAmount()}`,
          invalidateOnRefresh: true,
          onEnter: () => {
            setIsInsideHorizontal(true);
          },
          onLeave: () => {
            setIsInsideHorizontal(false);
          },
          onEnterBack: () => {
            setIsInsideHorizontal(true);
          },
          onLeaveBack: () => {
            setIsInsideHorizontal(false);
          },
          onUpdate: (self) => {
            setScrollProgress(self.progress);
          },
        },
      });

      // Pop-out staggered animation for Slide 02 Scientific Domain Cards
      gsap.fromTo(
        '.slide-02-domain-card',
        {
          scale: 0.55,
          opacity: 0,
          y: 60,
          rotateX: 12,
        },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.75,
          stagger: 0.12,
          ease: 'back.out(2.2)',
          scrollTrigger: {
            trigger: '#panel-02-domains',
            containerAnimation: horizontalTween,
            start: 'left 85%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      // Set initial hidden state for station spec cards so they wait for photo completion
      gsap.set('.slide-03-card, .slide-04-card', {
        scale: 0.55,
        opacity: 0,
        y: 40,
        rotateX: 10,
      });

      // ─── SEQUENTIAL 3-PART ANIMATION FOR SLIDE 05 (REMOTE NETWORK) ───
      const slide05Tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#panel-05-telemetry',
          containerAnimation: horizontalTween,
          start: 'left 80%',
          toggleActions: 'play none none reverse',
        },
      });

      slide05Tl
        // 1. Part 1: NCPOR Goa Card
        .fromTo(
          '.slide-05-part-1',
          { scale: 0.6, opacity: 0, y: 40, rotateY: 6 },
          { scale: 1, opacity: 1, y: 0, rotateY: 0, duration: 0.65, ease: 'back.out(2.0)' }
        )
        // 2. Telemetry Connector 1
        .fromTo(
          '.slide-05-conn-1',
          { scaleX: 0, opacity: 0, transformOrigin: 'left center' },
          { scaleX: 1, opacity: 1, duration: 0.35, ease: 'power2.out' },
          '-=0.15'
        )
        // 3. Part 2: SATCOM GEO-RELAY Card
        .fromTo(
          '.slide-05-part-2',
          { scale: 0.6, opacity: 0, y: 40, rotateY: 6 },
          { scale: 1, opacity: 1, y: 0, rotateY: 0, duration: 0.65, ease: 'back.out(2.0)' },
          '-=0.1'
        )
        // 4. Telemetry Connector 2 (Fork)
        .fromTo(
          '.slide-05-conn-2',
          { scaleX: 0, opacity: 0, transformOrigin: 'left center' },
          { scaleX: 1, opacity: 1, duration: 0.35, ease: 'power2.out' },
          '-=0.15'
        )
        // 5. Part 3: Bharati & Maitri Station Cards
        .fromTo(
          '.slide-05-station-card',
          { scale: 0.6, opacity: 0, y: 40, rotateY: 6 },
          { scale: 1, opacity: 1, y: 0, rotateY: 0, duration: 0.65, stagger: 0.18, ease: 'back.out(2.0)' },
          '-=0.1'
        );

      // Background color shift trigger as user leaves horizontal track into footer
      ScrollTrigger.create({
        trigger: '.finale-section',
        start: 'top 80%',
        onEnter: () => {
          gsap.to(containerRef.current, { backgroundColor: '#070D1C', duration: 0.8 });
        },
        onLeaveBack: () => {
          gsap.to(containerRef.current, { backgroundColor: '#0A0A0A', duration: 0.8 });
        },
      });

      return () => {
        horizontalTween.kill();
      };
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full select-none bg-[#0A0A0A] text-[#FFFFFF] font-sans transition-colors duration-700 overflow-x-hidden"
    >
      {/* ═══════════════════════════════════════════════════════════════════
         1. REFRACTIVE LIQUID WATER DROPLET MAGNIFIER CURSOR (~2X SIZE)
         ═══════════════════════════════════════════════════════════════════ */}
      {/* SVG Optical Water Droplet Displacement Filter */}
      <svg className="pointer-events-none fixed -top-[9999px] -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true">
        <defs>
          <filter id="water-droplet-magnifier" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feColorMatrix
              type="matrix"
              values="
                1.08 0    0    0 0
                0    1.04 0    0 0
                0    0    1.12 0 0
                0    0    0    1 0"
              in="displaced"
            />
          </filter>
        </defs>
      </svg>

      {cursorVisible && (
        <div
          ref={cursorRef}
          className="pointer-events-none fixed z-50 hidden md:block rounded-full will-change-transform"
          style={{
            transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0) translate(-50%, -50%)`,
          }}
        >
          {/* Organic Liquid Water Droplet Body */}
          <div
            className={`relative h-12 w-12 rounded-[50%_50%_48%_52%/52%_48%_50%_50%] transition-all duration-200 ease-out flex items-center justify-center ${
              cursorHovered ? 'scale-125' : 'scale-100'
            }`}
            style={{
              background:
                'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 45%, rgba(192,132,252,0.22) 75%, rgba(56,189,248,0.28) 100%)',
              backdropFilter: 'url(#water-droplet-magnifier) blur(0.4px) brightness(1.24) contrast(1.22) saturate(1.3)',
              WebkitBackdropFilter: 'url(#water-droplet-magnifier) blur(0.4px) brightness(1.24) contrast(1.22) saturate(1.3)',
              boxShadow:
                'inset 0 2.5px 5px rgba(255,255,255,0.85), inset 0 -3.5px 6px rgba(0,0,0,0.45), inset 3.5px 0 6px rgba(236,72,153,0.4), inset -3.5px 0 6px rgba(56,189,248,0.45), 0 8px 24px rgba(0,0,0,0.35)',
              border: '1.2px solid rgba(255,255,255,0.5)',
            }}
          >
            {/* Primary Specular Glare Arc */}
            <div className="absolute top-1 left-2 h-3 w-4.5 -rotate-40 rounded-full bg-gradient-to-b from-white/95 to-transparent blur-[0.3px]" />

            {/* Secondary Bottom Caustic Glow */}
            <div className="absolute bottom-1 right-2 h-1.5 w-3 rotate-30 rounded-full bg-gradient-to-t from-sky-300/70 to-transparent blur-[0.4px]" />

            {/* Subtle Surface Tension Fluid Ring */}
            <div className="absolute inset-0 rounded-[50%_50%_48%_52%/52%_48%_50%_50%] border border-white/30 ring-1 ring-purple-400/30" />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         2. SINGLE CONTINUOUS JERRY MOUSE PHYSICS CARD RUNNER & LEAPER
         ═══════════════════════════════════════════════════════════════════ */}
      <JerryRunner
        progress={scrollProgress}
        isInsideHorizontal={isInsideHorizontal}
      />

      {/* ═══════════════════════════════════════════════════════════════════
         3. PINNED BOTTOM HORIZONTAL SCROLL PROGRESS BAR
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 h-[3px] bg-white/10 z-50">
        <div
          className="h-full bg-gradient-to-r from-[#38BDF8] via-[#818CF8] to-[#FB7185] transition-all duration-75 ease-out shadow-[0_0_10px_rgba(56,189,248,0.8)]"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
         4. HERO SECTION: POLAR TWIN MOTION TYPOGRAPHY
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 w-full min-h-screen">
        <PolarTwinTypographicHero
          onEnterCommandCenter={handleNavigateCommand}
          onScrollDown={() => {
            if (horizontalSectionRef.current) {
              horizontalSectionRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         5. PINNED HORIZONTAL SCROLL-JACKING CONTAINER
         ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={horizontalSectionRef}
        className="relative h-screen w-full overflow-hidden bg-[#0A0A0A]"
      >
        {/* ─────────────────────────────────────────────────────────────
           DECORATIVE FIXED SOLID 3D WEBGL BACKGROUND LAYER (PERSISTS ACROSS PANELS)
           Real 3D solid white meshes revolving altogether in opposite direction of horizontal scroll
           ───────────────────────────────────────────────────────────── */}
        <SolidWhite3DClusterCanvas scrollProgress={scrollProgress} />

        {/* ─────────────────────────────────────────────────────────────
           HORIZONTAL SLIDING ROW (7 STRUCTURED PANELS)
           ───────────────────────────────────────────────────────────── */}
        <div
          ref={horizontalTrackRef}
          className="relative z-10 flex h-full w-[700vw] flex-row will-change-transform"
        >
          {/* ═══════════════════════════════════════════════════════════
             PANEL 01: THE MISSION STATEMENT & POLAR STATS
             ═══════════════════════════════════════════════════════════ */}
          <div className="relative flex h-screen w-screen shrink-0 items-center justify-center p-6 sm:p-12 md:p-20">
            <div className="slide-story-card w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0E121E]/80 backdrop-blur-2xl p-8 sm:p-14 shadow-2xl">
              {/* Kicker Row */}
              <div className="flex items-center gap-3 text-xs font-mono font-bold tracking-widest text-slate-400">
                <span className="text-rose-400">01</span>
                <span className="h-[2px] w-8 bg-rose-500/60" />
                <span>THE MISSION</span>
              </div>

              {/* Huge Headline */}
              <h2 className="mt-6 font-sans text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
                INDIA AT THE BOTTOM<br />OF THE WORLD.
              </h2>
              <div className="mt-4 h-[2px] w-24 bg-[#38BDF8]" />

              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Supporting Body & Struck-through Checklist */}
                <div>
                  <p className="text-sm sm:text-base leading-relaxed text-slate-300 font-medium">
                    Four decades of Indian scientific expeditions have crossed the Southern Ocean to build permanent research habitats on Antarctica — decoding climate, glaciology, and polar biology through winters no human was meant to endure.
                  </p>
                  <div className="mt-6 space-y-2 font-mono text-xs">
                    <div className="flex items-center gap-2 text-slate-500 line-through">
                      <span>✕</span> NOT A TEMPORARY FIELD CAMP
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 line-through">
                      <span>✕</span> NOT ISOLATED FROM MAINLAND
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <span>✓</span> 365-DAY AUTONOMOUS DIGITAL TWIN OPERATIONS
                    </div>
                  </div>
                </div>

                {/* 4 Core Polar Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { val: '−89.2°C', label: 'RECORD MIN TEMP' },
                    { val: '~90%', label: 'GLOBAL GLACIAL ICE' },
                    { val: '300+ KM/H', label: 'KATABATIC WINDS' },
                    { val: '43 YEARS', label: 'CONTINUOUS SCIENCE' },
                  ].map(({ val, label }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center transition-colors hover:border-[#38BDF8]/40"
                    >
                      <p className="font-mono text-2xl sm:text-3xl font-black text-[#38BDF8]">{val}</p>
                      <p className="mt-1 font-mono text-[9px] font-bold tracking-wider text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
             PANEL 02: SCIENTIFIC RESEARCH DOMAINS (LIGHT DASHBOARD GRAPH CARDS)
             ═══════════════════════════════════════════════════════════ */}
          <div
            id="panel-02-domains"
            className="relative flex h-screen w-screen shrink-0 items-center justify-center p-6 sm:p-12 md:p-20"
          >
            <div className="slide-story-card w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0E121E]/85 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl">
              {/* Kicker Row */}
              <div className="flex items-center gap-3 text-xs font-mono font-bold tracking-widest text-slate-400">
                <span className="text-rose-400">02</span>
                <span className="h-[2px] w-8 bg-rose-500/60" />
                <span>SCIENTIFIC DOMAINS</span>
              </div>

              {/* Huge Headline */}
              <h2 className="mt-4 font-sans text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
                WHY ANTARCTICA MATTERS.
              </h2>
              <div className="mt-3 h-[2px] w-24 bg-[#38BDF8]" />

              {/* Research Grid - Matching Website Dashboard Graph Cards with Staggered Pop-Out Animation */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [perspective:1000px]">
                {RESEARCH_DOMAINS.map(
                  ({
                    id,
                    icon: Icon,
                    label,
                    val,
                    unit,
                    sub,
                    desc,
                    iconBg,
                    sparklineColor,
                    sparkline,
                    sparklineFill,
                  }, index) => (
                    <div
                      key={id}
                      onMouseEnter={() => setCursorHovered(true)}
                      onMouseLeave={() => setCursorHovered(false)}
                      style={{ animationDelay: `${index * 100}ms` }}
                      className="slide-02-domain-card group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] text-slate-900 transition-all duration-300 hover:-translate-y-2.5 hover:scale-104 hover:shadow-[0_25px_55px_rgba(0,0,0,0.28)] active:scale-96 cursor-pointer will-change-transform"
                    >
                      {/* Top Header Row */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10.5px] font-black uppercase tracking-widest text-slate-400">
                            {label}
                          </span>
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg} shadow-xs transition-transform duration-300 group-hover:scale-115 group-hover:rotate-6`}>
                            <Icon size={17} />
                          </div>
                        </div>

                        {/* Metric Value Display */}
                        <div className="mt-2.5 flex items-baseline">
                          <span className="font-sans text-3xl font-black text-slate-900 tracking-tight leading-none group-hover:text-black">
                            {val}
                          </span>
                          <span className="ml-1 text-sm font-bold text-slate-500">
                            {unit}
                          </span>
                        </div>

                        {/* Subtext & Scientific Description */}
                        <p className="mt-1 font-sans text-xs font-semibold text-slate-500">
                          {sub}
                        </p>
                        <p className="mt-2 font-sans text-[11px] text-slate-600 leading-relaxed font-normal">
                          {desc}
                        </p>
                      </div>

                      {/* Bottom Full-Width Organic Sparkline */}
                      <div className="mt-4 -mx-5 -mb-5 relative h-9 overflow-hidden transition-transform duration-300 group-hover:scale-105">
                        <svg
                          className="w-full h-full overflow-visible"
                          viewBox="0 0 100 24"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={sparklineColor} stopOpacity="0.38" />
                              <stop offset="100%" stopColor={sparklineColor} stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d={sparklineFill} fill={`url(#grad-${id})`} />
                          <path
                            d={sparkline}
                            fill="none"
                            stroke={sparklineColor}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
             PANEL 03: BHARATI STATION SHOWCASE
             ═══════════════════════════════════════════════════════════ */}
          <div
            id="panel-03-bharati"
            className="relative flex h-screen w-screen shrink-0 items-center justify-center p-6 sm:p-12 md:p-20"
          >
            <div className="slide-story-card w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0E121E]/80 backdrop-blur-2xl p-8 sm:p-14 shadow-2xl">
              {/* Kicker Row */}
              <div className="flex items-center gap-3 text-xs font-mono font-bold tracking-widest text-slate-400">
                <span className="text-rose-400">03</span>
                <span className="h-[2px] w-8 bg-rose-500/60" />
                <span>MODERN NODE (EST. 2012)</span>
              </div>

              {/* Huge Headline */}
              <h2 className="mt-6 font-sans text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
                BHARATI STATION.
              </h2>
              <div className="mt-4 h-[2px] w-24 bg-[#38BDF8]" />

              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Station Photo Card with Pixel Pop-Out Matrix Loader */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-lg group hover:border-[#38BDF8]/40 transition-colors">
                  <PixelPopPhoto
                    src={IMAGES.bharati}
                    alt="Bharati Station"
                    onComplete={handleBharatiPhotoComplete}
                  />
                </div>

                {/* Subsystem Specifications with Typewriter Text */}
                <div className="space-y-4">
                  <TypewriterText text="India’s 3rd generation polar station at Larsemann Hills, engineered on aerodynamic structural steel stilts to prevent snowdrift burial and survive 300+ km/h katabatic blizzards." />

                  {/* 4 Light-Themed Pop-Out Spec Cards (Sequenced after photo load) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 [perspective:1000px]">
                    {BHARATI_SPEC_CARDS.map(({ title, sub, icon: Icon, iconBg }) => (
                      <div
                        key={title}
                        className="slide-03-card opacity-0 scale-55 group flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_8px_25px_rgba(0,0,0,0.12)] text-slate-900 transition-all duration-300 hover:-translate-y-1.5 hover:scale-104 hover:shadow-[0_20px_45px_rgba(0,0,0,0.25)] active:scale-96 cursor-pointer will-change-transform"
                      >
                        <div>
                          <p className="font-sans text-xs font-black uppercase tracking-wide text-slate-900 group-hover:text-black">
                            {title}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] font-medium text-slate-500">
                            {sub}
                          </p>
                        </div>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg} shadow-xs ml-2 transition-transform duration-300 group-hover:scale-115 group-hover:rotate-6`}>
                          <Icon size={15} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
             PANEL 04: MAITRI STATION SHOWCASE
             ═══════════════════════════════════════════════════════════ */}
          <div
            id="panel-04-maitri"
            className="relative flex h-screen w-screen shrink-0 items-center justify-center p-6 sm:p-12 md:p-20"
          >
            <div className="slide-story-card w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0E121E]/80 backdrop-blur-2xl p-8 sm:p-14 shadow-2xl">
              {/* Kicker Row */}
              <div className="flex items-center gap-3 text-xs font-mono font-bold tracking-widest text-slate-400">
                <span className="text-rose-400">04</span>
                <span className="h-[2px] w-8 bg-rose-500/60" />
                <span>HISTORIC OUTPOST (EST. 1989)</span>
              </div>

              {/* Huge Headline */}
              <h2 className="mt-6 font-sans text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
                MAITRI STATION.
              </h2>
              <div className="mt-4 h-[2px] w-24 bg-[#FB7185]" />

              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Station Photo Card with Pixel Pop-Out Matrix Loader */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-lg group hover:border-[#FB7185]/40 transition-colors">
                  <PixelPopPhoto
                    src={IMAGES.maitri}
                    alt="Maitri Station"
                    onComplete={handleMaitriPhotoComplete}
                  />
                </div>

                {/* Subsystem Specifications with Typewriter Text */}
                <div className="space-y-4">
                  <TypewriterText text="Anchored on the ice-free bedrock of Schirmacher Oasis. Powering continuous geomagnetism, meteorology, and human physiology research for 35+ years through the 8-month winter polar night." />

                  {/* 4 Light-Themed Pop-Out Spec Cards (Sequenced after photo load) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 [perspective:1000px]">
                    {MAITRI_SPEC_CARDS.map(({ title, sub, icon: Icon, iconBg }) => (
                      <div
                        key={title}
                        className="slide-04-card opacity-0 scale-55 group flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_8px_25px_rgba(0,0,0,0.12)] text-slate-900 transition-all duration-300 hover:-translate-y-1.5 hover:scale-104 hover:shadow-[0_20px_45px_rgba(0,0,0,0.25)] active:scale-96 cursor-pointer will-change-transform"
                      >
                        <div>
                          <p className="font-sans text-xs font-black uppercase tracking-wide text-slate-900 group-hover:text-black">
                            {title}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] font-medium text-slate-500">
                            {sub}
                          </p>
                        </div>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg} shadow-xs ml-2 transition-transform duration-300 group-hover:scale-115 group-hover:rotate-6`}>
                          <Icon size={15} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
             PANEL 05: 3,000 KM SATELLITE TELEMETRY NETWORK (LIVE OPERATIONAL VIEW)
             ═══════════════════════════════════════════════════════════ */}
          <div
            id="panel-05-telemetry"
            className="relative flex h-screen w-screen shrink-0 items-center justify-center p-6 sm:p-12 md:p-20"
          >
            <div className="slide-story-card w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0E121E]/80 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl">
              {/* Kicker Row */}
              <div className="flex items-center gap-3 text-xs font-mono font-bold tracking-widest text-slate-400">
                <span className="text-rose-400">05</span>
                <span className="h-[2px] w-8 bg-rose-500/60" />
                <span>REMOTE NETWORK</span>
              </div>

              {/* Huge Headline */}
              <h2 className="mt-4 font-sans text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
                WHEN DISTANCE BECOMES DATA.
              </h2>
              <div className="mt-3 h-[2px] w-24 bg-[#38BDF8]" />

              <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
                Bridging 3,000 km of polar ice sheet into a unified digital twin via ISRO satellite telemetry.
              </p>

              {/* ─── EMBEDDED OPERATIONAL TELEMETRY NETWORK DIAGRAM CARD ─── */}
              <div className="mt-6 rounded-2xl border border-slate-200/90 bg-[#F8FAFC] p-5 sm:p-7 shadow-xl text-slate-900 overflow-hidden [perspective:1200px]">
                {/* 3 Main Node Columns Flow */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_auto_1.3fr_auto_1.2fr] gap-3.5 items-center">

                  {/* ─── PART 1: NCPOR GOA MISSION CONTROL CARD ─── */}
                  <div className="slide-05-part-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 will-change-transform">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-sans text-base font-black text-slate-900 leading-tight">NCPOR Goa</p>
                        <p className="font-sans text-xs font-medium text-slate-500">Mission Control</p>
                        <span className="inline-block mt-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                          ACTIVE
                        </span>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center relative overflow-hidden shadow-inner">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <circle cx="50" cy="50" r="48" fill="#E2E8F0" />
                          <path d="M 45 30 Q 55 35 60 50 Q 55 65 48 70 Q 42 60 40 45 Z" fill="#94A3B8" />
                          <circle cx="46" cy="52" r="3.5" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1.5" />
                        </svg>
                      </div>
                    </div>

                    {/* Metrics List */}
                    <div className="space-y-1.5 text-[11px] font-sans border-t border-slate-100 pt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <TrendingUp size={12} className="text-slate-400" /> Mainland Data Ingress:
                        </span>
                        <span className="font-bold text-slate-900">1.2 Gbps</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <Satellite size={12} className="text-slate-400" /> Satellite Uplink Status:
                        </span>
                        <span className="font-bold text-slate-900 uppercase">SYNCING</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <Layers size={12} className="text-slate-400" /> Total Systems:
                        </span>
                        <span className="font-bold text-slate-900">114 Active</span>
                      </div>
                    </div>

                    {/* Bottom Globe & Radial Progress Gauge */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="h-14 w-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center relative overflow-hidden shadow-inner">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <circle cx="50" cy="50" r="48" fill="#E2E8F0" />
                          <path d="M 30 20 Q 50 30 50 70 Q 30 65 25 45 Z" fill="#94A3B8" />
                          <circle cx="65" cy="72" r="3.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
                        </svg>
                      </div>

                      {/* Circular Donut Gauge */}
                      <div className="relative flex flex-col items-center justify-center">
                        <svg viewBox="0 0 80 80" className="w-14 h-14 -rotate-90">
                          <circle cx="40" cy="40" r="32" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="6"
                            strokeDasharray="201"
                            strokeDashoffset="6"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[8px] font-sans font-medium text-slate-500 leading-none">Data Sync:</span>
                          <span className="text-xs font-black text-slate-900 leading-tight">97%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ─── CONNECTOR 1: LEFT TO CENTER ─── */}
                  <div className="slide-05-conn-1 hidden lg:flex flex-col items-center justify-center will-change-transform">
                    <div className="flex items-center">
                      <div className="w-5 h-[2px] bg-slate-300" />
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-xs">
                        <Activity size={11} className="text-slate-400" />
                      </div>
                      <div className="w-5 h-[2px] bg-slate-300" />
                    </div>
                  </div>

                  {/* ─── PART 2: SATCOM GEO-RELAY SATELLITE NODE CARD ─── */}
                  <div className="slide-05-part-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 will-change-transform">
                    <div>
                      <p className="font-sans text-base font-black text-slate-900 leading-tight">SATCOM GEO-RELAY</p>
                      <p className="font-sans text-xs font-medium text-slate-500">Satellite Relay Node</p>
                    </div>

                    {/* Satellite Orbit Illustration */}
                    <div className="relative flex flex-col items-center justify-center py-0.5">
                      <svg viewBox="0 0 240 85" className="w-full h-16">
                        <path d="M 10 60 Q 120 15 230 40" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 3" />
                        <circle cx="80" cy="35" r="2.5" fill="#475569" />
                        
                        <g transform="translate(120, 32) rotate(-15)">
                          <rect x="-9" y="-9" width="18" height="18" rx="2.5" fill="#94A3B8" stroke="#475569" strokeWidth="1.5" />
                          <circle cx="0" cy="0" r="3" fill="#0284C7" />
                          <rect x="-34" y="-6" width="23" height="12" rx="1.5" fill="#E2E8F0" stroke="#475569" strokeWidth="1" />
                          <line x1="-22" y1="-6" x2="-22" y2="6" stroke="#94A3B8" />
                          <rect x="11" y="-6" width="23" height="12" rx="1.5" fill="#E2E8F0" stroke="#475569" strokeWidth="1" />
                          <line x1="22" y1="-6" x2="22" y2="6" stroke="#94A3B8" />
                          <path d="M -5 9 Q 0 14 5 9" fill="none" stroke="#475569" strokeWidth="1.5" />
                        </g>

                        <path d="M 105 52 Q 120 62 135 52" fill="none" stroke="#94A3B8" strokeWidth="1.5" />
                        <path d="M 100 58 Q 120 70 140 58" fill="none" stroke="#CBD5E1" strokeWidth="1.2" />
                      </svg>
                    </div>

                    <div className="border-t border-slate-100 pt-2.5">
                      <p className="font-sans text-[11px] font-bold text-slate-900 mb-1.5">Low-Bandwidth Data Optimization</p>
                      
                      <div className="space-y-1 text-[10.5px] font-sans">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">⛶ Telemetry Compaction:</span>
                          <span className="font-bold text-slate-900">85% Efficiency</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <Layers size={11} className="text-slate-400" /> Edge Caching:
                          </span>
                          <span className="font-bold text-slate-900">Enabled</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">⇄ Optimized Data Stream:</span>
                          <span className="font-bold text-slate-900">L-Band (4 MHz)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <Wifi size={11} className="text-slate-400" /> Signal Latency:
                          </span>
                          <span className="font-bold text-slate-900">220 ms</span>
                        </div>
                      </div>

                      <span className="inline-block mt-2 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                        OPTIMIZED
                      </span>
                    </div>
                  </div>

                  {/* ─── CONNECTOR 2: CENTER TO RIGHT FORK ─── */}
                  <div className="slide-05-conn-2 hidden lg:flex flex-col items-center justify-center will-change-transform">
                    <div className="flex flex-col justify-around h-40 py-6">
                      <div className="flex items-center">
                        <div className="w-4 h-[2px] bg-slate-300" />
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-xs">
                          <Activity size={10} className="text-slate-400" />
                        </div>
                        <div className="w-4 h-[2px] bg-slate-300" />
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-[2px] bg-slate-300" />
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-xs">
                          <Activity size={10} className="text-slate-400" />
                        </div>
                        <div className="w-4 h-[2px] bg-slate-300" />
                      </div>
                    </div>
                  </div>

                  {/* ─── PART 3: ANTARCTIC STATIONS (BHARATI & MAITRI) ─── */}
                  <div className="slide-05-part-3 space-y-3">
                    {/* Bharati Station Card */}
                    <div className="slide-05-station-card rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2 will-change-transform">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-sans text-xs font-black text-slate-900 uppercase">BHARATI STATION</p>
                          <span className="inline-block mt-0.5 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700 uppercase">
                            OPERATIONAL
                          </span>
                        </div>
                        <div className="h-8 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center relative overflow-hidden">
                          <svg viewBox="0 0 50 40" className="w-full h-full">
                            <path d="M 12 18 Q 20 8 38 12 Q 45 22 35 32 Q 20 35 12 28 Z" fill="#94A3B8" />
                            <circle cx="36" cy="18" r="2.5" fill="#10B981" />
                          </svg>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-[10.5px] font-sans">
                        <div>
                          <div className="flex justify-between text-slate-700 font-medium">
                            <span className="flex items-center gap-1"><Zap size={11} className="text-slate-400" /> HVAC System Power: 110 kW</span>
                            <span className="font-bold text-slate-900">85%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-0.5 overflow-hidden">
                            <div className="bg-slate-700 h-full rounded-full w-[85%]" />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-700 font-medium">
                            <span className="flex items-center gap-1"><Activity size={11} className="text-slate-400" /> Grid Demand: 210 kW</span>
                            <span className="font-bold text-slate-900">60%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-0.5 overflow-hidden">
                            <div className="bg-slate-700 h-full rounded-full w-[60%]" />
                          </div>
                        </div>

                        <div className="flex justify-between text-slate-700 font-medium pt-0.5">
                          <span className="flex items-center gap-1"><Users size={11} className="text-slate-400" /> Total Personnel:</span>
                          <span className="font-bold text-slate-900">24</span>
                        </div>
                      </div>
                    </div>

                    {/* Maitri Station Card */}
                    <div className="slide-05-station-card rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2 will-change-transform">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-sans text-xs font-black text-slate-900 uppercase">MAITRI STATION</p>
                          <span className="inline-block mt-0.5 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[9.5px] font-bold text-sky-700 uppercase">
                            ACTIVE
                          </span>
                        </div>
                        <div className="h-8 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center relative overflow-hidden">
                          <svg viewBox="0 0 50 40" className="w-full h-full">
                            <path d="M 12 18 Q 20 8 38 12 Q 45 22 35 32 Q 20 35 12 28 Z" fill="#94A3B8" />
                            <circle cx="20" cy="22" r="2.5" fill="#0284C7" />
                          </svg>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-[10.5px] font-sans">
                        <div>
                          <div className="flex justify-between text-slate-700 font-medium">
                            <span className="flex items-center gap-1"><Zap size={11} className="text-slate-400" /> Power Grid Load:</span>
                            <span className="font-bold text-slate-900">195 kW</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-0.5 overflow-hidden">
                            <div className="bg-slate-700 h-full rounded-full w-[70%]" />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-700 font-medium">
                            <span className="flex items-center gap-1"><Fuel size={11} className="text-slate-400" /> Fuel Inventory:</span>
                            <span className="font-bold text-slate-900">6500 L</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-0.5 overflow-hidden">
                            <div className="bg-slate-700 h-full rounded-full w-[80%]" />
                          </div>
                        </div>

                        <div className="flex justify-between text-slate-700 font-medium pt-0.5">
                          <span className="flex items-center gap-1"><Droplets size={11} className="text-slate-400" /> Water Production:</span>
                          <span className="font-bold text-slate-900">40 L/hr</span>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
             PANEL 06: DIGITAL TWIN LIVE SUBSYSTEM HUD (LIGHT THEME GRAPH CARDS)
             ═══════════════════════════════════════════════════════════ */}
          <div className="relative flex h-screen w-screen shrink-0 items-center justify-center p-6 sm:p-12 md:p-20">
            <div className="slide-story-card w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0E121E]/85 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl">
              {/* Kicker Row */}
              <div className="flex items-center gap-3 text-xs font-mono font-bold tracking-widest text-slate-400">
                <span className="text-rose-400">06</span>
                <span className="h-[2px] w-8 bg-rose-500/60" />
                <span>THE DIGITAL TWIN</span>
              </div>

              {/* Huge Headline & Station Selector */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-4">
                <div>
                  <h2 className="font-sans text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
                    REAL-TIME SPATIAL VIEW.
                  </h2>
                  <div className="mt-3 h-[2px] w-24 bg-[#38BDF8]" />
                </div>

                {/* Station Selector Toggle */}
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/50 p-1.5 backdrop-blur shadow-inner">
                  <button
                    onClick={() => handleSelectStation(2)}
                    className={`rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                      selectedStationId === 2
                        ? 'bg-[#38BDF8] text-black font-black shadow-md scale-102'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    BHARATI TWIN (69°S)
                  </button>
                  <button
                    onClick={() => handleSelectStation(1)}
                    className={`rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                      selectedStationId === 1
                        ? 'bg-[#FB7185] text-black font-black shadow-md scale-102'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    MAITRI TWIN (70°S)
                  </button>
                </div>
              </div>

              {/* 4 Live Subsystem KPI Cards (Light Theme with Dynamic Station Data) */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(STATION_SUBSYSTEM_METRICS[selectedStationId] || STATION_SUBSYSTEM_METRICS[2]).map(
                  ({
                    id,
                    label,
                    icon: Icon,
                    val,
                    unit,
                    sub,
                    iconBg,
                    sparklineColor,
                    sparkline,
                    sparklineFill,
                  }) => (
                    <div
                      key={`${selectedStationId}-${id}`}
                      onMouseEnter={() => setCursorHovered(true)}
                      onMouseLeave={() => setCursorHovered(false)}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] text-slate-900 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(0,0,0,0.25)]"
                    >
                      {/* Top Header Row */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10.5px] font-black uppercase tracking-widest text-slate-400">
                            {label}
                          </span>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg} shadow-xs transition-transform group-hover:scale-105`}>
                            <Icon size={15} />
                          </div>
                        </div>

                        {/* Metric Value Display */}
                        <div className="mt-2.5 flex items-baseline">
                          <span className="font-sans text-3xl font-black text-slate-900 tracking-tight leading-none">
                            {val}
                          </span>
                          {unit && (
                            <span className="ml-1 text-sm font-bold text-slate-500">
                              {unit}
                            </span>
                          )}
                        </div>

                        {/* Telemetry Subtext */}
                        <p className="mt-1.5 font-sans text-xs font-semibold text-slate-500">
                          {sub}
                        </p>
                      </div>

                      {/* Bottom Full-Width Organic Sparkline */}
                      <div className="mt-4 -mx-5 -mb-5 relative h-8 overflow-hidden">
                        <svg
                          className="w-full h-full overflow-visible"
                          viewBox="0 0 100 24"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <linearGradient id={`kpi-grad-${selectedStationId}-${id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={sparklineColor} stopOpacity="0.38" />
                              <stop offset="100%" stopColor={sparklineColor} stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d={sparklineFill} fill={`url(#kpi-grad-${selectedStationId}-${id})`} />
                          <path
                            d={sparkline}
                            fill="none"
                            stroke={sparklineColor}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
             PANEL 07: INFRASTRUCTURE COMPARISON MATRIX
             ═══════════════════════════════════════════════════════════ */}
          <div className="relative flex h-screen w-screen shrink-0 items-center justify-center p-6 sm:p-12 md:p-20">
            <div className="slide-story-card w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0E121E]/80 backdrop-blur-2xl p-8 sm:p-14 shadow-2xl">
              {/* Kicker Row */}
              <div className="flex items-center gap-3 text-xs font-mono font-bold tracking-widest text-slate-400">
                <span className="text-rose-400">07</span>
                <span className="h-[2px] w-8 bg-rose-500/60" />
                <span>INFRASTRUCTURE MATRIX</span>
              </div>

              {/* Huge Headline */}
              <h2 className="mt-6 font-sans text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
                TWO STATIONS. ONE PLATFORM.
              </h2>
              <div className="mt-4 h-[2px] w-24 bg-[#38BDF8]" />

              {/* Matrix Table */}
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-3 border-b border-white/10 bg-white/5 p-3.5 font-mono text-xs font-bold text-slate-300">
                  <span>PARAMETER</span>
                  <span className="text-[#38BDF8]">BHARATI STATION</span>
                  <span className="text-[#FB7185]">MAITRI STATION</span>
                </div>
                <div className="divide-y divide-white/5 font-mono text-xs">
                  {[
                    ['COMMISSIONED', '2012 (Modular Stilt Campus)', '1989 (Historic Bedplate Base)'],
                    ['GEOGRAPHY', 'Larsemann Hills (Coast)', 'Schirmacher Oasis (Bedrock)'],
                    ['COORDINATES', '69°24′S 76°11′E', '70°46′S 11°44′E'],
                    ['PRIMARY POWER', '3x 100 kW Cogeneration CHP', 'Diesel Genset Microgrid'],
                    ['FRESH WATER', 'Sea-Water RO Distillation', 'Lake Priyadarshini Pipeline'],
                    ['OVERWINTER CREW', '15 Scientists & Engineers', '18 Scientists & Engineers'],
                    ['DIGITAL TWIN', 'ONLINE (100% Nominal)', 'ONLINE (100% Nominal)'],
                  ].map(([label, bVal, mVal]) => (
                    <div key={label} className="grid grid-cols-3 p-3 hover:bg-white/5 transition-colors">
                      <span className="font-bold text-slate-400">{label}</span>
                      <span className="text-white font-semibold">{bVal}</span>
                      <span className="text-white font-semibold">{mVal}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         6. UNPINNED FINALE & ROTATED/SKEWED MARQUEE FOOTER SECTION
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="finale-section relative z-10 w-full min-h-screen bg-[#070D1C] text-white flex flex-col justify-center py-20 px-6 sm:px-12">
        <div className="max-w-5xl mx-auto text-center my-auto py-12">
          <h2
            className="font-sans font-black uppercase tracking-tight text-white leading-none"
            style={{ fontSize: 'clamp(2.5rem, 6.5vw, 5.8rem)' }}
          >
            ANTARCTICA IS REMOTE.<br />
            <span className="bg-gradient-to-r from-[#38BDF8] via-[#818CF8] to-[#FB7185] bg-clip-text text-transparent">
              THE DATA DOESN'T HAVE TO BE.
            </span>
          </h2>

          <p className="mt-8 max-w-xl mx-auto text-sm sm:text-base leading-relaxed text-slate-300 font-medium">
            Launch the Indian Antarctic digital twin operations console to monitor life-support telemetry, energy generation, and weather predictions in real time.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleNavigateCommand}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-[#38BDF8] px-8 py-4 font-mono text-sm font-black tracking-wider text-[#05070A] shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all hover:bg-[#7FB7FF] cursor-pointer"
            >
              <span>ENTER COMMAND CENTER</span>
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </button>

            <button
              onClick={() => navigate('/audit')}
              className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 font-mono text-sm font-bold tracking-wider text-white backdrop-blur-md transition-colors hover:border-[#38BDF8] hover:bg-white/10 cursor-pointer"
            >
              <Layers size={16} className="text-[#38BDF8]" />
              <span>EXPLORE AUDIT LOGS</span>
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
           ROTATED / SKEWED INFINITE MARQUEE STRIP (AWWWARDS STYLE)
           Alternating outline and solid text styles
           ───────────────────────────────────────────────────────────── */}
        <div className="relative my-12 w-full overflow-hidden py-6 -rotate-2 scale-105 border-y border-[#38BDF8]/30 bg-[#0B1329]/80 backdrop-blur-md shadow-2xl">
          <div className="animate-ticker inline-flex items-center gap-12 whitespace-nowrap">
            {MARQUEE_ITEMS.concat(MARQUEE_ITEMS).map((item, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-8 font-sans text-2xl sm:text-4xl font-black uppercase tracking-tight ${
                  idx % 2 === 0
                    ? 'text-white'
                    : 'text-transparent stroke-white [-webkit-text-stroke:1.5px_#38BDF8]'
                }`}
              >
                <span>{item}</span>
                <span className="text-[#FB7185] font-black text-xl">◆</span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
