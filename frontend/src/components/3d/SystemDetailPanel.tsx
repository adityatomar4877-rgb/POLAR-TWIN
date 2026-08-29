import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Activity,
  Wrench,
  Brain,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Fuel,
  Droplets,
  Home,
  Cpu,
} from 'lucide-react';
import {
  getStationSystem,
  STATUS_BADGE,
  type SystemStatus,
  type TelemetryChannel,
} from '../../lib/3d/stationSystems';
import { useStationStore } from '../../lib/3d/stationStore';
import { useStation } from '../../context/StationContext';
import type { StationDashboardOut } from '../../api/types';
import clsx from 'clsx';

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

const STATUS_DOT: Record<SystemStatus, string> = {
  nominal: 'bg-emerald-500',
  elevated: 'bg-amber-500',
  critical: 'bg-red-500',
  maintenance: 'bg-sky-500',
};
const STATUS_TEXT: Record<SystemStatus, string> = {
  nominal: 'text-emerald-600',
  elevated: 'text-amber-600',
  critical: 'text-red-600',
  maintenance: 'text-sky-600',
};

const CHANNEL_ICON: Record<string, typeof Zap> = {
  Habitat: Home,
  Energy: Zap,
  Water: Droplets,
  Logistics: Fuel,
  Support: Cpu,
};

const HISTORY = 48; // samples per sparkline

interface Reading {
  channel: TelemetryChannel;
  value: number;
  history: number[];
  /** True when the value is bound to a live backend field (not simulated). */
  live: boolean;
}

/** Format a numeric reading according to the channel's decimals. */
function fmt(value: number, ch: TelemetryChannel): string {
  return value.toFixed(ch.decimals);
}

/** One-shot jittered random-walk around the channel base, clamped to bounds. */
function step(prev: number, ch: TelemetryChannel): number {
  const drift = (Math.random() - 0.5) * 2 * ch.jitter;
  // pull gently back toward base so values stay plausible
  const mean = ch.base + (prev - ch.base) * 0.04 + drift;
  return Math.max(ch.min, Math.min(ch.max, mean));
}

/** Seed a channel history from its base value. */
function seedHistory(ch: TelemetryChannel): number[] {
  const arr: number[] = [];
  let v = ch.base;
  for (let i = 0; i < HISTORY; i++) {
    v = step(v, ch);
    arr.push(v);
  }
  return arr;
}

/**
 * Resolve a channel value from live backend telemetry when a direct mapping
 * exists, otherwise return null so the simulator fills the gap. This is the
 * single source of truth for "which 3D channels are synced to the backend".
 */
function liveChannelValue(
  systemId: string,
  channelKey: string,
  dashboard: StationDashboardOut | undefined,
): number | null {
  const energy = dashboard?.energy;
  const env = dashboard?.environment;
  const equipment = dashboard?.equipment;
  switch (systemId) {
    case 'BharatiFuelFarm':
    case 'MaitriFuelFarm':
      if (channelKey === 'tankLevel' && energy) return energy.fuel_percentage;
      break;
    case 'BharatiUtilityArea':
    case 'MaitriUtilityArea':
      if (channelKey === 'genOutput' && energy)
        return energy.diesel_generation_kw || energy.generation_kw;
      if (channelKey === 'exhaustTemp') {
        const gen = equipment?.find(
          (e) => e.equipment_type === 'GENERATOR' && e.temperature != null,
        );
        if (gen) return gen.temperature;
      }
      break;
    case 'BharatiMainBuilding':
    case 'MaitriMainBuilding':
      if (channelKey === 'hullStrain' && env)
        return 26 + Math.pow(env.wind_speed / 1.852, 1.62) * 0.85;
      break;
    case 'BharatiContainerModules':
      if (channelKey === 'zoneTemp' && env) return env.temperature * 0.62 + 2;
      break;
  }
  return null;
}

/** 1 Hz telemetry: live backend values where mapped, simulated random-walk otherwise. */
function useHybridTelemetry(
  systemId: string | null,
  dashboard: StationDashboardOut | undefined,
): Reading[] {
  const [readings, setReadings] = useState<Record<string, Reading[]>>({});
  const buf = useRef<Record<string, Record<string, number[]>>>({});
  const dashRef = useRef(dashboard);
  useEffect(() => {
    dashRef.current = dashboard;
  }, [dashboard]);

  useEffect(() => {
    if (!systemId) return;
    const system = getStationSystem(systemId);
    if (!system) return;

    // initialize buffer lazily
    if (!buf.current[systemId]) {
      buf.current[systemId] = {};
      for (const ch of system.channels) {
        buf.current[systemId][ch.key] = seedHistory(ch);
      }
    }

    const advance = () => {
      const next: Reading[] = [];
      const store = buf.current[systemId];
      for (const ch of system.channels) {
        const hist = store[ch.key];
        const last = hist[hist.length - 1] ?? ch.base;
        const live = liveChannelValue(systemId, ch.key, dashRef.current);
        const nv = live != null ? clamp(live, ch.min, ch.max) : step(last, ch);
        const updated = [...hist.slice(1), nv];
        store[ch.key] = updated;
        next.push({ channel: ch, value: nv, history: updated, live: live != null });
      }
      setReadings((r) => ({ ...r, [systemId]: next }));
    };

    advance(); // immediate
    const id = setInterval(advance, 1000);
    return () => clearInterval(id);
  }, [systemId]);

  return (systemId && readings[systemId]) || [];
}

function Sparkline({ history, warn }: { history: number[]; warn?: boolean }) {
  const pts = useMemo(() => {
    if (history.length < 2) return '';
    const min = Math.min(...history);
    const max = Math.max(...history);
    const span = max - min || 1;
    return history
      .map((v, i) => `${((i / (history.length - 1)) * 100).toFixed(1)},${(24 - ((v - min) / span) * 22 - 1).toFixed(1)}`)
      .join(' ');
  }, [history]);
  return (
    <svg className="mt-1 block h-6 w-full" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={warn ? '#f59e0b' : '#0ea5e9'}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Channel alert: is the current value past a warn/crit threshold? */
function channelAlert(v: number, ch: TelemetryChannel): 'ok' | 'warn' | 'crit' {
  if (ch.critBelow !== undefined && v < ch.critBelow) return 'crit';
  if (ch.critAbove !== undefined && v > ch.critAbove) return 'crit';
  if (ch.warnBelow !== undefined && v < ch.warnBelow) return 'warn';
  if (ch.warnAbove !== undefined && v > ch.warnAbove) return 'warn';
  return 'ok';
}

/** Deterministic hash of a string -> [0,1). Keeps RUL stable per system across renders. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** AI Remaining-Useful-Life insight derived deterministically from system + status. */
function useRulInsight(systemId: string | null, status: SystemStatus) {
  if (!systemId) return { wear: 0, rulHours: 0, confidence: 92, daysToService: 0 };
  // wear seeded from a stable hash, biased by effective status.
  const base = status === 'critical' ? 78 : status === 'elevated' ? 52 : status === 'maintenance' ? 64 : 14;
  const wear = base + hash01(systemId) * 6;
  const rulHours = Math.max(0, Math.round((100 - wear) * 96));
  const confidence = Math.round(92 - wear * 0.5);
  const daysToService = Math.max(0, Math.round(rulHours / 24));
  return { wear, rulHours, confidence, daysToService };
}

const SOP_BY_CATEGORY: Record<string, { id: string; label: string; auto: boolean }[]> = {
  Habitat: [
    { id: 'hvac-trip', label: 'Verify HVAC redundancy and switch to backup loop', auto: false },
    { id: 'life-support', label: 'Confirm life-support air pressure within envelope', auto: true },
  ],
  Energy: [
    { id: 'gen-sync', label: 'Synchronize backup genset to the microgrid bus', auto: false },
    { id: 'fuel-transfer', label: 'Isolate leaking fuel transfer line and engage bypass', auto: true },
  ],
  Water: [
    { id: 'trace-heat', label: 'Activate trace-heating on frozen intake pipeline', auto: true },
    { id: 'ro-swap', label: 'Schedule RO membrane cartridge replacement', auto: false },
  ],
  Logistics: [
    { id: 'hull-deice', label: 'Dispatch hull de-icing crew to container yard', auto: false },
  ],
  Support: [
    { id: 'gen-maint', label: 'Execute scheduled bearing inspection & lube service', auto: false },
    { id: 'vibration', label: 'Isolate high-vibration genset, transfer load to standby', auto: true },
  ],
};

/** Docked 3D inspection panel: live telemetry sparklines + AI RUL + SOP actions. */
export function SystemDetailPanel() {
  const selectedSystemId = useStationStore((s) => s.selectedSystemId);
  const clearSelection = useStationStore((s) => s.clearSelection);
  const status = useStationStore(
    selectedSystemId ? (s) => {
      const sys = getStationSystem(selectedSystemId);
      if (!sys) return 'nominal' as SystemStatus;
      const override = s.statusOverrides[selectedSystemId];
      if (override) return override;
      return sys.status;
    } : () => 'nominal' as SystemStatus,
  );
  const [tab, setTab] = useState<'telemetry' | 'ai' | 'sop'>('telemetry');
  const [sopDone, setSopDone] = useState<Record<string, boolean>>({});

  const { dashboard } = useStation();
  const readings = useHybridTelemetry(selectedSystemId, dashboard);
  const rul = useRulInsight(selectedSystemId, status);

  // reset SOP checkboxes when system changes
  useEffect(() => {
    setSopDone({});
  }, [selectedSystemId]);

  if (!selectedSystemId) return null;
  const system = getStationSystem(selectedSystemId);
  if (!system) return null;

  const Icon = CHANNEL_ICON[system.category] ?? Activity;
  const sops = SOP_BY_CATEGORY[system.category] ?? [];

  return (
    <aside className="pointer-events-auto absolute right-3 top-16 z-20 flex max-h-[calc(100%-5rem)] w-[19rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-md">
      {/* header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-cyan-700">
              {system.category}
            </span>
            <h3 className="truncate text-sm font-extrabold text-slate-900">{system.label}</h3>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={clsx(
              'rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider',
              status === 'critical' && 'border-red-200 bg-red-50 text-red-600',
              status === 'elevated' && 'border-amber-200 bg-amber-50 text-amber-700',
              status === 'maintenance' && 'border-sky-200 bg-sky-50 text-sky-700',
              status === 'nominal' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
            )}
          >
            {STATUS_BADGE[status]}
          </span>
          <button
            onClick={clearSelection}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close panel"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* status row */}
      <div className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider">
        <span className={clsx('h-2 w-2 rounded-full', STATUS_DOT[status])} />
        <span className={STATUS_TEXT[status]}>{STATUS_BADGE[status]}</span>
        <span className="ml-auto flex items-center gap-1 font-mono text-[9px] font-semibold text-emerald-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE · 1 Hz
        </span>
      </div>

      <p className="px-3.5 pb-2 text-[11px] leading-relaxed text-slate-500">{system.summary}</p>

      {/* tabs */}
      <div className="flex gap-1 border-b border-slate-100 px-3.5 pb-2">
        {([
          ['telemetry', 'Telemetry', Activity],
          ['ai', 'AI Maintenance', Brain],
          ['sop', 'SOP Center', ClipboardList],
        ] as const).map(([t, label, TIcon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border-b-2 px-1 py-1.5 font-mono text-[8px] font-bold uppercase tracking-wide transition-colors',
              tab === t
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-slate-400 hover:text-slate-700',
            )}
          >
            <TIcon size={11} /> {label}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="custom-scrollbar flex-1 overflow-y-auto p-3.5">
        {tab === 'telemetry' && (
          <div className="grid grid-cols-2 gap-2">
            {readings.map((r) => {
              const al = channelAlert(r.value, r.channel);
              return (
                <div
                  key={r.channel.key}
                  className={clsx(
                    'rounded-lg border bg-slate-50/60 p-2 transition-colors',
                    al === 'crit' && 'border-red-200 bg-red-50/50',
                    al === 'warn' && 'border-amber-200 bg-amber-50/50',
                    (al === 'ok' || al === undefined) && 'border-slate-200',
                  )}
                >
                  <div className="truncate font-mono text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    {r.channel.label}
                    {r.live && (
                      <span className="ml-1 rounded bg-emerald-100 px-1 py-px text-[7px] font-bold uppercase text-emerald-600">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-extrabold text-slate-800">
                    {fmt(r.value, r.channel)}
                    <span className="ml-1 text-[9px] font-semibold text-slate-400">{r.channel.unit}</span>
                  </div>
                  <Sparkline history={r.history} warn={al !== 'ok'} />
                </div>
              );
            })}
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-3">
            <div
              className={clsx(
                'rounded-lg border-l-4 p-2.5',
                status === 'critical' ? 'border-red-500 bg-red-50/60' : 'border-amber-400 bg-amber-50/60',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-slate-400">
                  RUL Model · {system.label}
                </span>
                <span
                  className={clsx(
                    'rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase',
                    status === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {status === 'critical' ? 'CRITICAL' : status === 'elevated' ? 'WARNING' : 'INFO'}
                </span>
              </div>
              <div className="mt-1.5 text-xs font-bold text-slate-800">
                {rul.wear >= 75
                  ? 'Accelerated wear detected — schedule immediate intervention.'
                  : rul.wear >= 45
                    ? 'Degradation trending upward — plan maintenance window.'
                    : 'Asset health nominal within operating envelope.'}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                    style={{ width: `${Math.min(100, rul.wear)}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] font-bold text-slate-500">{rul.wear.toFixed(1)}%</span>
              </div>

              <div className="mt-2 flex gap-3 font-mono text-[9px] text-slate-500">
                <span>RUL <b className="text-slate-800">{rul.rulHours.toLocaleString()} h</b></span>
                <span>CONF <b className="text-slate-800">±{rul.confidence}%</b></span>
                <span>SERVICE IN <b className="text-slate-800">{rul.daysToService} d</b></span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
              {status === 'critical' ? (
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
              ) : (
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
              )}
              <p className="text-[11px] leading-relaxed text-slate-600">
                {status === 'critical'
                  ? 'Vibration / thermal signatures exceed intervention threshold. Initiate SOP and isolate asset.'
                  : status === 'elevated'
                    ? 'Anomaly correlation engine flagged a gradual drift. Monitor at next maintenance cycle.'
                    : 'No cross-system anomaly correlations detected by the pattern engine.'}
              </p>
            </div>
          </div>
        )}

        {tab === 'sop' && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-wider text-slate-400">
              <Wrench size={11} /> Standard Operating Procedures
            </div>
            {sops.length === 0 && (
              <p className="py-3 text-center text-[11px] text-slate-400">No SOPs defined for this category.</p>
            )}
            {sops.map((sop) => {
              const done = sopDone[sop.id];
              return (
                <button
                  key={sop.id}
                  onClick={() => setSopDone((d) => ({ ...d, [sop.id]: !d[sop.id] }))}
                  className={clsx(
                    'flex w-full cursor-pointer items-center gap-2.5 rounded-lg border p-2 text-left transition-colors',
                    done ? 'border-emerald-200 bg-emerald-50/50 opacity-60' : 'border-slate-200 bg-white hover:border-cyan-300',
                    sop.auto && !done && 'border-l-2 border-l-amber-400',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold',
                      done ? 'border-emerald-500 text-emerald-600' : 'border-slate-300 text-slate-400',
                    )}
                  >
                    {done ? '✓' : ''}
                  </span>
                  <span className={clsx('flex-1 text-[11px] leading-snug', done ? 'text-slate-400 line-through' : 'text-slate-700')}>
                    {sop.label}
                  </span>
                  {sop.auto && !done && (
                    <span className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[7px] font-bold uppercase text-amber-700">
                      Auto
                    </span>
                  )}
                </button>
              );
            })}
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="font-mono text-[9px] text-slate-400">
                {Object.values(sopDone).filter(Boolean).length}/{sops.length} complete
              </span>
              <span
                className={clsx(
                  'font-mono text-[9px] font-bold',
                  Object.values(sopDone).filter(Boolean).length === sops.length && sops.length > 0
                    ? 'text-emerald-600'
                    : 'text-slate-400',
                )}
              >
                {Object.values(sopDone).filter(Boolean).length === sops.length && sops.length > 0
                  ? '✓ SOP COMPLETE'
                  : 'IN PROGRESS'}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default SystemDetailPanel;
