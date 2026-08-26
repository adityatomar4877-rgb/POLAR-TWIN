import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { History, ShieldCheck } from 'lucide-react';
import CommandHistoryTable from '../components/operations/CommandHistoryTable';

export const AuditPage = ({ stationId }: { stationId: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-audit-item',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

  return (
    <div ref={containerRef} className="flex flex-col gap-5">
      <div className="gsap-audit-item flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700 shadow-xs ring-1 ring-slate-200">
            <History size={20} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Immutable Command Audit Trail</h1>
            <p className="text-sm text-slate-400">
              Complete cryptographic verification log of every operator override, automated load shed, and subsystem dispatch.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
          <ShieldCheck size={14} /> SHA-256 SIGNED
        </div>
      </div>
      <div className="gsap-audit-item">
        <CommandHistoryTable stationId={stationId} className="max-h-none" />
      </div>
    </div>
  );
};

export default AuditPage;

