import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import {
  Activity,
  AlertCircle,
  Plus,
  Ship,
  Fuel,
  Utensils,
  Droplets,
  Wrench,
  HeartPulse,
  FlaskConical,
  Warehouse,
  CheckCircle2,
} from 'lucide-react';
import { getStationDashboard } from '../api/stations';
import { getResupplyRequests, createResupplyRequest } from '../api/maintenance';
import { getFuelPrediction } from '../api/predictions';
import GSAPShipTransit from '../components/dashboard/GSAPShipTransit';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';
import GSAPFlipDetailModal, { type DetailCardData } from '../components/dashboard/GSAPFlipDetailModal';
import type { ResupplyRequestCreate } from '../api/types';

interface StationStockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  maxCapacity: number;
  unit: string;
  runwayDays: number;
  burnRatePerDay: number;
  storageBay: string;
  icon: typeof Fuel;
  color: string;
}

export const Logistics = ({ stationId }: { stationId: number }) => {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [detailItem, setDetailItem] = useState<DetailCardData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
  });

  const { data: resupplyRequests } = useQuery({
    queryKey: ['resupply', stationId],
    queryFn: () => getResupplyRequests(stationId),
    refetchInterval: 20000,
  });

  const { data: fuelForecast } = useQuery({
    queryKey: ['fuel-forecast', stationId],
    queryFn: () => getFuelPrediction(stationId),
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-logistics-item',
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

  if (isLoading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  // Stock remaining at the station across primary station consumables
  const stockItems: StationStockItem[] = [
    {
      id: 'stock-fuel',
      name: 'Arctic Low-Pour Diesel Fuel',
      category: 'ENERGY & HEATING',
      currentStock: Math.round(fuelForecast?.current_fuel_liters ?? 84200),
      maxCapacity: 120000,
      unit: 'Liters',
      runwayDays: Math.round(fuelForecast?.days_until_critical ?? 145),
      burnRatePerDay: 380,
      storageBay: 'Bunker Tanks 1-4 (Heated)',
      icon: Fuel,
      color: 'text-amber-500 bg-amber-50 border-amber-200',
    },
    {
      id: 'stock-rations',
      name: 'Freeze-Dried Polar Rations',
      category: 'FOOD & NUTRITION',
      currentStock: 4800,
      maxCapacity: 6000,
      unit: 'Meals',
      runwayDays: 192,
      burnRatePerDay: 25,
      storageBay: 'Habitat Module Storage Bay A',
      icon: Utensils,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      id: 'stock-water',
      name: 'Potable Meltwater Reserves',
      category: 'LIFE SUPPORT',
      currentStock: 32000,
      maxCapacity: 40000,
      unit: 'Liters',
      runwayDays: 160,
      burnRatePerDay: 200,
      storageBay: 'Meltwater Cistern Block B',
      icon: Droplets,
      color: 'text-blue-500 bg-blue-50 border-blue-200',
    },
    {
      id: 'stock-spares',
      name: 'Critical Mechanical Spares',
      category: 'INFRASTRUCTURE MAINTENANCE',
      currentStock: 340,
      maxCapacity: 450,
      unit: 'Components',
      runwayDays: 240,
      burnRatePerDay: 1.2,
      storageBay: 'Heavy Workshop Rack Sector 3',
      icon: Wrench,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      id: 'stock-medical',
      name: 'Emergency Trauma & Medical Kits',
      category: 'MEDICAL & HEALTH',
      currentStock: 85,
      maxCapacity: 100,
      unit: 'Complete Kits',
      runwayDays: 310,
      burnRatePerDay: 0.2,
      storageBay: 'Station Clinic Sickbay Vault',
      icon: HeartPulse,
      color: 'text-rose-500 bg-rose-50 border-rose-200',
    },
    {
      id: 'stock-science',
      name: 'Cryo Science Reagents & Nitrogen',
      category: 'RESEARCH CONSUMABLES',
      currentStock: 1250,
      maxCapacity: 1800,
      unit: 'Vials / Cylinders',
      runwayDays: 175,
      burnRatePerDay: 7,
      storageBay: 'Atmospheric Physics Lab Vault',
      icon: FlaskConical,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
  ];

  const handleInspectStock = (item: StationStockItem) => {
    const pct = Math.round((item.currentStock / item.maxCapacity) * 100);
    const isLow = item.runwayDays < 60;

    setDetailItem({
      type: 'supply',
      title: item.name,
      subtitle: `Station Warehouse Inventory · ${item.category}`,
      category: item.category,
      status: isLow ? 'WARNING' : 'ACTIVE',
      healthScore: pct,
      primaryValue: item.currentStock,
      primaryUnit: item.unit,
      primaryLabel: 'STOCK LEFT AT STATION',
      secondaryValue: `${pct}% CAPACITY`,
      secondaryLabel: 'CURRENT FILL RATIO',
      runwayDays: item.runwayDays,
      metrics: [
        { label: 'STOCK REMAINING', value: `${item.currentStock.toLocaleString()} ${item.unit}` },
        { label: 'MAX CAPACITY', value: `${item.maxCapacity.toLocaleString()} ${item.unit}` },
        { label: 'EST. RUNWAY', value: `${item.runwayDays} Days` },
        { label: 'DAILY DEPLETION', value: `~${item.burnRatePerDay} ${item.unit}/day` },
        { label: 'DEPOT LOCATION', value: item.storageBay },
        { label: 'INSPECTION STATUS', value: 'PASS' },
      ],
      specs: [
        { key: 'COMMODITY', value: item.name },
        { key: 'DEPOT BAY', value: item.storageBay },
        { key: 'REORDER THRESHOLD', value: `${Math.round(item.maxCapacity * 0.3)} ${item.unit}` },
        { key: 'MINIMUM SAFE RESERVE', value: '45 Days Buffer' },
      ],
      diagnosticCodes: [
        `INVENTORY_NODE: 0x${item.id.slice(0, 4).toUpperCase()}`,
        'BARCODE_AUDIT: VERIFIED',
      ],
      recommendedAction: isLow
        ? 'Stock runway under 60 days. Early requisition recommended for upcoming vessel transit.'
        : 'Stock level is healthy for station wintering crew operations.',
      lastServiceDate: '2026-06-15',
      actions: [
        {
          label: 'FILE RESUPPLY ORDER',
          actionName: 'OPEN_RESUPPLY_MODAL',
          tone: 'primary',
        },
      ],
    });
  };

  return (
    <div ref={containerRef} data-lenis-prevent className="custom-scrollbar mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-auto pb-12 pr-2">
      {/* Header */}
      <div className="gsap-logistics-item flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-900">
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600 border border-purple-100">
              <Warehouse className="h-6 w-6" />
            </div>
            Station Stock & Resupply Depot
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time on-site stock levels, consumable runway envelopes, depot bay tracking, and resupply voyages.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-purple-300 bg-purple-600 px-4 py-2.5 font-mono text-xs font-bold tracking-wider text-white transition-all hover:bg-purple-700 cursor-pointer shadow-xs"
        >
          <Plus size={15} /> NEW RESUPPLY REQUEST
        </button>
      </div>

      {/* Primary Highlights: Station Stock Remaining Grid */}
      <div className="gsap-logistics-item">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
              Current Stock Left at Station (On-Site Reserves)
            </h2>
            <p className="text-xs text-slate-500">Click any commodity to view full depot telemetry.</p>
          </div>
          <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5">
            <CheckCircle2 size={13} /> 6/6 DEPOTS SYNCHRONIZED
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stockItems.map((item) => {
            const Icon = item.icon;
            const pct = Math.round((item.currentStock / item.maxCapacity) * 100);
            const isLow = item.runwayDays < 60;

            return (
              <div
                key={item.id}
                onClick={() => handleInspectStock(item)}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl border ${item.color}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                          {item.category}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-800 group-hover:text-purple-700 transition-colors">
                          {item.name}
                        </h3>
                      </div>
                    </div>
                    {isLow && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <AlertCircle size={10} /> REORDER
                      </span>
                    )}
                  </div>

                  {/* Stock Quantity Display */}
                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-extrabold font-mono text-slate-900">
                        <GSAPNumberTicker value={item.currentStock} decimals={0} />
                      </span>
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">{item.unit} left</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-700">{pct}%</span>
                  </div>

                  {/* Stock Progress Bar */}
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${pct < 30 ? 'bg-red-500' : pct < 55 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Footer specs */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Burn: <strong className="text-slate-700">~{item.burnRatePerDay} {item.unit}/d</strong>
                  </span>
                  <span
                    className={`font-mono font-bold ${item.runwayDays < 60 ? 'text-amber-600' : 'text-emerald-700'
                      }`}
                  >
                    {item.runwayDays} Days Runway
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Maritime Resupply Supply Chain Vessel Tracker */}
      <div className="gsap-logistics-item">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">
          Active Resupply Pipeline & Vessel Route
        </h2>
        <GSAPShipTransit progress={68} />
      </div>

      {/* Resupply request ledger */}
      <div className="gsap-logistics-item">
        <ResupplyLedger requests={resupplyRequests ?? []} />
      </div>

      {/* Create resupply request modal */}
      {modalOpen && (
        <ResupplyModal
          stationId={stationId}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['resupply', stationId] });
          }}
        />
      )}

      {/* Clean White Detail Modal */}
      <GSAPFlipDetailModal
        data={detailItem}
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        onAction={(actionName) => {
          if (actionName === 'OPEN_RESUPPLY_MODAL') {
            setDetailItem(null);
            setModalOpen(true);
          }
        }}
      />
    </div>
  );
};

/* ---------------- Resupply ledger ---------------- */

function ResupplyLedger({
  requests,
}: {
  requests: Array<{ id: number; item: string; quantity: number; unit: string; priority: string; status: string; requested_at: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
            Resupply Request & Consignment Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Orders routed to NCPOR Logistics Headquarters, Goa.</p>
        </div>
        <span className="text-xs font-mono text-slate-500 font-semibold">{requests.length} Orders Active</span>
      </div>

      {(requests.length ?? 0) === 0 ? (
        <p className="py-6 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-xl">
          No active resupply requests — all station stock levels are currently within safe operational buffers.
        </p>
      ) : (
        <div className="space-y-2.5">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <Ship size={16} className="text-purple-600" />
              <span className="font-mono text-sm font-extrabold text-slate-800">{r.item}</span>
              <span className="font-mono text-xs font-semibold text-slate-500">
                {r.quantity.toLocaleString()} {r.unit}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold tracking-widest ${r.priority === 'HIGH' || r.priority === 'CRITICAL'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : r.priority === 'MEDIUM'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
              >
                {r.priority}
              </span>
              <span className="ml-auto font-mono text-xs font-bold text-slate-600">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Create resupply modal ---------------- */

const STOCK_PRESETS: Record<string, { name: string; unit: string }[]> = {
  Rations: [
    { name: 'Basmati Rice', unit: 'kg' },
    { name: 'Wheat Flour', unit: 'kg' },
    { name: 'Pulses/Dal', unit: 'kg' },
    { name: 'Freeze-Dried Meals', unit: 'packs' },
    { name: 'Dairy Powder', unit: 'kg' },
    { name: 'Cooking Oil', unit: 'L' },
  ],
  Fuel: [
    { name: 'Arctic Low-Pour Diesel', unit: 'Liters' },
    { name: 'Jet A-1 Aviation Fuel', unit: 'Liters' },
    { name: 'Synthetic Engine Oil', unit: 'Liters' },
  ],
  'Potable Water': [
    { name: 'Bottled Emergency Water', unit: 'Liters' },
    { name: 'RO Membrane Cartridges', unit: 'Units' },
  ],
  'Spare Parts': [
    { name: 'Fuel Injectors', unit: 'Units' },
    { name: 'HVAC Filters', unit: 'Units' },
    { name: 'Alternator Belts', unit: 'Pieces' },
  ],
  Medical: [
    { name: 'Polar Trauma Kits', unit: 'Kits' },
    { name: 'Medical Oxygen', unit: 'Cylinders' },
    { name: 'IV Fluids', unit: 'Units' },
  ],
  Science: [
    { name: 'Liquid Nitrogen', unit: 'Liters' },
    { name: 'Aerosol Filters', unit: 'Packs' },
    { name: 'Sample Vials', unit: 'Boxes' },
  ],
};

const STOCK_ICON: Record<string, typeof Fuel> = {
  Rations: Utensils,
  Fuel: Fuel,
  'Potable Water': Droplets,
  'Spare Parts': Wrench,
  Medical: HeartPulse,
  Science: FlaskConical,
};

function ResupplyModal({
  stationId,
  onClose,
  onCreated,
}: {
  stationId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<ResupplyRequestCreate>({
    item: 'Arctic Low-Pour Diesel',
    quantity: 1000,
    unit: 'Liters',
    priority: 'HIGH',
    reason: '',
  });
  const [category, setCategory] = useState<string>('Fuel');

  const mutation = useMutation({
    mutationFn: () => createResupplyRequest(stationId, form),
    onSuccess: () => {
      onCreated();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-800">
        <h3 className="text-lg font-extrabold text-slate-900">File New Resupply Requisition</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Direct satellite transmission to NCPOR Logistics Cell, Goa.
        </p>

        <div className="mt-5 space-y-4">
          {/* Categorized quick-select stock examples */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock Category</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.keys(STOCK_PRESETS).map((cat) => {
                const Icon = STOCK_ICON[cat];
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                      active
                        ? 'border-purple-400 bg-purple-50 text-purple-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={12} /> {cat}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {STOCK_PRESETS[category].map((p) => {
                const selected = form.item === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setForm({ ...form, item: p.name, unit: p.unit })}
                    className={`flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-purple-500 bg-purple-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/40'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-700">{p.name}</span>
                    <span className="text-[9px] font-mono text-slate-400">unit: {p.unit}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected item readout */}
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected Consumable</span>
            <div className="mt-1.5 w-full rounded-xl border border-purple-200 bg-purple-50/50 px-3 py-2.5 text-sm font-bold text-slate-800">
              {form.item} <span className="ml-1 text-xs font-semibold text-slate-500">({form.unit})</span>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Quantity</span>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-purple-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Priority</span>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-purple-500"
              >
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Operational Reason</span>
            <textarea
              rows={2}
              value={form.reason ?? ''}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="E.g., Wintering buffer replenishment before sea ice freeze..."
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500"
            />
          </label>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-xs font-bold text-red-600">Transmission failed — verify link connection and retry.</p>
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {mutation.isPending ? 'Transmitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Logistics;
