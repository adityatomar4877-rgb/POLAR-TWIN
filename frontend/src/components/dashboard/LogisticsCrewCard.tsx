import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Truck, Users, Package } from 'lucide-react';
import { getResupplyRequests } from '../../api/maintenance';
import type { Station } from '../../api/types';

const priorityChip = (priority: string) => {
  const p = priority?.toUpperCase();
  if (p === 'CRITICAL') return 'bg-red-50 text-red-600';
  if (p === 'HIGH') return 'bg-amber-50 text-amber-600';
  if (p === 'MEDIUM') return 'bg-blue-50 text-blue-600';
  return 'bg-slate-100 text-slate-500';
};

export default function LogisticsCrewCard({ station }: { station: Station }) {
  const navigate = useNavigate();

  const { data: resupply } = useQuery({
    queryKey: ['resupply', station.id],
    queryFn: () => getResupplyRequests(station.id),
    refetchInterval: 60000,
  });

  const pending = (resupply ?? []).filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
  const nextArrivalDate = pending
    .map((r) => r.expected_arrival)
    .filter((d): d is string => !!d)
    .sort()[0];
  const daysOut = nextArrivalDate
    ? Math.max(0, Math.round((new Date(nextArrivalDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000))
    : null;

  const population = station.current_population ?? 0;
  const capacity = station.capacity ?? 0;
  const occupancy = capacity > 0 ? Math.min(100, Math.round((population / capacity) * 100)) : 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">Logistics & Crew</h2>
        <button
          onClick={() => navigate('/logistics')}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
        >
          View All
          <ArrowUpRight size={12} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Crew occupancy */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Users size={13} className="text-slate-400" />
              Crew On Station
            </span>
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                occupancy >= 95 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              )}
            >
              {occupancy}%
            </span>
          </div>
          <p className="mt-2 text-xl font-extrabold tabular-nums leading-none text-slate-900">
            {population}
            <span className="text-sm font-semibold text-slate-400"> / {capacity || '—'} berths</span>
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-700',
                occupancy >= 95 ? 'bg-red-500' : 'bg-emerald-500'
              )}
              style={{ width: `${occupancy}%` }}
            />
          </div>
        </div>

        {/* Next resupply */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <Truck size={13} className="text-slate-400" />
            Next Resupply
          </span>
          <p className="mt-2 text-xl font-extrabold tabular-nums leading-none text-slate-900">
            {daysOut === null ? 'TBD' : `${daysOut} days`}
            <span className="text-sm font-semibold text-slate-400"> out</span>
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-slate-400">
            {pending.length} pending request{pending.length === 1 ? '' : 's'}
            {nextArrivalDate
              ? ` · ETA ${new Date(nextArrivalDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
              : ''}
          </p>
        </div>
      </div>

      {/* Priority manifest */}
      <div className="mt-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Package size={11} />
          Priority Manifest
        </p>
        {pending.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-xs font-medium text-emerald-600">
            Manifest clear — no pending resupply requests
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {pending.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium capitalize text-slate-700">
                  {r.item.toLowerCase()}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                  ×{r.quantity} {r.unit ?? ''}
                </span>
                <span
                  className={clsx(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                    priorityChip(r.priority)
                  )}
                >
                  {r.priority}
                </span>
              </div>
            ))}
            {pending.length > 3 && (
              <button
                onClick={() => navigate('/logistics')}
                className="w-full pt-2 text-center text-[11px] font-semibold text-blue-600 hover:text-blue-700"
              >
                +{pending.length - 3} more in manifest
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
