import { useQuery } from '@tanstack/react-query';
import { getStations } from '../../api/stations';
import { MapPin, User, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export const Header = ({ currentStationId }: { currentStationId: number }) => {
  const { data: stations } = useQuery({
    queryKey: ['stations'],
    queryFn: getStations,
  });

  const activeStation = stations?.find(s => s.id === currentStationId);
  const [utcTime, setUtcTime] = useState(new Date().toISOString().substring(11, 19));

  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toISOString().substring(11, 19));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm z-10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-md border border-slate-700/50">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-sm tracking-wide text-slate-200">
            {activeStation ? activeStation.name.toUpperCase() : 'LOADING...'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-mono font-bold tracking-widest">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          LIVE
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="hidden md:flex items-center gap-2 text-slate-400 font-mono text-sm">
          <Clock className="w-4 h-4" />
          <span>{utcTime} UTC</span>
        </div>
        
        <div className="w-px h-6 bg-slate-800 hidden md:block"></div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-slate-200">Operator_Demo</span>
            <span className="text-[10px] text-cyan-400 font-mono">ROLE: CMD_AUTHORIZER</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
};
