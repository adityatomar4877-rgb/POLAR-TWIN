import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import {
  X,
  Zap,
  Package,
  Cpu,
  Thermometer,
  Activity,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Sparkles,
} from 'lucide-react';
import GSAPGaugeMeter from './GSAPGaugeMeter';
import GSAPNumberTicker from './GSAPNumberTicker';

export interface DetailCardData {
  type: 'generator' | 'supply' | 'equipment' | 'sensor' | 'custom';
  title: string;
  subtitle: string;
  category: string;
  status: 'ONLINE' | 'ACTIVE' | 'RUNNING' | 'STANDBY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  healthScore?: number;
  primaryValue: number;
  primaryUnit: string;
  primaryLabel: string;
  secondaryValue?: string | number;
  secondaryLabel?: string;
  runwayDays?: number;
  metrics: Array<{ label: string; value: string | number; tone?: string }>;
  specs: Array<{ key: string; value: string }>;
  diagnosticCodes?: string[];
  recommendedAction?: string;
  lastServiceDate?: string;
  actions?: Array<{ label: string; actionName: string; tone?: 'primary' | 'danger' | 'warning' }>;
}

interface GSAPFlipDetailModalProps {
  data: DetailCardData | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (actionName: string, itemData: DetailCardData) => void;
}

export default function GSAPFlipDetailModal({
  data,
  isOpen,
  onClose,
  onAction,
}: GSAPFlipDetailModalProps) {
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const modalBackdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActionSuccess(null);
    }
  }, [isOpen, data?.title]);

  // Handle compact 3D pop-out entrance animation
  useEffect(() => {
    if (!isOpen || !data) return;

    if (modalBackdropRef.current && cardRef.current) {
      gsap.fromTo(
        modalBackdropRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: 'power2.out' }
      );
      gsap.fromTo(
        cardRef.current,
        { scale: 0.75, rotateX: 18, y: 20, opacity: 0 },
        { scale: 1, rotateX: 0, y: 0, opacity: 1, duration: 0.38, ease: 'back.out(1.5)' }
      );
    }
  }, [isOpen, data]);

  const handleTriggerAction = (actionName: string) => {
    if (onAction && data) {
      onAction(actionName, data);
    }
    setActionSuccess(`Dispatched`);
    setTimeout(() => setActionSuccess(null), 2500);
  };

  if (!isOpen || !data) return null;

  const isWarning = data.status === 'WARNING' || data.status === 'STANDBY';
  const isDanger = data.status === 'CRITICAL' || data.status === 'OFFLINE';

  const getTypeIcon = () => {
    switch (data.type) {
      case 'generator':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'supply':
        return <Package className="w-4 h-4 text-purple-600" />;
      case 'equipment':
        return <Cpu className="w-4 h-4 text-cyan-600" />;
      case 'sensor':
        return <Thermometer className="w-4 h-4 text-emerald-600" />;
      default:
        return <Activity className="w-4 h-4 text-blue-600" />;
    }
  };

  const modalContent = (
    <div
      ref={modalBackdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      {/* Compact floating HUD card (not taking full screen) */}
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white/98 p-5 text-slate-800 shadow-2xl select-none"
        style={{ perspective: 1000 }}
      >
        {/* Top cyan accent line */}
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500" />

        {/* Header */}
        <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 pb-3 pt-0.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-200/70 bg-sky-50/60 shadow-2xs">
              {getTypeIcon()}
            </div>
            <div className="min-w-0">
              <span className="font-mono text-[9px] font-bold tracking-wider text-cyan-700 uppercase block truncate">
                {data.category}
              </span>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                {data.title}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium truncate">{data.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider border ${
                isDanger
                  ? 'border-red-200 bg-red-50 text-red-600 animate-pulse'
                  : isWarning
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {data.status}
            </span>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="my-3 grid grid-cols-[90px_1fr] items-center gap-4 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/50 via-white to-slate-50 p-3 shadow-2xs relative overflow-hidden">
          {/* Subtle tech corner accent */}
          <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-1 bg-cyan-400 -rotate-45 translate-x-5 -translate-y-2 opacity-60" />
          </div>

          <div className="flex items-center justify-center">
            <GSAPGaugeMeter
              value={data.primaryValue}
              unit={data.primaryUnit}
              label={data.primaryLabel}
              size={90}
              strokeColor={
                data.type === 'supply'
                  ? '#9333ea'
                  : data.type === 'generator'
                  ? '#d97706'
                  : '#0284c7'
              }
            />
          </div>

          <div className="flex flex-col gap-1.5 min-w-0 overflow-hidden">
            {data.healthScore !== undefined && (
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1">
                <span className="text-[10px] font-mono text-slate-500 font-semibold">HEALTH</span>
                <span
                  className={`font-mono text-xs font-extrabold ${
                    data.healthScore >= 75
                      ? 'text-emerald-600'
                      : data.healthScore >= 40
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  <GSAPNumberTicker value={data.healthScore} decimals={0} suffix="%" />
                </span>
              </div>
            )}

            {data.secondaryValue !== undefined && (
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1">
                <span className="text-[10px] font-mono text-slate-500 font-semibold truncate mr-2">
                  {data.secondaryLabel || 'RUNWAY'}
                </span>
                <span className="font-mono text-xs font-extrabold text-slate-800 truncate">
                  {data.secondaryValue}
                </span>
              </div>
            )}

            {data.runwayDays !== undefined && (
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1">
                <span className="text-[10px] font-mono text-slate-500 font-semibold">BUFFER</span>
                <span className="font-mono text-xs font-extrabold text-purple-700">
                  {data.runwayDays} Days
                </span>
              </div>
            )}

            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-mono font-semibold pt-0.5">
              <CheckCircle2 size={11} className="shrink-0" />
              <span className="truncate">Live Synchronized</span>
            </div>
          </div>
        </div>

        {/* Operational Metrics Matrix with refined inner borders */}
        <div className="grid grid-cols-3 gap-2 my-2.5">
          {data.metrics.slice(0, 6).map((m, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-2 text-center hover:border-cyan-300 transition-colors"
            >
              <span className="block text-[9px] font-mono font-semibold text-slate-400 truncate">
                {m.label}
              </span>
              <span className="block font-mono text-[11px] font-extrabold text-slate-800 truncate mt-0.5">
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* Technical Specs & Diagnostics with inner border */}
        <div className="my-2.5 rounded-xl border border-slate-200/70 bg-slate-50/40 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400 uppercase">
              TECHNICAL SPECIFICATIONS
            </span>
            <Sparkles size={10} className="text-cyan-600" />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono">
            {data.specs.slice(0, 4).map((s, idx) => (
              <div key={idx} className="flex flex-col border-b border-slate-100 pb-0.5">
                <span className="text-[8px] text-slate-400 uppercase font-semibold">{s.key}</span>
                <span className="font-bold text-slate-700 truncate">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Advisory banner if available */}
        {data.recommendedAction && (
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-2.5 py-1.5 text-[11px] font-mono text-sky-900 mb-2.5 flex items-center gap-1.5">
            <AlertCircle size={11} className="text-sky-600 shrink-0" />
            <span className="truncate">{data.recommendedAction}</span>
          </div>
        )}

        {/* Action feedback toast */}
        {actionSuccess && (
          <div className="mb-2 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px] font-mono text-emerald-700 text-center font-bold">
            ✓ {actionSuccess}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1">
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Wrench size={11} /> {data.lastServiceDate || 'Nominal'}
          </span>

          <div className="flex items-center gap-1.5">
            {data.actions && data.actions.length > 0 && (
              <>
                {data.actions.map((act, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTriggerAction(act.actionName)}
                    className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
                      act.tone === 'danger'
                        ? 'bg-red-600 text-white hover:bg-red-500'
                        : 'bg-cyan-600 text-white hover:bg-cyan-500'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
