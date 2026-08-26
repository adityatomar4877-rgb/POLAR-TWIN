import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, Info, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Alert } from '../../api/types';

const severityMeta = (severity: string) => {
  const s = severity.toUpperCase();
  if (s === 'CRITICAL')
    return { label: 'CRITICAL', icon: ShieldAlert, cls: 'text-red-600', chip: 'bg-red-50 text-red-600' };
  if (s === 'WARNING')
    return { label: 'MAJOR', icon: AlertTriangle, cls: 'text-amber-600', chip: 'bg-amber-50 text-amber-600' };
  return { label: 'MINOR', icon: Info, cls: 'text-slate-500', chip: 'bg-slate-100 text-slate-500' };
};

export default function ActiveAlertsPanel({ alerts }: { alerts: Alert[] }) {
  const navigate = useNavigate();
  const active = alerts.filter((a) => !a.resolved_at && a.is_active !== false).slice(0, 4);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900">Active Alerts</h2>
        <button
          onClick={() => navigate('/operations')}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
        >
          View All ({alerts.filter((a) => !a.resolved_at && a.is_active !== false).length})
          <ArrowUpRight size={12} />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {active.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl bg-emerald-50 px-4 py-5 text-center text-sm font-medium text-emerald-600 border border-emerald-200/50"
          >
            All clear — no active alerts
          </motion.p>
        )}
        <AnimatePresence initial={false}>
          {active.map((alert, idx) => {
            const meta = severityMeta(alert.severity);
            const Icon = meta.icon;
            return (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.25), ease: [0.22, 1, 0.36, 1] }}
                onClick={() => navigate('/operations')}
                className="group -mx-2 flex cursor-pointer gap-3 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-slate-200 hover:bg-slate-50/70"
              >
                <span className={clsx('mt-0.5 rounded-lg p-1.5 h-fit transition-transform duration-300 group-hover:scale-110', meta.chip)}>
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={clsx('text-[11px] font-bold tracking-wider', meta.cls)}>{meta.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {!alert.acknowledged && (
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600">
                          New
                        </span>
                      )}
                      <span className="text-[11px] tabular-nums text-slate-400">
                        {new Date(alert.created_at).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </span>
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {alert.title}
                  </p>
                  <p className="truncate text-xs text-slate-400">{alert.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
