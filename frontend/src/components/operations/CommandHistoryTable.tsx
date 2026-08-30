import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { History, CircleDot } from 'lucide-react';
import { getOperationsHistory } from '../../api/operations';

interface Props {
  stationId: number | string;
  limit?: number;
  className?: string;
  tableScrollClassName?: string;
  fullHeight?: boolean;
}

const resultTone = (result: string) =>
  clsx(
    'rounded px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest',
    result === 'SUCCESS' || result === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-600'
      : result === 'REJECTED' || result === 'FAILED'
        ? 'bg-red-100 text-red-600'
        : 'bg-amber-100 text-amber-600'
  );

/**
 * Live immutable operator command audit trail.
 * Streams from GET /stations/{id}/operations/history; refreshed by the
 * WebSocket COMMAND_COMPLETED event invalidation.
 */
export default function CommandHistoryTable({
  stationId,
  limit = 50,
  className,
  tableScrollClassName,
  fullHeight = false,
}: Props) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['operations-history', stationId],
    queryFn: () => getOperationsHistory(stationId, limit),
    refetchInterval: 20000,
  });

  return (
    <div className={clsx('glass-panel flex flex-col rounded-xl', className)}>
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <History size={15} className="text-cyan-600" />
        <h3 className="font-mono text-xs font-bold tracking-[0.35em] text-slate-700">
          OPERATOR AUDIT TRAIL
        </h3>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] tracking-widest text-slate-500">
          <CircleDot size={10} className="text-emerald-600" /> IMMUTABLE · APPEND ONLY
        </span>
      </div>

      <div
        data-lenis-prevent
        className={clsx(
          'custom-scrollbar overflow-auto',
          fullHeight ? 'max-h-none' : 'max-h-[520px]',
          tableScrollClassName
        )}
      >
        {isLoading && (
          <p className="p-6 text-center font-mono text-[10px] tracking-widest text-slate-500">
            LOADING_AUDIT_LEDGER...
          </p>
        )}
        {!isLoading && (history?.length ?? 0) === 0 && (
          <p className="p-6 text-center font-mono text-[10px] tracking-widest text-slate-600">
            NO OPERATIONS RECORDED YET — EXECUTE A COMMAND TO POPULATE THE TRAIL
          </p>
        )}
        {(history?.length ?? 0) > 0 && (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
              <tr className="border-b border-slate-200 font-mono text-[9px] tracking-[0.25em] text-slate-500">
                <th className="px-3 py-2 font-medium">TIMESTAMP</th>
                <th className="px-3 py-2 font-medium">OPERATOR</th>
                <th className="px-3 py-2 font-medium">COMMAND</th>
                <th className="px-3 py-2 font-medium">TARGET</th>
                <th className="px-3 py-2 font-medium">RESULT</th>
              </tr>
            </thead>
            <tbody>
              {history?.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-slate-200 transition-colors hover:bg-slate-100/30"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] tabular-nums text-slate-500">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                    <span className="ml-1.5 text-slate-600">{new Date(entry.timestamp).toLocaleDateString()}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">{entry.actor}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[11px] font-bold tracking-wide text-cyan-600">
                      {entry.action}
                    </span>
                  </td>
                  <td className="max-w-40 truncate px-3 py-2.5 font-mono text-[11px] text-slate-500" title={entry.target}>
                    {entry.target}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={resultTone(entry.result)}>{entry.result}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
