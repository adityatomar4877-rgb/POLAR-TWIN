import { useQuery } from '@tanstack/react-query';
import { getStationDashboard } from '../api/stations';
import { Package, Fuel, Utensils, Wrench, Activity, AlertCircle } from 'lucide-react';

export const Logistics = ({ stationId }: { stationId: number }) => {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const items = dashboard.logistics || [];

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto h-full overflow-auto pr-2 custom-scrollbar pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-slate-100 flex items-center gap-3">
            <Package className="w-6 h-6 text-purple-400" />
            SUPPLY_CHAIN_&_LOGISTICS
          </h1>
          <p className="text-slate-400 text-sm mt-1">Polar station consumable inventories, daily depletion rates, and resupply planning.</p>
        </div>
        <div className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-400">
          TRACKED_CATEGORIES: <span className="text-purple-400">FUEL • RATIONS • SPARES</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-500 font-mono">
          NO_LOGISTICS_RECORDS_AVAILABLE
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((item: any, i: number) => {
            const daysLeft = item.days_remaining ?? 90;
            const isLow = daysLeft < 30;

            return (
              <div key={item.id || i} className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-purple-400">{item.category || 'SUPPLY'}</span>
                    {isLow && (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/40">
                        <AlertCircle className="w-3 h-3" /> RESUPPLY_ALERT
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-200 text-lg">{item.name || item.item_name}</h3>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-mono">IN_STOCK</span>
                    <span className="text-xl font-bold font-mono text-slate-100">
                      {item.quantity?.toLocaleString() ?? 0} <span className="text-xs text-slate-500">{item.unit || 'units'}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-mono block">RUNWAY</span>
                    <span className={`text-lg font-bold font-mono ${daysLeft < 20 ? 'text-red-400' : daysLeft < 45 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {daysLeft.toFixed(0)} Days
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
