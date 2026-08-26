import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Flag, Users, Package, Wifi } from 'lucide-react';
import { getResupplyRequests } from '../../api/maintenance';
import { useStation } from '../../context/StationContext';

export default function StatusFooter() {
  const { dashboard, selectedStationId, wsConnected } = useStation();

  const { data: resupply } = useQuery({
    queryKey: ['resupply', selectedStationId],
    queryFn: () => getResupplyRequests(selectedStationId),
  });

  const pending = (resupply ?? []).filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
  const nextArrival = pending
    .map((r) => r.expected_arrival)
    .filter((d): d is string => !!d)
    .sort()[0];
  const daysOut = useMemo(
    () =>
      nextArrival
        ? Math.max(1, Math.round((new Date(nextArrival).getTime() - Date.now()) / 86400000))
        : 14,
    [nextArrival]
  );

  const population = dashboard?.station?.current_population ?? 18;

  const items = [
    { icon: Flag, label: 'Mission Status', value: 'Summer Campaign 2026', tone: 'text-slate-600' },
    { icon: Users, label: 'Personnel', value: `${population} On Station`, tone: 'text-slate-600' },
    { icon: Package, label: 'Next Resupply', value: `In ${daysOut} Days`, tone: 'text-slate-600' },
    {
      icon: Wifi,
      label: 'Communication',
      value: wsConnected ? 'Link Stable' : 'Link Degraded',
      tone: wsConnected ? 'text-emerald-600' : 'text-red-500',
    },
  ];

  return (
    <footer className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm lg:grid-cols-4">
      {items.map(({ icon: Icon, label, value, tone }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="rounded-lg bg-slate-100 p-2 text-slate-500">
            <Icon size={16} />
          </span>
          <div className="leading-tight">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={clsx('text-[13px] font-semibold', tone)}>{value}</p>
          </div>
        </div>
      ))}
    </footer>
  );
}
