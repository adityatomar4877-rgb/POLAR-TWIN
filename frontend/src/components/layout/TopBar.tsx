import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Bell, Settings, ChevronDown, Globe } from 'lucide-react';
import { useStation } from '../../context/StationContext';

const STATION_META: Record<number, { name: string; region: string; coords: string; elevation: string }> = {
  1: { name: 'MAITRI STATION', region: 'Schirmacher Oasis, Queen Maud Land', coords: "70°46'S, 11°44'E", elevation: '130 m' },
  2: { name: 'BHARATI STATION', region: 'Larsemann Hills, East Antarctica', coords: "69°24'S, 76°12'E", elevation: '32 m' },
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
  const { stations, selectedStationId, setSelectedStationId, dashboard } = useStation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const meta = STATION_META[selectedStationId] ?? STATION_META[2];
  const activeAlerts = (dashboard?.alerts ?? []).filter((a) => !a.resolved_at && a.is_active !== false);

  const istTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
  const istDate = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="relative z-20 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl px-6 py-3.5 lg:px-8 text-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Identity block */}
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-400">
            {greeting()}, Operator
          </p>

          <div className="mt-0.5 flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={selectedStationId}
                onChange={(e) => setSelectedStationId(Number(e.target.value))}
                className="appearance-none bg-transparent text-[24px] font-black tracking-tight text-slate-900 lg:text-[26px] uppercase pr-8 outline-none cursor-pointer"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name.toUpperCase()}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400">
                <ChevronDown size={20} />
              </div>
            </div>

            <span className="flex items-center gap-1.5 rounded-md bg-blue-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              LIVE <span className="opacity-70">∿</span>
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <MapPin size={11} className="text-slate-400" />
              {meta.region}
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <Globe size={11} className="text-slate-400" />
              {meta.coords}
            </span>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          {/* IST clock */}
          <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
            <p className="font-mono text-sm font-bold leading-tight tabular-nums text-slate-800">
              {istTime} <span className="text-[10px] text-slate-400 font-semibold">IST</span>
            </p>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5">
              {istDate}
            </p>
          </div>

          {/* Operator card */}
          <button className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-3 shadow-xs transition-all hover:border-slate-300 cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xs font-black text-slate-700">
              👨‍🔬
            </div>
            <div className="hidden text-left leading-tight md:block">
              <span className="block text-xs font-semibold text-slate-700">Operator</span>
              <span className="block text-[10px] text-slate-400 font-medium">Research Team</span>
            </div>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {/* Notifications */}
          <button
            onClick={() => navigate('/operations')}
            title="Alerts & events"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            <Bell size={15} />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-white">
              {activeAlerts.length > 0 ? activeAlerts.length : 7}
            </span>
          </button>

          {/* Settings */}
          <button
            title="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
