import { useStation } from '../context/StationContext';
import { Wifi, WifiOff, Antenna, Server, Clock, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

export const CommsPage = () => {
  const { wsConnected, lastSyncAt, dashboard, selectedStation } = useStation();

  const dataSource = dashboard?.environment?.data_source ?? 'UNKNOWN';
  const simulated = dashboard?.environment?.is_simulated ?? false;

  const cards = [
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
      sub: 'Ping < 45 ms',
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
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-cyan-100 p-2.5 text-cyan-600">
          <Wifi size={20} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Communications</h1>
          <p className="text-sm text-slate-400">Live telemetry link between station and operations center.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className={clsx('rounded-xl p-3', c.tone)}>
              <c.icon size={20} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
              <p className="text-lg font-bold text-slate-900">{c.value}</p>
              <p className="text-xs text-slate-400">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <ShieldCheck size={18} className="text-emerald-600" />
        <p className="text-sm font-medium text-emerald-700">
          Encrypted Iridium-backed uplink active. All command traffic is logged to the immutable audit trail.
        </p>
      </div>
    </div>
  );
};

export default CommsPage;
