import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Radio, ChevronDown, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { useStation } from '../../context/StationContext';

type Mode = 'mission' | 'operations';

interface Props {
  mode?: Mode;
  onNavigateMission?: (target: string) => void;
}

const MISSION_LINKS = [
  { label: 'MISSION', target: 'scene-1' },
  { label: 'STATIONS', target: 'scene-3' },
  { label: 'DIGITAL TWIN', target: 'scene-5' },
  { label: 'INTELLIGENCE', target: 'scene-7' },
];

const OPS_LINKS = [
  { label: 'COMMAND CENTER', target: '/' },
  { label: 'ENERGY', target: '/energy' },
  { label: 'ENVIRONMENT', target: '/environment' },
  { label: 'INFRASTRUCTURE', target: '/infrastructure' },
  { label: 'LOGISTICS', target: '/logistics' },
  { label: 'OPERATIONS', target: '/operations' },
];

export default function AdaptiveHeader({ mode = 'operations', onNavigateMission }: Props) {
  const { stations, selectedStationId, setSelectedStationId, wsConnected, emergencyModeActive, dashboard } =
    useStation();
  const [utcNow, setUtcNow] = useState(new Date());
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setUtcNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const backendEmergency =
    dashboard?.energy?.grid_status?.toUpperCase() === 'EMERGENCY' ||
    dashboard?.energy?.grid_status?.toUpperCase() === 'CRITICAL';
  const emergencyActive = emergencyModeActive || backendEmergency;

  const stationName =
    stations.find((s) => s.id === selectedStationId)?.code?.toUpperCase() ??
    (selectedStationId === 1 ? 'MAITRI' : 'BHARATI');

  const links = mode === 'mission' ? MISSION_LINKS : OPS_LINKS;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-cyan-400/10 bg-polar-deep/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <Radio size={17} className="animate-pulse text-cyan-400" />
          <span className="font-mono text-sm font-bold tracking-[0.3em] text-white">
            POLAR<span className="text-cyan-400">·</span>TWIN
          </span>
          <span
            className={clsx(
              'hidden rounded px-1.5 py-0.5 font-mono text-[9px] tracking-widest sm:inline',
              mode === 'mission' ? 'bg-slate-700/60 text-slate-300' : 'bg-cyan-400/15 text-cyan-300'
            )}
          >
            {mode === 'mission' ? 'PUBLIC FEED' : 'OPS AUTHORIZED'}
          </span>
        </div>

        {/* Nav */}
        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={() => {
                if (mode === 'mission') onNavigateMission?.(l.target);
                else if (l.target.startsWith('/')) window.location.assign(l.target);
              }}
              className="rounded px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] text-slate-400 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Emergency badge */}
          {emergencyActive && (
            <span className="flex items-center gap-1.5 animate-emergency-strobe rounded border border-red-500/50 bg-red-500/15 px-2 py-1 font-mono text-[9px] font-bold tracking-widest text-red-300">
              <AlertTriangle size={11} /> EMERGENCY MODE
            </span>
          )}

          {/* WS link status */}
          <span className="hidden items-center gap-1.5 font-mono text-[9px] tracking-widest text-slate-400 sm:flex">
            {wsConnected ? (
              <>
                <Wifi size={12} className="text-emerald-400" /> LINK LIVE
              </>
            ) : (
              <>
                <WifiOff size={12} className="text-red-400" /> LINK OFFLINE
              </>
            )}
          </span>

          {/* UTC clock */}
          <span className="hidden font-mono text-[10px] tracking-widest text-slate-400 md:block">
            {utcNow.toISOString().slice(11, 19)} UTC
          </span>

          {/* Station quick-switcher */}
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 font-mono text-[10px] tracking-widest text-slate-200 transition-colors hover:border-cyan-400/40"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-status-ring" />
              {stationName}
              <ChevronDown size={12} className={clsx('transition-transform', switcherOpen && 'rotate-180')} />
            </button>
            {switcherOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-lg border border-slate-600/60 bg-polar-navy shadow-xl">
                {stations.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedStationId(s.id);
                      setSwitcherOpen(false);
                    }}
                    className={clsx(
                      'flex w-full items-center justify-between px-4 py-2.5 font-mono text-[10px] tracking-widest transition-colors',
                      s.id === selectedStationId
                        ? 'bg-cyan-400/10 text-cyan-300'
                        : 'text-slate-300 hover:bg-slate-700/40'
                    )}
                  >
                    {s.name.toUpperCase()}
                    {s.id === selectedStationId && <span className="text-[9px]">ACTIVE</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Operator identity */}
          <div className="hidden text-right xl:block">
            <p className="font-mono text-[10px] tracking-wider text-slate-200">Operator_Demo</p>
            <p className="font-mono text-[8px] tracking-[0.25em] text-slate-500">ROLE: CMD_AUTHORIZER</p>
          </div>
        </div>
      </div>
    </header>
  );
}
