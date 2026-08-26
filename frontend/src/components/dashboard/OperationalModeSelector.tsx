import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ShieldCheck, CloudSnow, SunMedium, Moon, Sparkles, Activity } from 'lucide-react';
import clsx from 'clsx';

export type PolarMode = 'STANDARD' | 'BLIZZARD' | 'RENEWABLE' | 'ECO_NIGHT';

interface ModeConfig {
  id: PolarMode;
  label: string;
  shortLabel: string;
  icon: typeof ShieldCheck;
  tag: string;
  tagColor: string;
  description: string;
  powerFactor: string;
  heatingTarget: string;
}

const MODES: ModeConfig[] = [
  {
    id: 'STANDARD',
    label: 'Standard Operations',
    shortLabel: 'Nominal',
    icon: ShieldCheck,
    tag: 'GRID BALANCED',
    tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Continuous telemetry telemetry, baseline thermal control, and balanced microgrid dispatch.',
    powerFactor: '1.0x Nominal',
    heatingTarget: '+19.5°C Habitats',
  },
  {
    id: 'BLIZZARD',
    label: 'Blizzard Storm Protocol',
    shortLabel: 'Blizzard Alert',
    icon: CloudSnow,
    tag: 'HIGH REDUNDANCY',
    tagColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    description: 'Active antenna & vestibule de-icing, dual generator standby, exterior sensors storm-locked.',
    powerFactor: '1.35x Surge',
    heatingTarget: '+22.0°C Core',
  },
  {
    id: 'RENEWABLE',
    label: 'Renewable Surge',
    shortLabel: 'Green Max',
    icon: SunMedium,
    tag: 'SOLAR / WIND SURPLUS',
    tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Prioritizing solar and wind harvest into battery banks; diesel generation minimized.',
    powerFactor: '0.4x Diesel',
    heatingTarget: '+20.0°C Standard',
  },
  {
    id: 'ECO_NIGHT',
    label: 'Polar Night Eco Mode',
    shortLabel: 'Conservation',
    icon: Moon,
    tag: 'ENERGY SAVING',
    tagColor: 'bg-violet-50 text-violet-700 border-violet-200',
    description: 'Non-critical research equipment staged down; thermal containment shutters secured.',
    powerFactor: '0.75x Eco',
    heatingTarget: '+18.0°C Eco',
  },
];

export default function OperationalModeSelector() {
  const [activeMode, setActiveMode] = useState<PolarMode>('STANDARD');
  const [isSimulating, setIsSimulating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const current = MODES.find((m) => m.id === activeMode) ?? MODES[0];
  const Icon = current.icon;

  const handleSelectMode = (id: PolarMode) => {
    if (id === activeMode) return;
    setActiveMode(id);
    setIsSimulating(true);

    if (badgeRef.current) {
      gsap.fromTo(
        badgeRef.current,
        { scale: 0.95, opacity: 0.6, y: -4 },
        { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.7)' }
      );
    }

    setTimeout(() => {
      setIsSimulating(false);
    }, 1200);
  };

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { y: -12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }
      );
    }
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md"
    >
      {/* Subtle background aurora sweep */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-blue-400/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left header / status */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-cyan-300 shadow-sm ring-1 ring-white/20">
            <Icon size={20} className={clsx(isSimulating && 'animate-spin')} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">
                Mission Command Matrix
              </h2>
              <span
                ref={badgeRef}
                className={clsx(
                  'rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide transition-all',
                  current.tagColor
                )}
              >
                {isSimulating ? 'UPDATING PROTOCOL...' : current.tag}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
              {current.description}
            </p>
          </div>
        </div>

        {/* Mode switcher pills */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/60">
          {MODES.map((mode) => {
            const ModeIcon = mode.icon;
            const isSelected = mode.id === activeMode;
            return (
              <button
                key={mode.id}
                onClick={() => handleSelectMode(mode.id)}
                className={clsx(
                  'relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                  isSelected
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                )}
              >
                <ModeIcon
                  size={13}
                  className={clsx(
                    'transition-colors',
                    isSelected ? 'text-cyan-600' : 'text-slate-400'
                  )}
                />
                <span>{mode.shortLabel}</span>
                {isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick live parameters ribbon */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Activity size={12} className="text-cyan-500" />
            <span className="font-semibold text-slate-700">Dispatch Index:</span> {current.powerFactor}
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-500" />
            <span className="font-semibold text-slate-700">Thermal Target:</span> {current.heatingTarget}
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
          <span>MODE HASH:</span>
          <span className="font-bold text-slate-600">POLAR-{activeMode.slice(0, 3)}-2026</span>
        </div>
      </div>
    </section>
  );
}
