import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowUpRight, Zap, Home, Thermometer, Fuel, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getOperationsHistory } from '../../api/operations';

const prettify = (action: string) => {
  const cleaned = action.replaceAll('_', ' ').toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const iconFor = (action: string) => {
  const a = action.toUpperCase();
  if (a.includes('GENERATOR') || a.includes('ENERGY') || a.includes('POWER')) return Zap;
  if (a.includes('LOAD') || a.includes('HABITAT')) return Home;
  if (a.includes('HVAC') || a.includes('HEAT') || a.includes('COLD')) return Thermometer;
  if (a.includes('FUEL') || a.includes('RESUPPLY')) return Fuel;
  return Wrench;
};

export default function RecentAutomationsCard({ stationId }: { stationId: number }) {
  const navigate = useNavigate();
  const { data: history } = useQuery({
    queryKey: ['operations-history', stationId],
    queryFn: () => getOperationsHistory(stationId, 12),
    refetchInterval: 20000,
  });

  const rows = (history ?? []).slice(0, 4);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">
          Recent Automations
        </h2>
        <button
          onClick={() => navigate('/audit')}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
        >
          View All
          <ArrowUpRight size={12} />
        </button>
      </div>

      <div className="mt-3 divide-y divide-slate-100">
        {rows.length === 0 && (
          <p className="py-5 text-center text-xs text-slate-400">
            No operations recorded yet — actions will appear here live.
          </p>
        )}
        {rows.map((entry) => {
          const Icon = iconFor(entry.action);
          const automated = !entry.actor.toLowerCase().includes('operator');
          return (
            <div
              key={entry.id}
              onClick={() => navigate('/audit')}
              className="group flex cursor-pointer items-center gap-3 py-2.5 px-1.5 -mx-1.5 rounded-lg transition-colors hover:bg-slate-50"
            >
              <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-slate-400">
                {new Date(entry.timestamp).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </span>
              <span
                className={clsx(
                  'rounded-lg p-1.5 transition-transform duration-300 group-hover:scale-110',
                  entry.result === 'SUCCESS' || entry.result === 'COMPLETED'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-red-50 text-red-500'
                )}
              >
                <Icon size={13} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                {prettify(entry.action)}
              </span>
              <span
                className={clsx(
                  'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold',
                  automated ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                )}
              >
                {automated ? 'Automated' : 'Operator'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

