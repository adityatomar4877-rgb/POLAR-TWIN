import { useQuery } from '@tanstack/react-query';
import { Zap, Building2, Flame, Fuel } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getOperationsHistory } from '../../api/operations';

interface DemoAutomation {
  id: number;
  time: string;
  icon: any;
  title: string;
  type: string;
}

const DEFAULT_AUTOMATIONS: DemoAutomation[] = [
  { id: 1, time: '16:41', icon: Zap, title: 'Generator Load Optimized', type: 'Automated' },
  { id: 2, time: '16:39', icon: Building2, title: 'Non-Critical Load Shed', type: 'Automated' },
  { id: 3, time: '16:37', icon: Flame, title: 'Heating System Adjusted', type: 'Automated' },
  { id: 4, time: '16:35', icon: Fuel, title: 'Fuel Conservation Mode', type: 'Automated' },
];

export default function RecentAutomationsCard({ stationId }: { stationId: number }) {
  const navigate = useNavigate();
  const { data: history } = useQuery({
    queryKey: ['operations-history', stationId],
    queryFn: () => getOperationsHistory(stationId, 4),
    refetchInterval: 20000,
  });

  const automations =
    history && history.length > 0
      ? history.slice(0, 4).map((h, i) => ({
          id: h.id,
          time: new Date(h.timestamp).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          icon: DEFAULT_AUTOMATIONS[i % DEFAULT_AUTOMATIONS.length].icon,
          title: h.action.replaceAll('_', ' '),
          type: 'Automated',
        }))
      : DEFAULT_AUTOMATIONS;

  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
          RECENT AUTOMATIONS
        </h2>
        <button
          onClick={() => navigate('/audit')}
          className="text-[11px] font-semibold text-blue-500 transition-colors hover:text-blue-600 cursor-pointer"
        >
          View All &gt;
        </button>
      </div>

      <div className="space-y-1 mt-1">
        {automations.map((entry) => {
          const Icon = entry.icon;
          return (
            <div
              key={entry.id}
              onClick={() => navigate('/audit')}
              className="group flex cursor-pointer items-center justify-between gap-3 py-1.5 px-1 rounded-lg transition-all hover:bg-slate-50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-[11px] font-semibold text-slate-400 tabular-nums w-10 shrink-0">
                  {entry.time}
                </span>
                <span className="text-slate-400 group-hover:text-blue-500 transition-colors">
                  <Icon size={13} />
                </span>
                <span className="text-[12px] font-medium text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                  {entry.title}
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-400 shrink-0">
                {entry.type}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
