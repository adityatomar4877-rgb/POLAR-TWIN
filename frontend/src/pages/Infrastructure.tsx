import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import clsx from 'clsx';
import { Cpu, Activity, Plus, CheckCircle2, Wrench, Sparkles } from 'lucide-react';
import { getStationEquipment } from '../api/stations';
import { getMaintenanceTasks, createMaintenanceTask, completeMaintenanceTask } from '../api/maintenance';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';
import GSAPFlipDetailModal, { type DetailCardData } from '../components/dashboard/GSAPFlipDetailModal';
import type { MaintenanceTaskCreate } from '../api/types';

const PRIORITY_TONE: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-600',
  HIGH: 'bg-amber-100 text-amber-600',
  MEDIUM: 'bg-cyan-100 text-cyan-600',
  LOW: 'bg-slate-100 text-slate-600',
};

export const Infrastructure = ({ stationId }: { stationId: number }) => {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<DetailCardData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment', stationId],
    queryFn: () => getStationEquipment(stationId),
  });

  const { data: tasks } = useQuery({
    queryKey: ['maintenance', stationId],
    queryFn: () => getMaintenanceTasks(stationId),
    refetchInterval: 20000,
  });

  const completeMutation = useMutation({
    mutationFn: (taskId: number) => completeMaintenanceTask(taskId),
    onSuccess: () => {
      ['maintenance', 'dashboard', 'recommendations'].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key, stationId] })
      );
      qc.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-infra-item',
        { y: 24, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.06,
          ease: 'power3.out',
          clearProps: 'scale',
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

  if (isLoading || !equipment) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  const openTasks = (tasks ?? []).filter((t) => t.status !== 'COMPLETED');
  const doneTasks = (tasks ?? []).filter((t) => t.status === 'COMPLETED');

  const inspectEquipment = (eq: any) => {
    const faulted = eq.status === 'WARNING' || eq.status === 'CRITICAL' || eq.status === 'OFFLINE' || eq.status === 'FAILED';
    const runtime = Math.round(eq.runtime_hours ?? 1420);

    setDetailItem({
      type: 'equipment',
      title: eq.name,
      subtitle: `Asset ID #${eq.id} · Type: ${eq.equipment_type || 'STATION_SUBSYSTEM'}`,
      category: eq.is_critical ? 'TIER-1 CRITICAL ASSET' : 'STANDARD SUBSYSTEM',
      status: faulted ? 'WARNING' : 'RUNNING',
      healthScore: Math.round(eq.health_score ?? 90),
      primaryValue: Math.round(eq.health_score ?? 90),
      primaryUnit: '%',
      primaryLabel: 'HEALTH SCORE',
      secondaryValue: `${runtime} hrs`,
      secondaryLabel: 'OPERATING RUNTIME',
      metrics: [
        { label: 'STATUS', value: eq.status || 'ONLINE' },
        { label: 'CRITICAL TIER', value: eq.is_critical ? 'TIER-1' : 'TIER-2' },
        { label: 'VIBRATION', value: 'N/A' },
        { label: 'OPERATING TEMP', value: eq.temperature != null ? `${eq.temperature} °C` : 'N/A' },
        { label: 'POWER DRAW', value: 'N/A' },
        { label: 'CALIBRATION', value: 'N/A' },
      ],
      specs: [
        { key: 'MANUFACTURER', value: 'PolarTech Subsystems' },
        { key: 'MODEL NUMBER', value: `PT-${eq.equipment_type?.slice(0, 4) || 'GEN'}-X` },
        { key: 'LOCATION', value: 'Module Core' },
        { key: 'RATED LIFETIME', value: '50,000 Hrs' },
        { key: 'SAFETY FACTOR', value: '3.5x Cold-Tolerance' },
      ],
      diagnosticCodes: [
        faulted ? 'DTC-41: ANOMALY FLAGGED' : 'DTC-00: SYSTEM NOMINAL',
        `MODBUS_NODE: 0x${eq.id.toString(16).toUpperCase()}`,
        'TELEMETRY_RATE: 1000ms',
      ],
      recommendedAction: faulted
        ? 'Condition anomaly detected. Schedule preventative maintenance inspection.'
        : 'System operating within nominal parameters.',
      lastServiceDate: eq.last_maintenance || 'N/A',
      actions: [
        {
          label: 'SCHEDULE WORK ORDER',
          actionName: 'OPEN_TASK_MODAL',
          tone: 'primary',
        },
      ],
    });
  };

  return (
    <div ref={containerRef} className="custom-scrollbar mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-auto pb-10 pr-2">
      <div className="gsap-infra-item flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-widest text-slate-800">
            <Cpu className="h-6 w-6 text-cyan-600" />
            INFRASTRUCTURE_REGISTRY
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Status of critical life-support, power subsystems, and research station assets. Click any equipment card to inspect 3D Flip Diagnostics.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-100 px-4 py-2 font-mono text-xs tracking-widest text-cyan-700 shadow-xs transition-all hover:bg-cyan-200 hover:shadow-sm cursor-pointer"
        >
          <Plus size={14} /> NEW MAINTENANCE TASK
        </button>
      </div>

      {/* Equipment health grid (Clickable with 3D Flip Card Popup) */}
      <div className="gsap-infra-item grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {equipment.map((eq) => {
          const faulted = eq.status === 'WARNING' || eq.status === 'CRITICAL' || eq.status === 'OFFLINE' || eq.status === 'FAILED';
          return (
            <button
              key={eq.id}
              onClick={() => inspectEquipment(eq)}
              className={clsx(
                'group relative text-left flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer',
                faulted ? 'border-red-200 bg-red-50/[0.15] hover:border-red-400' : 'border-slate-200 bg-white hover:border-cyan-400'
              )}
            >
              {faulted && (
                <span className="absolute right-4 top-4 h-2.5 w-2.5 animate-ping rounded-full bg-red-400" />
              )}
              <div>
                <div className="mb-2 flex items-start justify-between">
                  <span className="font-mono text-xs text-cyan-600 font-semibold">
                    #{eq.id} • {eq.equipment_type}
                  </span>
                  <span
                    className={clsx(
                      'rounded-md px-2 py-0.5 font-mono text-[11px] font-bold',
                      eq.status === 'RUNNING' || eq.status === 'ONLINE'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-red-100 text-red-600'
                    )}
                  >
                    {eq.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-800 transition-colors group-hover:text-cyan-700">{eq.name}</h3>
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] text-slate-400 font-semibold">HEALTH_INDEX</span>
                  <span className={clsx('font-mono text-xl font-extrabold', eq.health_score < 50 ? 'text-red-600' : 'text-emerald-600')}>
                    <GSAPNumberTicker value={eq.health_score} decimals={0} suffix="%" />
                  </span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="block font-mono text-[10px] text-slate-400 font-semibold">CRITICAL_TIER</span>
                  <span className="font-mono text-xs text-slate-600 font-bold">{eq.is_critical ? 'TIER-1 CRITICAL' : 'STANDARD'}</span>
                  <span className="font-mono text-[9px] text-cyan-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex items-center gap-1">
                    <Sparkles size={9} /> 3D FLIP
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Maintenance board */}
      <div className="gsap-infra-item rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 font-mono text-xs font-bold tracking-[0.35em] text-slate-600">
          <Wrench size={14} className="text-amber-600" /> MAINTENANCE BOARD ({openTasks.length} OPEN)
        </h3>

        {(tasks?.length ?? 0) === 0 && (
          <p className="py-4 text-center font-mono text-[10px] tracking-widest text-slate-600">
            NO_MAINTENANCE_TASKS_RECORDED
          </p>
        )}

        <div className="space-y-2.5">
          {[...openTasks, ...doneTasks].map((task) => (
            <div
              key={task.id}
              className={clsx(
                'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-3',
                task.status === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50 opacity-70'
                  : task.priority === 'CRITICAL'
                    ? 'border-red-200 bg-red-50'
                    : 'border-slate-200 bg-slate-50'
              )}
            >
              <span className={`rounded px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest ${PRIORITY_TONE[task.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                {task.priority}
              </span>
              <div className="min-w-0 flex-1">
                <p className={clsx('truncate text-sm font-semibold text-slate-800', task.status === 'COMPLETED' && 'line-through')}>
                  {task.title}
                </p>
                {task.description && <p className="truncate text-xs text-slate-500">{task.description}</p>}
              </div>
              <span className="font-mono text-[10px] tracking-wider text-slate-500">
                {task.equipment_id != null && `ASSET #${task.equipment_id} · `}
                VIA {task.recommended_by}
              </span>
              <span className={clsx('font-mono text-[10px] tracking-widest', task.status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-600')}>
                {task.status}
              </span>
              {task.status !== 'COMPLETED' && (
                <button
                  onClick={() => completeMutation.mutate(task.id)}
                  disabled={completeMutation.isPending}
                  className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-mono text-[9px] font-bold tracking-widest text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                >
                  <CheckCircle2 size={11} />
                  {completeMutation.isPending && completeMutation.variables === task.id ? 'CLOSING...' : 'MARK COMPLETE'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <CreateTaskModal
          equipment={equipment}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            ['maintenance', 'dashboard'].forEach((key) => qc.invalidateQueries({ queryKey: [key, stationId] }));
            qc.invalidateQueries({ queryKey: ['maintenance'] });
          }}
          onSubmit={(payload) => createMaintenanceTask(stationId, payload)}
        />
      )}

      {/* GSAP 3D Flip Card Popup */}
      <GSAPFlipDetailModal
        data={detailItem}
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        onAction={(actionName) => {
          if (actionName === 'OPEN_TASK_MODAL') {
            setDetailItem(null);
            setModalOpen(true);
          }
        }}
      />
    </div>
  );
};

/* ---------------- Create maintenance modal ---------------- */

function CreateTaskModal({
  equipment,
  onClose,
  onCreated,
  onSubmit,
}: {
  equipment: Array<{ id: number; name: string }>;
  onClose: () => void;
  onCreated: () => void;
  onSubmit: (payload: MaintenanceTaskCreate) => Promise<unknown>;
}) {
  const [form, setForm] = useState<MaintenanceTaskCreate>({
    title: '',
    description: '',
    priority: 'MEDIUM',
    equipment_id: undefined,
    recommended_by: 'Operator_Action',
  });
  const [error, setError] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!form.title.trim()) throw new Error('Title required');
      return onSubmit(form);
    },
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: () => setError(true),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 p-4 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-md rounded-xl p-6">
        <h3 className="font-mono text-base font-bold tracking-[0.25em] text-slate-800">CREATE_MAINTENANCE_TASK</h3>
        <p className="mt-1 font-mono text-[10px] tracking-widest text-slate-500">WORK ORDER DISPATCH · STATION ENGINEERING</p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">TITLE</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Replace Generator 1 fuel filter"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 placeholder:text-slate-600 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">DESCRIPTION</span>
            <textarea
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-cyan-300"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">TARGET ASSET</span>
              <select
                value={form.equipment_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, equipment_id: e.target.value ? Number(e.target.value) : undefined })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-cyan-300"
              >
                <option value="">— GENERAL —</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    #{eq.id} {eq.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">PRIORITY</span>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-cyan-300"
              >
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && <p className="mt-3 font-mono text-xs text-red-600">TITLE REQUIRED / SUBMISSION FAILED</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 font-mono text-sm text-slate-500 transition-colors hover:text-slate-700">
            CANCEL
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-cyan-600 px-6 py-2 font-mono text-sm text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
          >
            {mutation.isPending ? 'DISPATCHING...' : 'CREATE_TASK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Infrastructure;
