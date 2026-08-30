import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Activity,
  ShieldCheck,
  User,
  Calendar,
  X,
} from 'lucide-react';
import { getStationDashboard } from '../api/stations';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';

interface WorkOrder {
  id: string;
  assetName: string;
  assetType: 'GENERATOR' | 'HVAC' | 'WATER' | 'ELECTRICAL' | 'COMMS';
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'ROUTINE';
  status: 'OPEN' | 'IN_PROGRESS' | 'SCHEDULED' | 'COMPLETED';
  assignedTechnician: string;
  dueDate: string;
  estimatedHours: number;
  sparesRequired: string;
}

export const MaintenancePage = ({ stationId }: { stationId: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Initial maintenance work orders
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([
    {
      id: 'WO-2026-081',
      assetName: 'Diesel Generator #1 (Primary)',
      assetType: 'GENERATOR',
      title: 'Injector Nozzle Cleaning & Valve Lash Check',
      description: 'Periodic 500-hour servicing. Check fuel atomization and adjust valve clearance to 0.35mm.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      assignedTechnician: 'Er. Rajesh Sharma (Lead Power Tech)',
      dueDate: 'Today (18:00 IST)',
      estimatedHours: 3.5,
      sparesRequired: 'Gasket Kit PT-GEN-G2, O-Rings, Filter 10μm',
    },
    {
      id: 'WO-2026-082',
      assetName: 'Katabatic Wind Turbine #2',
      assetType: 'ELECTRICAL',
      title: 'Blade Pitch Actuator Bearing Lubrication',
      description: 'Predictive vibration anomaly flagged. Apply low-temp cryogenic synthetic grease (AeroShell 22).',
      priority: 'CRITICAL',
      status: 'OPEN',
      assignedTechnician: 'V. Sundaram (Mechanical Specialist)',
      dueDate: 'Tomorrow',
      estimatedHours: 2.0,
      sparesRequired: 'AeroShell Grease, Lockwire, Seal Rings',
    },
    {
      id: 'WO-2026-083',
      assetName: 'Reverse Osmosis Desalination Unit',
      assetType: 'WATER',
      title: 'Pre-Filter Cartridge Replacement',
      description: 'Differential pressure reached 1.4 bar. Replace primary and secondary spun polypropylene filters.',
      priority: 'MEDIUM',
      status: 'SCHEDULED',
      assignedTechnician: 'Dr. Amitav Roy (Environmental Tech)',
      dueDate: '28-Feb-2026',
      estimatedHours: 1.5,
      sparesRequired: '5μm Filter Core (2x), O-Ring Silicone',
    },
    {
      id: 'WO-2026-084',
      assetName: 'Habitat Core HVAC Air Recirculator',
      assetType: 'HVAC',
      title: 'HEPA Filter Bank Replacement & Fan Dynamic Balancing',
      description: 'Annual deep clean and air duct sterilization. Replaced primary HEPA elements.',
      priority: 'ROUTINE',
      status: 'COMPLETED',
      assignedTechnician: 'Er. Rajesh Sharma',
      dueDate: 'Completed (24-Feb-2026)',
      estimatedHours: 4.0,
      sparesRequired: 'HEPA H14 Cartridge Bank (4x)',
    },
    {
      id: 'WO-2026-085',
      assetName: 'Satellite Earth Station Ku-Band Radome',
      assetType: 'COMMS',
      title: 'De-Icing Heating Element Continuity Check',
      description: 'Inspect heating element resistance and automatic thermostat trigger thresholds for storm season.',
      priority: 'MEDIUM',
      status: 'SCHEDULED',
      assignedTechnician: 'T. Nambiar (Comms Officer)',
      dueDate: '02-Mar-2026',
      estimatedHours: 1.0,
      sparesRequired: 'Thermal Paste, Multimeter Probe Kit',
    },
  ]);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-maint-item',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  const handleUpdateStatus = (id: string, nextStatus: WorkOrder['status']) => {
    setWorkOrders((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: nextStatus } : w))
    );
  };

  const handleCreateOrder = (newOrder: Omit<WorkOrder, 'id'>) => {
    const id = `WO-2026-${Math.floor(100 + Math.random() * 900)}`;
    setWorkOrders((prev) => [{ ...newOrder, id }, ...prev]);
    setModalOpen(false);
  };

  const filteredOrders =
    filterStatus === 'ALL'
      ? workOrders
      : workOrders.filter((w) => w.status === filterStatus);

  const openCount = workOrders.filter((w) => w.status === 'OPEN').length;
  const inProgressCount = workOrders.filter((w) => w.status === 'IN_PROGRESS').length;
  const criticalCount = workOrders.filter((w) => w.priority === 'CRITICAL' && w.status !== 'COMPLETED').length;

  const priorityColor = (p: string) => {
    switch (p) {
      case 'CRITICAL':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'OPEN':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div ref={containerRef} data-lenis-prevent className="custom-scrollbar mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-auto pb-12 pr-2">
      {/* Header */}
      <div className="gsap-maint-item flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-900">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-200">
              <Wrench className="h-6 w-6" />
            </div>
            Maintenance & Work Orders
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Equipment servicing schedules, active technician work orders, predictive maintenance alerts, and repair logs.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-mono text-xs font-bold tracking-wider text-white transition-all hover:bg-blue-700 cursor-pointer shadow-xs"
        >
          <Plus size={15} /> CREATE WORK ORDER
        </button>
      </div>

      {/* KPI Cards */}
      <div className="gsap-maint-item grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Open Work Orders</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
            <GSAPNumberTicker value={openCount + inProgressCount} decimals={0} />
          </p>
          <p className="text-xs text-slate-400 mt-1">{inProgressCount} in progress · {openCount} queued</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Critical Alerts</span>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-red-600 mt-2">
            <GSAPNumberTicker value={criticalCount} decimals={0} />
          </p>
          <p className="text-xs text-slate-400 mt-1">Requires immediate technician action</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Preventative MTBF</span>
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
            <GSAPNumberTicker value={1840} decimals={0} suffix=" hrs" />
          </p>
          <p className="text-xs text-emerald-600 mt-1 font-semibold">+12% vs last winter cycle</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Compliance Rate</span>
            <CheckCircle2 size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
            <GSAPNumberTicker value={96.4} decimals={1} suffix="%" />
          </p>
          <p className="text-xs text-slate-400 mt-1">Scheduled tasks closed on time</p>
        </div>
      </div>

      {/* Predictive AI Maintenance Alerts Strip */}
      <div className="gsap-maint-item rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-amber-950">
                Predictive AI Health Advisory: Katabatic Wind Turbine #2 Vibration Spike
              </h3>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/80 text-amber-900">
                AI CONFIDENCE 94%
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-1">
              FFT vibration analysis detected anomalous harmonic peak at 142 Hz (4.8 mm/s velocity). Recommended action:
              Inject low-temperature grease into pitch actuator bearings before next 60 km/h blizzard gust.
            </p>
          </div>
        </div>
      </div>

      {/* Work Orders Board */}
      <div className="gsap-logistics-item">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
              Active Station Work Orders ({filteredOrders.length})
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-semibold">
            {['ALL', 'OPEN', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === st
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Work Orders List */}
        <div className="space-y-3">
          {filteredOrders.map((wo) => (
            <div
              key={wo.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-slate-400">{wo.id}</span>
                    <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${priorityColor(wo.priority)}`}>
                      {wo.priority}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${statusBadge(wo.status)}`}>
                      {wo.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">{wo.title}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                    <span className="text-blue-600 font-bold">{wo.assetName}</span> · Est: {wo.estimatedHours}h
                  </p>
                </div>

                {/* Status action buttons */}
                <div className="flex items-center gap-2">
                  {wo.status === 'OPEN' && (
                    <button
                      onClick={() => handleUpdateStatus(wo.id, 'IN_PROGRESS')}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                    >
                      START WORK
                    </button>
                  )}
                  {wo.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => handleUpdateStatus(wo.id, 'COMPLETED')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 cursor-pointer"
                    >
                      MARK DONE ✓
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-600 my-3 leading-relaxed">{wo.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <User size={13} className="text-slate-400" />
                  <span>Assignee: <strong className="text-slate-700">{wo.assignedTechnician}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  <span>Target: <strong className="text-slate-700">{wo.dueDate}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Wrench size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">Spares: <strong className="text-slate-700">{wo.sparesRequired}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Work Order Modal */}
      {modalOpen && (
        <CreateWorkOrderModal
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreateOrder}
        />
      )}
    </div>
  );
};

/* ---------------- Create Work Order Modal ---------------- */

function CreateWorkOrderModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (order: Omit<WorkOrder, 'id'>) => void;
}) {
  const [assetName, setAssetName] = useState('Diesel Generator #1');
  const [assetType, setAssetType] = useState<WorkOrder['assetType']>('GENERATOR');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkOrder['priority']>('HIGH');
  const [assignedTechnician, setAssignedTechnician] = useState('Er. Rajesh Sharma');
  const [dueDate, setDueDate] = useState('28-Feb-2026');
  const [estimatedHours, setEstimatedHours] = useState(2.0);
  const [sparesRequired, setSparesRequired] = useState('Standard Tooling');

  const handleAssetChange = (name: string) => {
    setAssetName(name);
    if (name.includes('Generator')) setAssetType('GENERATOR');
    else if (name.includes('HVAC')) setAssetType('HVAC');
    else if (name.includes('Water') || name.includes('Osmosis')) setAssetType('WATER');
    else if (name.includes('Comms') || name.includes('Satellite')) setAssetType('COMMS');
    else setAssetType('ELECTRICAL');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    onSubmit({
      assetName,
      assetType,
      title,
      description: description || 'Routine maintenance work order.',
      priority,
      status: 'OPEN',
      assignedTechnician,
      dueDate,
      estimatedHours,
      sparesRequired,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Dispatch New Work Order</h3>
            <p className="text-xs text-slate-400">Assign maintenance task to station technical crew.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Target Asset</label>
              <select
                value={assetName}
                onChange={(e) => handleAssetChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white outline-none focus:border-blue-500"
              >
                <option>Diesel Generator #1 (Primary)</option>
                <option>Diesel Generator #2 (Secondary)</option>
                <option>Katabatic Wind Turbine Array</option>
                <option>Bifacial Solar PV Array</option>
                <option>Reverse Osmosis Water Desalination</option>
                <option>Habitat HVAC Air Recirculator</option>
                <option>Satellite Earth Station Ku-Band</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white outline-none focus:border-blue-500"
              >
                <option value="ROUTINE">Routine</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Task Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g., Fuel filter replacement & oil analysis"
              className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Task Details</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Engineering instructions and calibration standards..."
              className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Specialist</label>
              <input
                type="text"
                value={assignedTechnician}
                onChange={(e) => setAssignedTechnician(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Estimated Hours</label>
              <input
                type="number"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Target Due Date</label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="E.g., Tomorrow or 28-Feb-2026"
                className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Required Spares / Kits</label>
              <input
                type="text"
                value={sparesRequired}
                onChange={(e) => setSparesRequired(e.target.value)}
                placeholder="E.g., Gasket Kit, 5μm Filter Core"
                className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-500 cursor-pointer shadow-xs"
            >
              Dispatch Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MaintenancePage;
