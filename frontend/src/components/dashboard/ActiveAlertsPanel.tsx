import { ShieldAlert, AlertTriangle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { Alert } from '../../api/types';

const severityMeta = (severity: string) => {
  const s = severity.toUpperCase();
  if (s === 'CRITICAL')
    return { label: 'CRITICAL', icon: ShieldAlert, cls: 'text-red-700 font-extrabold', chip: 'text-red-600' };
  if (s === 'MAJOR' || s === 'WARNING')
    return { label: 'MAJOR', icon: AlertTriangle, cls: 'text-orange-700 font-extrabold', chip: 'text-orange-600' };
  return { label: 'MINOR', icon: AlertCircle, cls: 'text-amber-700 font-extrabold', chip: 'text-amber-600' };
};

export default function ActiveAlertsPanel({ alerts }: { alerts: Alert[] }) {
  const navigate = useNavigate();

  const displayAlerts = alerts.slice(0, 3).map((a, i) => ({
    id: a.id,
    severity: (a.severity?.toUpperCase() || (i === 0 ? 'CRITICAL' : i === 1 ? 'MAJOR' : 'MINOR')) as any,
    title: a.title,
    message: a.message,
    time: new Date(a.created_at).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  }));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
          ACTIVE ALERTS
        </h2>
        <button
          onClick={() => navigate('/operations')}
          className="text-[11px] font-semibold text-blue-500 transition-colors hover:text-blue-600 cursor-pointer"
        >
          View All ({displayAlerts.length})
        </button>
      </div>

      <div className="space-y-2 mt-3">
        {displayAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <ShieldAlert className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-[11px] font-extrabold tracking-widest text-slate-400">
              NO ACTIVE ALERTS
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {displayAlerts.map((alert, idx) => {
              const meta = severityMeta(alert.severity);
              const Icon = meta.icon;
              return (
                <motion.div
                  key={alert.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  onClick={() => navigate('/operations')}
                  className="group flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/40 p-2.5 transition-all hover:border-slate-300 hover:bg-white"
                >
                  <span className={clsx('mt-0.5 shrink-0', meta.chip)}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={clsx('text-[10px] tracking-wider uppercase', meta.cls)}>
                        {meta.label}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-slate-400">
                        {alert.time}
                      </span>
                    </div>
                    <p className="text-[12px] font-bold text-slate-800 leading-snug group-hover:text-blue-600 transition-colors mt-0.5">
                      {alert.title}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 font-medium">
                      {alert.message}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
