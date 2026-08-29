import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Snowflake,
  ChevronDown,
  Zap,
  BatteryCharging,
  Thermometer,
  Wind,
  Users,
  Radio,
  ShieldAlert,
  BrainCircuit,
} from 'lucide-react';
import { useStation } from '../../context/StationContext';
import AtmosphericSnowCanvas from './AtmosphericSnowCanvas';
import AntarcticMapSelector, { STATION_GEO } from './AntarcticMapSelector';
import DigitalTwinScene from '../3d/DigitalTwinScene';
import { getStationRecommendations } from '../../api/stations';
import type { OperationalRecommendation } from '../../api/types';
import InteractiveHoverButton from '../motion/InteractiveHoverButton';

gsap.registerPlugin(ScrollTrigger);

const SUMMER_CREW = 24;

interface Props {
  onEnterCommandCenter?: () => void;
}

/* Progress windows (fractions of total scroll) per scene ---------------- */
const WINDOWS = [
  { enter: 0.0, exit: 0.115 },
  { enter: 0.125, exit: 0.245 },
  { enter: 0.255, exit: 0.455 }, // interactive map — long dwell
  { enter: 0.465, exit: 0.575 },
  { enter: 0.585, exit: 0.71 },
  { enter: 0.72, exit: 0.82 },
  { enter: 0.83, exit: 0.915 },
  { enter: 0.925, exit: 2.0 }, // final scene stays
];

const SCENE_LABELS = [
  'ICE EXPANSE',
  'MISSION',
  'STATIONS',
  'FACILITY',
  'DIGITAL TWIN',
  'TELEMETRY',
  'INTELLIGENCE',
  'COMMAND',
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="glass-panel rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.18em] text-cyan-100/80">
      {children}
    </span>
  );
}

function SceneHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-[11px] tracking-[0.5em] text-cyan-400/80">{kicker}</p>
      <h2 className="mt-3 bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-[clamp(1.9rem,4.6vw,3.8rem)] font-bold leading-tight tracking-tight text-transparent">
        {title}
      </h2>
    </div>
  );
}

export default function AntarcticStoryScroller({ onEnterCommandCenter }: Props) {
  const navigate = useNavigate();
  const { dashboard, selectedStationId, setSelectedStationId, stations } = useStation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const snowWrapRef = useRef<HTMLDivElement>(null);
  const [activeScene, setActiveScene] = useState(0);

  const windSpeed = dashboard?.environment?.wind_speed ?? 24;

  const { data: recommendations } = useQuery<OperationalRecommendation[]>({
    queryKey: ['recommendations', selectedStationId],
    queryFn: () => getStationRecommendations(selectedStationId),
    enabled: true,
    staleTime: 15000,
  });

  /* ---------------- Master scrubbed timeline ---------------- */
  useEffect(() => {
    if (!wrapperRef.current || !stageRef.current) return;

    const ctx = gsap.context(() => {
      const scenes = gsap.utils.toArray<HTMLElement>('[data-scene]');
      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: wrapperRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
          onUpdate: (self) => {
            const p = self.progress;
            let idx = 0;
            for (let i = 0; i < WINDOWS.length; i++) {
              if (p >= WINDOWS[i].enter) idx = i;
            }
            setActiveScene(idx);
          },
        },
      });

      scenes.forEach((scene, i) => {
        const w = WINDOWS[i];
        const dur = Math.max(w.exit - w.enter, 0.001);
        const fadeIn = Math.min(dur * 0.42, 0.07);
        const fadeOut = Math.min(dur * 0.38, 0.055);

        if (i === 0) {
          gsap.set(scene, { autoAlpha: 1 });
          tl.fromTo(
            scene,
            { autoAlpha: 1, y: 0 },
            { autoAlpha: 0, y: -50, duration: fadeOut, ease: 'power2.in' },
            w.exit - fadeOut
          );
        } else {
          gsap.set(scene, { autoAlpha: 0 });
          tl.fromTo(
            scene,
            { autoAlpha: 0, y: 70 },
            { autoAlpha: 1, y: 0, duration: fadeIn },
            w.enter
          );
          if (w.exit <= 1) {
            tl.to(scene, { autoAlpha: 0, y: -50, duration: fadeOut, ease: 'power2.in' }, w.exit - fadeOut);
          }
        }

        // Slow inner parallax drift for depth
        const inner = scene.querySelector('[data-inner]');
        if (inner) {
          tl.fromTo(
            inner,
            { scale: 1.06, filter: 'blur(6px)' },
            { scale: 1, filter: 'blur(0px)', duration: dur * 0.8 },
            w.enter
          );
        }
      });

      // Snow atmosphere fades away once inside the digital twin domain
      if (snowWrapRef.current) {
        tl.fromTo(snowWrapRef.current, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.06 }, 0.62);
      }
    }, stageRef);

    return () => ctx.revert();
  }, []);

  const energy = dashboard?.energy;
  const env = dashboard?.environment;
  const geo = STATION_GEO[selectedStationId] ?? STATION_GEO[1];
  const criticalAlerts =
    dashboard?.alerts?.filter((a) => a.severity === 'CRITICAL' && a.is_active !== false) ?? [];
  const riskLevel = criticalAlerts.length > 0 ? 'ELEVATED' : energy && energy.energy_balance < 0 ? 'GUARDED' : 'NOMINAL';
  const topRecs = (recommendations ?? []).filter((r) => r.status === 'ACTIVE').slice(0, 3);

  const handleSelectStation = (id: number) => setSelectedStationId(id);

  return (
    <div ref={wrapperRef} className="relative h-[900vh] bg-polar-deep polar-grid-bg">
      {/* Sticky cinematic stage */}
      <div ref={stageRef} className="sticky top-0 h-screen overflow-hidden">
        {/* Persistent polar atmosphere */}
        <div ref={snowWrapRef} className="absolute inset-0 z-[1]">
          <AtmosphericSnowCanvas windSpeedKmh={windSpeed} density={0.00009} />
          <div className="absolute inset-0 bg-gradient-to-b from-polar-deep/70 via-transparent to-polar-deep" />
        </div>

        {/* SCENE 01 — Antarctica: The Ice Expanse */}
        <section data-scene className="absolute inset-0 z-[2] flex items-center justify-center">
          <div data-inner className="flex max-w-5xl flex-col items-center px-6 text-center">
            <Chip>69°S · THE HARSHEST CONTINENT ON EARTH</Chip>
            <h1 className="mt-8 bg-gradient-to-b from-white via-sky-100 to-sky-300/70 bg-clip-text text-[clamp(3.4rem,11vw,10rem)] font-black leading-none tracking-tight text-transparent text-glow-cyan">
              ANTARCTICA
            </h1>
            <p className="mt-6 max-w-2xl text-balance font-mono text-sm leading-relaxed tracking-wider text-slate-300/90 md:text-base">
              A continent of ice, wind and silence — where engineering meets the edge of what is possible,
              and every kilowatt decides survival.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Chip>−89.2°C COLDEST EVER RECORDED</Chip>
              <Chip>~90% OF EARTH'S ICE</Chip>
              <Chip>KATABATIC WINDS 300+ KM/H</Chip>
            </div>
            <Snowflake className="mt-12 animate-spin text-cyan-300/60" size={22} style={{ animationDuration: '14s' }} />
          </div>
        </section>

        {/* SCENE 02 — Indian Antarctic Mission */}
        <section data-scene className="absolute inset-0 z-[3] flex items-center justify-center">
          <div data-inner className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 lg:flex-row lg:gap-16">
            <div className="flex-1 text-left">
              <p className="font-mono text-[11px] tracking-[0.5em] text-cyan-400/80">SINCE 1981 · MOES · NCPOR</p>
              <h2 className="mt-3 text-[clamp(2rem,4.8vw,4rem)] font-bold leading-tight text-white">
                India's Southernmost<br />Outpost of Science
              </h2>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-slate-300/90 md:text-base">
                Four decades of Indian expeditions have crossed the Southern Ocean to build permanent
                research presence on the Antarctic continent — sustaining world-class climate, glaciology
                and polar biology programs through winters no human was meant to endure.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Chip>1981 · FIRST EXPEDITION</Chip>
                <Chip>1989 · MAITRI COMMISSIONED</Chip>
                <Chip>2012 · BHARATI COMMISSIONED</Chip>
              </div>
            </div>
            <div className="glass-panel relative flex-1 rounded-2xl p-8 font-mono">
              <p className="text-[10px] tracking-[0.4em] text-slate-400">EXPEDITION LEDGER</p>
              <div className="mt-6 space-y-5">
                {[
                  ['VOYAGES COMPLETED', '43'],
                  ['ACTIVE STATIONS', '02'],
                  ['OVERWINTERING TEAMS RELIEVED', '41'],
                  ['RESEARCH PROJECTS LIVE', '30+'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between border-b border-slate-700/40 pb-3">
                    <span className="text-xs tracking-[0.25em] text-slate-400">{label}</span>
                    <span className="text-2xl font-bold text-cyan-300 text-glow-cyan">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SCENE 03 — Geographic Station Selector */}
        <section data-scene className="absolute inset-0 z-[4] flex items-center justify-center">
          <div data-inner className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-4 py-16">
            <SceneHeading kicker="SELECT DESTINATION" title="Two Stations. One Mission." />
            <div className="mt-6 min-h-0 flex-1">
              <AntarcticMapSelector selectedStationId={selectedStationId} onSelect={handleSelectStation} />
            </div>
          </div>
        </section>

        {/* SCENE 04 — The Physical Facility */}
        <section data-scene className="absolute inset-0 z-[5] flex items-center justify-center">
          <div data-inner className="mx-auto w-full max-w-6xl px-6 text-center">
            <SceneHeading kicker="APPROACH VECTOR" title={`${geo.name} — ${geo.region}`} />
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-300/90">
              An architectural envelope engineered against {geo.winterTempC}°C winters and {geo.peakWindKmh} km/h
              catabatic gusts — generators, life support and science labs sealed behind insulated hulls.
            </p>
            <div className="relative mx-auto mt-10 h-[38vh] max-h-72 w-full max-w-2xl">
              <svg viewBox="0 0 640 260" className="h-full w-full drop-shadow-[0_0_35px_rgba(34,211,238,0.15)]">
                {/* ground ice line */}
                <line x1="0" y1="215" x2="640" y2="215" stroke="#164e63" strokeWidth="2" strokeOpacity="0.7" />
                <rect x="0" y="215" width="640" height="45" fill="#082032" fillOpacity="0.55" />
                {/* main block */}
                <rect x="120" y="120" width="330" height="95" rx="6" fill="#122b47" stroke="#22d3ee" strokeOpacity="0.65" strokeWidth="1.6" />
                <rect x="140" y="140" width="52" height="30" rx="2" fill="#0ea5e9" fillOpacity="0.28" />
                <rect x="204" y="140" width="52" height="30" rx="2" fill="#0ea5e9" fillOpacity="0.28" />
                <rect x="268" y="140" width="52" height="30" rx="2" fill="#0ea5e9" fillOpacity="0.28" />
                <rect x="332" y="140" width="52" height="30" rx="2" fill="#0ea5e9" fillOpacity="0.28" />
                {/* radome */}
                <path d="M 500 215 A 46 46 0 0 1 592 215 Z" fill="#122b47" stroke="#67e8f9" strokeOpacity="0.6" strokeWidth="1.4" />
                <line x1="546" y1="169" x2="546" y2="150" stroke="#67e8f9" strokeWidth="1.4" />
                {/* stilt pods */}
                {[430, 470].map((x) => (
                  <g key={x}>
                    <rect x={x} y="168" width="34" height="34" rx="4" fill="#122b47" stroke="#22d3ee" strokeOpacity="0.5" />
                    <line x1={x + 4} y1="202" x2={x + 2} y2="215" stroke="#22d3ee" strokeOpacity="0.5" />
                    <line x1={x + 30} y1="202" x2={x + 32} y2="215" stroke="#22d3ee" strokeOpacity="0.5" />
                  </g>
                ))}
                {/* turbines */}
                {[70, 96].map((x, i) => (
                  <g key={x}>
                    <line x1={x} y1="215" x2={x} y2="130" stroke="#38bdf8" strokeWidth="2" strokeOpacity="0.8" />
                    <g transform={`translate(${x} 130)`}>
                      {[0, 120, 240].map((r) => (
                        <line key={r} x1="0" y1="0" x2="24" y2="0" stroke="#7dd3fc" strokeWidth="1.6" transform={`rotate(${r})`} opacity={i === 0 ? 0.9 : 0.55}>
                          <animateTransform attributeName="transform" type="rotate" from={`${r} 0 0`} to={`${r + 360} 0 0`} dur={i === 0 ? '3.4s' : '5s'} repeatCount="indefinite" />
                        </line>
                      ))}
                      <circle r="3" fill="#7dd3fc" />
                    </g>
                  </g>
                ))}
                <text x="320" y="250" textAnchor="middle" fill="#4b6b85" fontSize="10" fontFamily="monospace" letterSpacing="4">
                  ENVIRONMENTAL BUFFER · PERMAFROST ANCHOR · AERODYNAMIC SHELL
                </text>
              </svg>
            </div>
          </div>
        </section>

        {/* SCENE 05 — Digital Twin Transformation */}
        <section data-scene className="absolute inset-0 z-[6] flex items-center justify-center">
          <div data-inner className="mx-auto flex h-full w-full max-w-6xl flex-col items-center justify-center gap-4 px-4 py-14">
            <SceneHeading kicker="TRANSFORMATION" title="Physical Plant → Living Digital Twin" />
            <div className="glass-panel relative h-[52vh] min-h-64 w-full max-w-4xl overflow-hidden rounded-2xl">
              <DigitalTwinScene stationId={selectedStationId} interactive={false} compact />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-emergency-strobe bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
              <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-polar-deep/80 px-4 py-1.5 font-mono text-[10px] tracking-[0.35em] text-cyan-300">
                TWIN LINK ACTIVE · {stations.find((s) => s.id === selectedStationId)?.code?.toUpperCase() ?? geo.name}
              </div>
            </div>
          </div>
        </section>

        {/* SCENE 06 — Live Subsystem Telemetry */}
        <section data-scene className="absolute inset-0 z-[7] flex items-center justify-center">
          <div data-inner className="mx-auto w-full max-w-6xl px-6 text-center">
            <SceneHeading kicker="LIVE DOWNLINK" title="Every Subsystem, Streaming Now" />
            <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-3">
              {[
                { icon: Zap, label: 'GENERATION', value: `${(energy?.generation_kw ?? 0).toFixed(1)} kW`, tone: 'text-cyan-300' },
                { icon: BatteryCharging, label: 'BATTERY BANK', value: `${(energy?.battery_percentage ?? 0).toFixed(0)} %`, tone: energy && energy.battery_percentage < 20 ? 'text-red-400' : 'text-emerald-300' },
                { icon: Radio, label: 'GRID STATUS', value: (energy?.grid_status ?? 'NOMINAL').toUpperCase(), tone: energy && energy.grid_status === 'EMERGENCY' ? 'text-red-400' : 'text-emerald-300' },
                { icon: Thermometer, label: 'SURFACE TEMP', value: `${env?.temperature != null ? env.temperature.toFixed(1) : '—'} °C`, tone: 'text-sky-300' },
                { icon: Wind, label: 'WIND SPEED', value: `${env?.wind_speed != null ? env.wind_speed.toFixed(0) : '—'} km/h`, tone: 'text-sky-300' },
                { icon: Users, label: 'POPULATION', value: `${dashboard?.station ? SUMMER_CREW : '—'}`, tone: 'text-slate-200' },
              ].map(({ icon: Icon, label, value, tone }) => (
                <div key={label} className="glass-panel rounded-xl p-5 text-left">
                  <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-slate-400">
                    <Icon size={13} className="text-cyan-400/80" /> {label}
                  </div>
                  <div className={`mt-3 font-mono text-2xl font-bold ${tone}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SCENE 07 — AI Anomaly & Risk Intelligence */}
        <section data-scene className="absolute inset-0 z-[8] flex items-center justify-center">
          <div data-inner className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-6 lg:flex-row">
            <div className="flex-1 text-left">
              <p className="font-mono text-[11px] tracking-[0.5em] text-violet-300/90">OPERATIONS COPILOT</p>
              <h2 className="mt-3 text-[clamp(1.9rem,4.4vw,3.6rem)] font-bold leading-tight text-white">
                AI That Watches<br />So You Survive
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-300/90">
                The digital twin continuously scores anomalies across power, environment and logistics —
                surfacing ranked operational recommendations before failures cascade.
              </p>
              <div className="mt-7 flex items-center gap-3">
                <ShieldAlert size={16} className={riskLevel === 'NOMINAL' ? 'text-emerald-400' : 'text-amber-400'} />
                <span className="font-mono text-sm tracking-[0.25em] text-slate-200">
                  STATION RISK: <span className={riskLevel === 'NOMINAL' ? 'text-emerald-400' : 'text-amber-400'}>{riskLevel}</span>
                </span>
              </div>
            </div>
            <div className="glass-panel-strong w-full flex-1 space-y-3 rounded-2xl p-6">
              <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.4em] text-slate-400">
                <BrainCircuit size={14} className="text-violet-300" /> ACTIVE DIAGNOSTICS
              </p>
              {topRecs.length === 0 && (
                <p className="py-6 text-center font-mono text-xs tracking-widest text-slate-500">
                  NO ACTIVE RECOMMENDATIONS · ALL SYSTEMS WITHIN ENVELOPE
                </p>
              )}
              {topRecs.map((rec) => (
                <div key={rec.id} className="rounded-lg border border-slate-700/50 bg-polar-deep/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">{rec.category}</span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[9px] tracking-widest ${
                        rec.severity === 'CRITICAL'
                          ? 'bg-red-500/15 text-red-300'
                          : rec.severity === 'WARNING'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-cyan-500/15 text-cyan-300'
                      }`}
                    >
                      {rec.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{rec.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{rec.suggested_action}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SCENE 08 — Command Center Transition */}
        <section data-scene className="absolute inset-0 z-[9] flex items-center justify-center">
          <div data-inner className="flex max-w-3xl flex-col items-center px-6 text-center">
            <Chip>YOU ARE CLEARED FOR OPERATIONS</Chip>
            <h2 className="mt-8 text-[clamp(2.4rem,6vw,5.2rem)] font-black leading-tight text-white">
              Operations<br />Command Center
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300/90">
              Take direct control of {geo.name}'s microgrid, issue safety-interlocked commands, and monitor
              every subsystem in real time.
            </p>
            <div className="mt-10">
              <InteractiveHoverButton
                onClick={() => {
                  if (onEnterCommandCenter) onEnterCommandCenter();
                  else navigate('/');
                }}
                variant="cyan"
                text="ENTER COMMAND CENTER"
                className="px-9 py-4 font-mono text-sm font-bold tracking-[0.25em] text-cyan-200 border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_25px_rgba(6,182,212,0.25)]"
              />
            </div>
          </div>
        </section>

        {/* Progress rail */}
        <div className="pointer-events-none absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-4 md:flex lg:right-8">
          {SCENE_LABELS.map((label, i) => (
            <div key={label} className="flex items-center justify-end gap-3">
              <span
                className={`font-mono text-[9px] tracking-[0.3em] transition-all duration-500 ${
                  activeScene === i ? 'text-cyan-300' : 'text-slate-600'
                }`}
              >
                {String(i + 1).padStart(2, '0')} {label}
              </span>
              <span
                className={`block h-px transition-all duration-500 ${
                  activeScene === i ? 'w-7 bg-cyan-300' : 'w-3.5 bg-slate-700'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="pointer-events-none absolute bottom-7 left-1/2 z-30 -translate-x-1/2">
          <ChevronDown
            size={20}
            className={`animate-bounce text-cyan-300/70 transition-opacity duration-700 ${activeScene === 0 ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
      </div>
    </div>
  );
}
