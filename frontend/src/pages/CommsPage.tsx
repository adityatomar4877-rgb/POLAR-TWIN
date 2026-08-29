import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useStation } from '../context/StationContext';
import {
  Wifi,
  WifiOff,
  Antenna,
  Server,
  Clock,
  ShieldCheck,
  Satellite,
  Radio,
  RadioTower,
  Network,
  Gauge,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';
import GSAPSatelliteRadar from '../components/dashboard/GSAPSatelliteRadar';

interface CommsLink {
  id: string;
  icon: typeof Satellite;
  label: string;
  system: string;
  band: string;
  down: string;
  up: string;
  ber: string;
  status: 'ONLINE' | 'STANDBY' | 'DEGRADED';
  tone: string;
  ring: string;
}

const LINKS: CommsLink[] = [
  {
    id: 'gsat',
    icon: Satellite,
    label: 'ISRO GSAT-30 / GSAT-7A',
    system: 'Primary Ku-Band Broadband Uplink',
    band: 'Ku-Band · 14.5 GHz',
    down: '10.0 Mbps',
    up: '4.0 Mbps',
    ber: '< 10⁻⁷',
    status: 'ONLINE',
    tone: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    ring: 'hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/20',
  },
  {
    id: 'iridium',
    icon: RadioTower,
    label: 'Iridium NEXT Constellation',
    system: 'Polar LEO Failover Mesh',
    band: 'L-Band · 1.6 GHz',
    down: '256 kbps',
    up: '256 kbps',
    ber: '< 10⁻⁵',
    status: 'STANDBY',
    tone: 'bg-amber-50 text-amber-600 border-amber-200',
    ring: 'hover:border-amber-400 hover:ring-2 hover:ring-amber-400/20',
  },
  {
    id: 'hf',
    icon: Radio,
    label: 'HF / VHF Expedition Radios',
    system: 'Long-Range Field & Marine Distress',
    band: '4.2 MHz / 8.4 MHz',
    down: 'Voice / 9.6 kbps',
    up: 'Voice / 9.6 kbps',
    ber: '—',
    status: 'ONLINE',
    tone: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    ring: 'hover:border-cyan-400 hover:ring-2 hover:ring-cyan-400/20',
  },
  {
    id: 'scada',
    icon: Network,
    label: 'SCADA Optical Ring',
    system: 'Inter-Station Direct Relay (Maitri ↔ Bharati)',
    band: 'Single-Mode Fiber · 1 Gbps',
    down: '1.0 Gbps',
    up: '1.0 Gbps',
    ber: '< 10⁻¹²',
    status: 'ONLINE',
    tone: 'bg-violet-50 text-violet-600 border-violet-200',
    ring: 'hover:border-violet-400 hover:ring-2 hover:ring-violet-400/20',
  },
];

const STATUS_DOT: Record<CommsLink['status'], string> = {
  ONLINE: 'bg-emerald-500',
  STANDBY: 'bg-amber-500',
  DEGRADED: 'bg-red-500',
};

export const CommsPage = () => {
  const { wsConnected, lastSyncAt, dashboard, selectedStation } = useStation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ping, setPing] = useState(38);
  const [azimuth, setAzimuth] = useState(342);
  const [elevation, setElevation] = useState(14.8);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-comms-item',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' },
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  /* Live ping + dish servo telemetry (client-side, frontend-only) */
  useEffect(() => {
    const id = setInterval(() => {
      setPing((p) => Math.max(34, Math.min(52, p + (Math.random() - 0.5) * 4)));
      setAzimuth((a) => {
        const next = a + (Math.random() - 0.5) * 0.4;
        return next > 344 ? 340 : next < 340 ? 344 : next;
      });
      setElevation((e) => Math.max(13.5, Math.min(16, e + (Math.random() - 0.5) * 0.15)));
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const dataSource = dashboard?.environment?.source ?? 'UNKNOWN';
  const simulated = dashboard?.environment?.is_simulated ?? false;

  return (
    <div ref={containerRef} className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="gsap-comms-item flex items-center gap-3">
        <span className="rounded-xl bg-cyan-100 p-2.5 text-cyan-600">
          <Wifi size={20} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Polar Communications Center</h1>
          <p className="text-sm text-slate-400">
            Antarctic telemetry uplink, satellite broadband, and expedition radio relay.
          </p>
        </div>
      </div>

      {/* GSAP Animated Satellite Radar & Uplink Visualizer */}
      <div className="gsap-comms-item">
        <GSAPSatelliteRadar connected={wsConnected} pingMs={Math.round(ping)} />
      </div>

      {/* Dish servo orientation + live ping monitor */}
      <div className="gsap-comms-item grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Gauge size={15} className="text-cyan-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Dish Azimuth</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-slate-900">
            {azimuth.toFixed(1)}°
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-cyan-500 transition-all duration-700" style={{ width: `${(azimuth / 360) * 100}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Gauge size={15} className="text-emerald-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Dish Elevation</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-slate-900">
            {elevation.toFixed(1)}°
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${(elevation / 90) * 100}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Activity size={15} className={ping < 45 ? 'text-emerald-600' : 'text-amber-600'} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Live Ping</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-slate-900">
            {Math.round(ping)} <span className="text-sm font-semibold text-slate-400">ms</span>
          </p>
          <p className="mt-2 text-[11px] font-medium text-slate-400">
            {ping < 45 ? 'Low-latency uplink nominal' : 'Latency elevated — tracking'}
          </p>
        </div>
      </div>

      {/* Communications link cards */}
      <div className="gsap-comms-item grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <div
              key={l.id}
              className={clsx(
                'group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md',
                l.ring,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={clsx('rounded-xl border p-3 transition-transform duration-300 group-hover:scale-110', l.tone)}>
                    <Icon size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{l.label}</p>
                    <p className="text-[11px] text-slate-400">{l.system}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  <span className={clsx('h-1.5 w-1.5 rounded-full', STATUS_DOT[l.status])} />
                  {l.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 font-mono text-[11px]">
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400">Band</span>
                  <span className="font-bold text-slate-700">{l.band}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400">Bit Error Rate</span>
                  <span className="font-bold text-slate-700">{l.ber}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400">Downlink</span>
                  <span className="font-bold text-emerald-600">{l.down}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400">Uplink</span>
                  <span className="font-bold text-cyan-600">{l.up}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Uplink status row */}
      <div className="gsap-comms-item grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          {
            icon: wsConnected ? Wifi : WifiOff,
            label: 'Telemetry Link',
            value: wsConnected ? 'WebSocket Live' : 'Reconnecting...',
            sub: `/ws/stations/${selectedStation?.id ?? '—'}`,
            tone: wsConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500',
          },
          {
            icon: Antenna,
            label: 'Signal Quality',
            value: wsConnected ? 'Stable' : 'Degraded',
            sub: `Ping ${Math.round(ping)} ms · 256 kbps failover`,
            tone: wsConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
          },
          {
            icon: Server,
            label: 'Data Source',
            value: dataSource.toUpperCase(),
            sub: simulated ? 'Simulated feed' : 'Live sensors',
            tone: 'bg-blue-50 text-blue-600',
          },
          {
            icon: Clock,
            label: 'Last Sync',
            value: lastSyncAt
              ? lastSyncAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
              : 'Awaiting',
            sub: 'IST · station time',
            tone: 'bg-slate-100 text-slate-600',
          },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <span className={clsx('rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110', c.tone)}>
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
                <p className="truncate text-base font-bold text-slate-900">{c.value}</p>
                <p className="truncate text-xs text-slate-400">{c.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="gsap-comms-item flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <ShieldCheck size={18} className="text-emerald-600" />
        <p className="text-sm font-medium text-emerald-700">
          Encrypted Iridium-backed uplink active. GSAT Ku-band primary online with optical SCADA failover. All command traffic is logged to the immutable audit trail.
        </p>
      </div>
    </div>
  );
};

export default CommsPage;
