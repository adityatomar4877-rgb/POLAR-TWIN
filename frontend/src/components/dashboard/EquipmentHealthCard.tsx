import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, Cog } from 'lucide-react';
import type { Equipment } from '../../api/types';

const statusDot: Record<string, string> = {
  RUNNING: 'bg-emerald-500',
  ONLINE: 'bg-emerald-500',
  OPERATIONAL: 'bg-emerald-500',
  MAINTENANCE: 'bg-amber-500',
  FAILED: 'animate-pulse bg-red-500',
  FAULT: 'animate-pulse bg-red-500',
};

const healthBarColor = (score: number) =>
  score < 50 ? 'bg-red-500' : score < 75 ? 'bg-amber-500' : 'bg-emerald-500';

function daysUntil(iso?: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function EquipmentHealthCard({ equipment }: { equipment: Equipment[] }) {
  const navigate = useNavigate();

  const avgHealth =
    equipment.length > 0
      ? Math.round(equipment.reduce((s, e) => s + (e.health_score ?? 0), 0) / equipment.length)
      : 0;

  const avgHealthTone =
    avgHealth >= 80 ? 'text-emerald-600' : avgHealth >= 55 ? 'text-amber-600' : 'text-red-500';

  const counts = equipment.reduce(
    (acc, e) => {
      const s = (e.status ?? '').toUpperCase();
      if (['RUNNING', 'ONLINE', 'OPERATIONAL'].includes(s)) acc.running += 1;
      else if (s === 'MAINTENANCE') acc.maintenance += 1;
      else if (['FAILED', 'FAULT'].includes(s)) acc.failed += 1;
      else acc.other += 1;
      return acc;
    },
    { running: 0, maintenance: 0, failed: 0, other: 0 }
  );

  const watchlist = [...equipment].sort((a, b) => a.health_score - b.health_score).slice(0, 5);
  const remaining = equipment.length - watchlist.length;

  const summaryChips = [
    { label: `${counts.running} Running`, cls: 'bg-emerald-50 text-emerald-600', show: counts.running > 0 },
    { label: `${counts.maintenance} Service`, cls: 'bg-amber-50 text-amber-600', show: counts.maintenance > 0 },
    { label: `${counts.failed} Failed`, cls: 'bg-red-50 text-red-600', show: counts.failed > 0 },
    { label: `${counts.other} Standby`, cls: 'bg-slate-100 text-slate-500', show: counts.other > 0 },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">Equipment Health</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Lowest health index first · live condition monitoring ·{' '}
            <span className={clsx('font-bold tabular-nums', avgHealthTone)}>{avgHealth}% avg</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {summaryChips.filter((c) => c.show).map((c) => (
            <span key={c.label} className={clsx('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide', c.cls)}>
              {c.label}
            </span>
          ))}
          <button
            onClick={() => navigate('/infrastructure')}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            View All
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {watchlist.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            No equipment registered for this station yet.
          </p>
        )}
        {watchlist.map((eq) => {
          const due = daysUntil(eq.next_maintenance);
          return (
            <button
              key={eq.id}
              type="button"
              onClick={() => navigate('/infrastructure')}
              className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
              <span className={clsx('h-2 w-2 shrink-0 rounded-full', statusDot[(eq.status ?? '').toUpperCase()] ?? 'bg-slate-400')} />
              <span className="min-w-0 flex-[1.2]">
                <span className="block truncate text-[13px] font-semibold text-slate-800">{eq.name}</span>
                <span className="block truncate text-[11px] capitalize text-slate-400">
                  {(eq.equipment_type ?? '').toLowerCase().replaceAll('_', ' ')}
                  {eq.runtime_hours != null ? ` · ${Math.round(eq.runtime_hours)}h runtime` : ''}
                </span>
              </span>

              <span className="hidden min-w-0 flex-[1.4] items-center gap-2 sm:flex">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={clsx('block h-full rounded-full transition-all duration-700', healthBarColor(eq.health_score))}
                    style={{ width: `${Math.max(0, Math.min(100, eq.health_score))}%` }}
                  />
                </span>
              </span>

              <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums text-slate-700">
                {Math.round(eq.health_score)}%
              </span>

              <span
                className={clsx(
                  'hidden w-24 shrink-0 text-right text-[11px] font-semibold tabular-nums md:block',
                  due === null ? 'text-slate-300' : due < 0 ? 'text-red-500' : due <= 7 ? 'text-amber-600' : 'text-slate-400'
                )}
              >
                {due === null ? '—' : due < 0 ? `Overdue ${Math.abs(due)}d` : due === 0 ? 'Due today' : `Service ${due}d`}
              </span>

              <ChevronRight size={14} className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
            </button>
          );
        })}
      </div>

      {remaining > 0 && (
        <button
          onClick={() => navigate('/infrastructure')}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
        >
          <Cog size={12} />
          {remaining} more system{remaining === 1 ? '' : 's'} under monitoring
        </button>
      )}
    </section>
  );
}
