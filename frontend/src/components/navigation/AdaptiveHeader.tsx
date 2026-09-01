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
  { label: 'DIGITAL TWIN', target: 'scene-7' },
  { label: 'COMMAND', target: 'scene-10' },
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
  const [scrolled, setScrolled] = useState(mode !== 'mission');

  useEffect(() => {
    const t = setInterval(() => setUtcNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (mode !== 'mission') {
      setScrolled(true);
      return;
    }
    const handleScroll = () => {
      setScrolled(window.scrollY > 180);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mode]);

  const backendEmergency =
    dashboard?.energy?.grid_status?.toUpperCase() === 'EMERGENCY' ||
    dashboard?.energy?.grid_status?.toUpperCase() === 'CRITICAL';
  const emergencyActive = emergencyModeActive || backendEmergency;

  const stationName =
    stations.find((s) => s.id === selectedStationId)?.code?.toUpperCase() ??
    (selectedStationId === 1 ? 'MAITRI' : 'BHARATI');

  const links = mode === 'mission' ? MISSION_LINKS : OPS_LINKS;

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out',
        mode === 'mission' && !scrolled && 'opacity-0 pointer-events-none -translate-y-full',
        mode === 'mission'
          ? 'border-b border-slate-800/80 bg-[#05070A]/85 backdrop-blur-xl text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
          : 'border-b border-slate-200/80 bg-white/85 backdrop-blur-xl shadow-2xs text-slate-900'
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <Radio size={17} className="animate-pulse text-[#55D6FF]" />
          <span className={clsx("font-mono text-sm font-extrabold tracking-[0.25em]", mode === 'mission' ? 'text-[#F4F8FA]' : 'text-slate-900')}>
            POLAR<span className="text-[#55D6FF]">·</span>TWIN
          </span>
          <span
            className={clsx(
              'hidden rounded px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest sm:inline',
              mode === 'mission' ? 'bg-[#55D6FF]/10 text-[#55D6FF] border border-[#55D6FF]/30' : 'bg-blue-50 text-blue-700 border border-blue-200'
            )}
          >
            {mode === 'mission' ? 'MISSION BRIEF' : 'OPS AUTHORIZED'}
          </span>
        </div>

        {/* Navigation links */}
        <nav className="ml-6 hidden items-center gap-1.5 lg:flex">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={() => {
                if (mode === 'mission') onNavigateMission?.(l.target);
                else if (l.target.startsWith('/')) window.location.assign(l.target);
              }}
              className={clsx(
                "rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider transition-colors cursor-pointer",
                mode === 'mission' ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Emergency badge */}
          {emergencyActive && (
            <span className="flex items-center gap-1.5 animate-emergency-strobe rounded-lg border border-red-500/40 bg-red-950/50 px-2.5 py-1 font-mono text-[9px] font-bold tracking-widest text-red-400">
              <AlertTriangle size={12} /> EMERGENCY MODE
            </span>
          )}

          {/* WS link status (operations mode only) */}
          {mode !== 'mission' && (
            <span className="hidden items-center gap-1.5 font-mono text-[10px] font-bold text-slate-400 sm:flex">
              {wsConnected ? (
                <>
                  <Wifi size={13} className="text-emerald-400" /> <span className="text-slate-700">LINK LIVE</span>
                </>
              ) : (
                <>
                  <WifiOff size={13} className="text-red-400" /> <span className="text-slate-700">LINK OFFLINE</span>
                </>
              )}
            </span>
          )}

          {/* UTC clock (operations mode only) */}
          {mode !== 'mission' && (
            <span className="hidden font-mono text-[11px] font-semibold md:block px-2.5 py-1 rounded-md border bg-slate-100 border-slate-200 text-slate-600">
              {utcNow.toISOString().slice(11, 19)} UTC
            </span>
          )}

          {/* Station quick-switcher (operations mode only) */}
          {mode !== 'mission' && (
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold shadow-xs transition-colors cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-cyan-400 hover:text-slate-900"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-status-ring" />
                {stationName}
                <ChevronDown size={13} className={clsx('transition-transform text-slate-400', switcherOpen && 'rotate-180')} />
              </button>
              {switcherOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border shadow-xl z-50 border-slate-200 bg-white text-slate-900">
                  {stations.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedStationId(s.id);
                        setSwitcherOpen(false);
                      }}
                      className={clsx(
                        'flex w-full items-center justify-between px-4 py-2.5 font-mono text-xs font-bold transition-colors cursor-pointer',
                        s.id === selectedStationId
                          ? 'bg-cyan-50 text-cyan-700 font-extrabold'
                          : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {s.name.toUpperCase()}
                      {s.id === selectedStationId && <span className="text-[10px] text-cyan-600">ACTIVE</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
