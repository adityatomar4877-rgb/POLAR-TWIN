import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { MapPin, Bell, Settings, ChevronDown, Radio, Antenna } from 'lucide-react';
import { useStation } from '../../context/StationContext';

const STATION_META: Record<number, { region: string; elevation: string }> = {
  1: { region: 'Schirmacher Oasis, Queen Maud Land', elevation: '130 m' },
  2: { region: 'Larsemann Hills, East Antarctica', elevation: '32 m' },
};

const formatCoord = (lat: number, lon: number) => {
  const fmt = (v: number) => {
    const abs = Math.abs(v);
    const deg = Math.floor(abs);
    const min = Math.round((abs - deg) * 60);
    return `${deg}°${String(min).padStart(2, '0')}'`;
  };
  return `${fmt(lat)}${lat < 0 ? 'S' : 'N'}, ${fmt(lon)}${lon < 0 ? 'W' : 'E'}`;
};

const greeting = () => {
  const hourIST = Number(
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false })
  );
  if (hourIST < 12) return 'Good Morning';
  if (hourIST < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export default function TopBar() {
  const navigate = useNavigate();
  const { selectedStation, selectedStationId, dashboard, wsConnected } = useStation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const meta = STATION_META[selectedStationId] ?? STATION_META[2];
  const stationName = `${(selectedStation?.code ?? (selectedStationId === 1 ? 'MAITRI' : 'BHARATI')).toUpperCase()} STATION`;
  const activeAlerts = (dashboard?.alerts ?? []).filter((a) => !a.resolved_at && a.is_active !== false);

  const istTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
  const istDate = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 px-6 pt-5 lg:px-8">
      {/* Identity block */}
      <div>
        <p className="text-sm font-medium text-slate-500">{greeting()}, Operator</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-slate-900 lg:text-[34px]">
            {stationName}
          </h1>
          <span
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
              wsConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            )}
          >
            <Radio size={12} className={wsConnected ? 'text-emerald-500' : 'text-red-500'} />
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <MapPin size={13} className="text-slate-400" />
            {meta.region}
          </span>
          {selectedStation && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="text-slate-400" />
              {formatCoord(selectedStation.latitude, selectedStation.longitude)}
            </span>
          )}
          <span className="hidden items-center gap-2 md:flex">
            <span className="h-3.5 w-px bg-slate-200" />
            Elevation: {meta.elevation}
          </span>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* IST clock */}
        <div className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-right shadow-sm sm:block">
          <p className="font-mono text-lg font-bold leading-tight tabular-nums text-slate-900">{istTime}</p>
          <p className="text-[10px] text-slate-400">
            <span className="font-semibold text-slate-500">IST</span> · {istDate}
          </p>
        </div>

        {/* Operator card */}
        <button className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition-colors hover:border-slate-300">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 text-sm font-bold text-white">
            OP
          </span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-[13px] font-semibold text-slate-800">Operator</span>
            <span className="block text-[11px] text-slate-400">Research Team</span>
          </span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/operations')}
          title="Alerts & events"
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-700"
        >
          <Bell size={18} />
          {activeAlerts.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {activeAlerts.length}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          title="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-700"
        >
          <Settings size={18} />
        </button>

        {/* Link quality */}
        <div
          title="Telemetry link quality"
          className={clsx(
            'hidden h-11 w-11 items-center justify-center rounded-xl border shadow-sm xl:flex',
            wsConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-red-200 bg-red-50 text-red-500'
          )}
        >
          <Antenna size={18} />
        </div>
      </div>
    </header>
  );
}
