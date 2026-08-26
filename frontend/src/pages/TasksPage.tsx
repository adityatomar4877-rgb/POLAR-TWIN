import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import clsx from 'clsx';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import { getMaintenanceTasks, completeMaintenanceTask } from '../api/maintenance';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';

const PRIORITY_TONE: Record<string, string> = {
  CRITICAL: 'bg-red-50 text-red-600 border border-red-200',
  HIGH: 'bg-amber-50 text-amber-600 border border-amber-200',
  MEDIUM: 'bg-blue-50 text-blue-600 border border-blue-200',
  LOW: 'bg-slate-100 text-slate-500 border border-slate-200',
};

export const TasksPage = ({ stationId }: { stationId: number }) => {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['maintenance', stationId],
    queryFn: () => getMaintenanceTasks(stationId),
    refetchInterval: 20000,
  });

  const complete = useMutation({
    mutationFn: (taskId: number) => completeMaintenanceTask(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', stationId] }),
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-task-item',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power2.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

  const open = (tasks ?? []).filter((t) => t.status !== 'COMPLETED');
  const done = (tasks ?? []).filter((t) => t.status === 'COMPLETED');

  return (
    <div ref={containerRef} className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="gsap-task-item flex items-center gap-3">
        <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600 shadow-xs ring-1 ring-emerald-200">
          <ClipboardList size={20} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Maintenance & Work Orders</h1>
          <p className="text-sm text-slate-400">
            <GSAPNumberTicker value={open.length} decimals={0} /> active operational task{open.length === 1 ? '' : 's'} assigned to station crew.
          </p>
        </div>
      </div>

      <div className="gsap-task-item rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading && <p className="p-6 text-center text-sm text-slate-400">Loading tasks...</p>}
        {!isLoading && (tasks ?? []).length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">
            No tasks recorded. Create maintenance tasks from the Infrastructure workspace.
          </p>
        )}
        <div className="divide-y divide-slate-100">
          {[...open, ...done].map((task) => (
            <div key={task.id} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50">
              <span className={clsx('rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider', PRIORITY_TONE[task.priority] ?? 'bg-slate-100 text-slate-500')}>
                {task.priority}
              </span>
              <div className="min-w-0 flex-1">
                <p className={clsx('truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-blue-600', task.status === 'COMPLETED' && 'text-slate-400 line-through')}>
                  {task.title}
                </p>
                {task.description && <p className="truncate text-xs text-slate-400">{task.description}</p>}
              </div>
              {task.equipment_id != null && (
                <span className="hidden font-mono text-[11px] text-slate-400 sm:block">ASSET #{task.equipment_id}</span>
              )}
              {task.status === 'COMPLETED' ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 size={13} /> Completed
                </span>
              ) : (
                <button
                  onClick={() => complete.mutate(task.id)}
                  disabled={complete.isPending}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-xs transition-all hover:bg-emerald-100 hover:shadow-sm disabled:opacity-50"
                >
                  {complete.isPending && complete.variables === task.id ? 'Closing...' : 'Mark Complete'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TasksPage;

