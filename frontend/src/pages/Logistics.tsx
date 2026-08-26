import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { Package, Activity, AlertCircle, Plus, Ship } from 'lucide-react';
import { getStationDashboard } from '../api/stations';
import { getResupplyRequests, createResupplyRequest } from '../api/maintenance';
import { getFuelPrediction } from '../api/predictions';
import GSAPShipTransit from '../components/dashboard/GSAPShipTransit';
import GSAPNumberTicker from '../components/dashboard/GSAPNumberTicker';
import type { ResupplyRequestCreate } from '../api/types';

export const Logistics = ({ stationId }: { stationId: number }) => {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
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

  const items = dashboard.logistics || [];

  return (
    <div ref={containerRef} className="custom-scrollbar mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-auto pb-10 pr-2">
      <div className="gsap-logistics-item flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-widest text-slate-800">
            <Package className="h-6 w-6 text-purple-600" />
            SUPPLY_CHAIN_&_LOGISTICS
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Polar station consumable inventories, daily depletion rates, and resupply planning.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-100 px-4 py-2 font-mono text-xs tracking-widest text-purple-700 transition-colors hover:bg-purple-400/20"
        >
          <Plus size={14} /> NEW RESUPPLY REQUEST
        </button>
      </div>

      {/* Dynamic Maritime Voyage Route Tracker */}
      <div className="gsap-logistics-item">
        <GSAPShipTransit progress={68} />
      </div>

      {/* Fuel forecast strip */}
      {fuelForecast && (
        <div
          className={`gsap-logistics-item rounded-2xl border p-4 shadow-sm transition-all duration-300 ${
            fuelForecast.recommended_resupply
              ? 'border-red-300 bg-red-50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs">
            <span className={`tracking-[0.3em] font-bold ${fuelForecast.recommended_resupply ? 'text-red-600' : 'text-slate-600'}`}>
              FUEL FORECAST
            </span>
            <span className="text-slate-500">
              RESERVES <b className="text-slate-800"><GSAPNumberTicker value={fuelForecast.current_fuel_percentage} decimals={1} suffix="%" /></b> (
              <GSAPNumberTicker value={fuelForecast.current_fuel_liters} decimals={0} suffix=" L" />)
            </span>
            <span className="text-slate-500">
              CRITICAL IN{' '}
              <b className={fuelForecast.days_until_critical < 45 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                <GSAPNumberTicker value={fuelForecast.days_until_critical} decimals={0} suffix=" DAYS" />
              </b>
            </span>
            {fuelForecast.projected_depletion_date && (
              <span className="hidden text-slate-500 md:inline">
                PROJECTED EMPTY {new Date(fuelForecast.projected_depletion_date).toLocaleDateString()}
              </span>
            )}
            {fuelForecast.recommended_resupply && (
              <span className="ml-auto rounded-full bg-red-100 px-3 py-1 text-[10px] font-bold tracking-widest text-red-600 animate-pulse">
                RESUPPLY RECOMMENDED — FILE REQUEST NOW
              </span>
            )}
          </div>
        </div>
      )}

      {/* Inventory cards */}
      {items.length === 0 ? (
        <div className="gsap-logistics-item rounded-2xl border border-slate-200 bg-white p-8 text-center font-mono text-slate-500">
          NO_LOGISTICS_RECORDS_AVAILABLE
        </div>
      ) : (
        <div className="gsap-logistics-item grid grid-cols-1 gap-4 md:grid-cols-3">
          {items.map((item: any, i: number) => {
            const daysLeft = item.days_remaining ?? 90;
            const isLow = daysLeft < 30;

            return (
              <div key={item.id || i} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
                <div>
                  <div className="mb-2 flex items-start justify-between">
                    <span className="font-mono text-xs text-purple-600">{item.category || 'SUPPLY'}</span>
                    {isLow && (
                      <span className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[11px] text-amber-600">
                        <AlertCircle className="h-3 w-3" /> RESUPPLY_ALERT
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-700">{item.name || item.item_name}</h3>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-4">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-slate-500">IN_STOCK</span>
                    <span className="font-mono text-xl font-bold text-slate-800">
                      {item.quantity?.toLocaleString() ?? 0} <span className="text-xs text-slate-500">{item.unit || 'units'}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono text-[10px] text-slate-500">RUNWAY</span>
                    <span
                      className={`font-mono text-lg font-bold ${
                        daysLeft < 20 ? 'text-red-600' : daysLeft < 45 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {daysLeft.toFixed(0)} Days
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resupply request ledger */}
      <ResupplyLedger stationId={stationId} requests={resupplyRequests ?? []} />

      {modalOpen && (
        <ResupplyModal
          stationId={stationId}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['resupply', stationId] });
          }}
        />
      )}
    </div>
  );
};

/* ---------------- Resupply ledger ---------------- */

function ResupplyLedger({
  requests,
}: {
  stationId: number;
  requests: Array<{ id: number; item: string; quantity: number; unit: string; priority: string; status: string; requested_at: string }>;
}) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <h3 className="mb-4 font-mono text-xs font-bold tracking-[0.35em] text-slate-600">RESUPPLY REQUEST LEDGER</h3>
      {(requests.length ?? 0) === 0 ? (
        <p className="py-4 text-center font-mono text-[10px] tracking-widest text-slate-600">
          NO ACTIVE RESUPPLY REQUESTS — ALL SUPPLIES WITHIN PLANNING ENVELOPE
        </p>
      ) : (
        <div className="space-y-2.5">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <Ship size={14} className="text-cyan-600" />
              <span className="font-mono text-sm font-bold text-slate-800">{r.item}</span>
              <span className="font-mono text-xs text-slate-500">
                {r.quantity.toLocaleString()} {r.unit}
              </span>
              <span
                className={`rounded px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest ${
                  r.priority === 'HIGH' || r.priority === 'CRITICAL'
                    ? 'bg-red-100 text-red-600'
                    : r.priority === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {r.priority}
              </span>
              <span className="ml-auto font-mono text-[10px] tracking-widest text-slate-500">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Create resupply modal ---------------- */

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
    item: 'FUEL',
    quantity: 1000,
    unit: 'liters',
    priority: 'HIGH',
    reason: '',
  });

  const mutation = useMutation({
    mutationFn: () => createResupplyRequest(stationId, form),
    onSuccess: () => {
      onCreated();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 p-4 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-md rounded-xl p-6">
        <h3 className="font-mono text-base font-bold tracking-[0.25em] text-slate-800">FILE_RESUPPLY_REQUEST</h3>
        <p className="mt-1 font-mono text-[10px] tracking-widest text-slate-500">
          ROUTED TO NCPOR LOGISTICS CELL · GOA
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">ITEM</span>
            <select
              value={form.item}
              onChange={(e) => setForm({ ...form, item: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-cyan-300"
            >
              {['FUEL', 'RATIONS', 'SPARE_PARTS', 'MEDICAL', 'SCIENCE_CONSUMABLES'].map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">QUANTITY</span>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-cyan-300"
              />
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

          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">REASON</span>
            <textarea
              rows={2}
              value={form.reason ?? ''}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Projected fuel shortfall before next vessel window..."
              className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 placeholder:text-slate-600 outline-none focus:border-cyan-300"
            />
          </label>
        </div>

        {mutation.isError && (
          <p className="mt-3 font-mono text-xs text-red-600">SUBMISSION FAILED — CHECK LINK AND RETRY</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 font-mono text-sm text-slate-500 transition-colors hover:text-slate-700">
            CANCEL
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-purple-600 px-6 py-2 font-mono text-sm text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
          >
            {mutation.isPending ? 'TRANSMITTING...' : 'SUBMIT_REQUEST'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Logistics;
