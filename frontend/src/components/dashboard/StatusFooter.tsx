import { useNavigate } from 'react-router-dom';
import { Flag, Users, Package, Wifi, Ship } from 'lucide-react';
import { useStation } from '../../context/StationContext';

const SUMMER_CREW = 24;

export default function StatusFooter() {
  const navigate = useNavigate();
  const { dashboard, wsConnected } = useStation();
  const population = dashboard?.station ? SUMMER_CREW : 0;

  return (
    <footer className="relative flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white text-slate-700 px-6 py-3.5 shadow-xs border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center gap-8 text-xs font-medium z-10">
        {/* Mission Status */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-50 rounded-lg text-slate-500 border border-slate-200">
            <Flag size={14} />
          </div>
          <div>
            <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase block">MISSION STATUS</span>
            <span className="font-semibold text-slate-800">Summer Campaign 2026</span>
          </div>
        </div>

        {/* Personnel */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-50 rounded-lg text-slate-500 border border-slate-200">
            <Users size={14} />
          </div>
          <div>
            <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase block">PERSONNEL</span>
            <span className="font-semibold text-slate-800">{population} On Station</span>
          </div>
        </div>

        {/* Next Resupply */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-50 rounded-lg text-slate-500 border border-slate-200">
            <Package size={14} />
          </div>
          <div>
            <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase block">NEXT RESUPPLY</span>
            <span className="font-semibold text-slate-800">In 14 Days</span>
          </div>
        </div>

        {/* Communication */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-50 rounded-lg text-slate-500 border border-slate-200">
            <Wifi size={14} />
          </div>
          <div>
            <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase block">COMMUNICATION</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {wsConnected ? 'Link Stable' : 'Link Stable'}
            </span>
          </div>
        </div>
      </div>

      {/* Polar Research Vessel (Ship) on the right - Interactive button */}
      <button
        type="button"
        onClick={() => navigate('/resupply#vessel-route', { state: { scrollTo: 'vessel-route' } })}
        title="Open Logistics & View Active Resupply Pipeline & Vessel Route"
        className="group flex items-center gap-3 z-10 pr-2 rounded-xl p-1.5 transition-all hover:bg-blue-50/80 border border-transparent hover:border-blue-200 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <div className="relative flex items-center">
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 shadow-xs transition-transform group-hover:scale-105 group-hover:bg-blue-100 group-hover:text-blue-700">
            <Ship size={22} className="animate-pulse group-hover:animate-none" />
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-[11px] font-extrabold tracking-wider text-slate-800 group-hover:text-blue-900 transition-colors">
            R/V BHARATI
          </p>
          <p className="text-[9px] font-semibold text-blue-600 group-hover:text-blue-700 transition-colors flex items-center justify-end gap-1">
            <span>Polar Supply Icebreaker</span>
            <span className="text-[10px] transition-transform group-hover:translate-x-0.5">→</span>
          </p>
        </div>
      </button>
    </footer>
  );
}
