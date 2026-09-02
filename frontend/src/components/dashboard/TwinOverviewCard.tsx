import { useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  Maximize2,
  Minimize2,
  Mouse,
  RotateCcw,
} from 'lucide-react';
import { DigitalTwinScene } from '../3d/DigitalTwinScene';
import { SystemDetailPanel } from '../3d/SystemDetailPanel';
import { useStationStore } from '../../lib/3d/stationStore';
import type { StationDashboardOut } from '../../api/types';
import { useStation } from '../../context/StationContext';

export default function TwinOverviewCard({ dashboard: _dashboard }: { dashboard: StationDashboardOut }) {
  const { selectedStationId } = useStation();
  const clearSelection = useStationStore((s) => s.clearSelection);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer heavy 3D canvas initialization until after initial route paint
    const handle =
      typeof requestIdleCallback !== 'undefined'
        ? requestIdleCallback(() => setMounted(true), { timeout: 200 })
        : setTimeout(() => setMounted(true), 100);

    return () => {
      if (typeof cancelIdleCallback !== 'undefined' && typeof handle === 'number') {
        cancelIdleCallback(handle);
      } else {
        clearTimeout(handle as number);
      }
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
        <div>
          <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-800">
            STATION DIGITAL TWIN
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400 font-medium">
            Click a facility to inspect · Live overview of all station systems
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? 'Collapse' : 'Expand'}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 cursor-pointer"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* 3D Visual Viewport with station backdrop */}
      <div
        data-lenis-prevent
        className={clsx(
          'twin-viewport relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition-all duration-500 group',
          expanded ? 'h-[720px]' : 'h-[500px] lg:h-[540px]'
        )}
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Interactive 3D digital twin */}
        <div className="absolute inset-0 pointer-events-auto" data-lenis-prevent>
          {mounted ? (
            <DigitalTwinScene stationId={selectedStationId} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100/90">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-400">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                <span>INITIALIZING DIGITAL TWIN...</span>
              </div>
            </div>
          )}
        </div>

        {/* Camera reset (docked top-right, clear of the mode toolbar) */}
        <button
          onClick={clearSelection}
          title="Reset camera"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-md backdrop-blur transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <RotateCcw size={14} />
        </button>

        {/* Docked 3D inspection panel — appears adjacent to the viewport when a facility is selected */}
        <SystemDetailPanel />

        {/* Interaction hint pill */}
        <div className="pointer-events-none absolute bottom-3.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-4 py-1 text-[11px] font-medium text-slate-600 shadow-md backdrop-blur">
          <Mouse size={12} className="text-slate-400" />
          <span>Drag to rotate</span>
          <span className="text-slate-300">•</span>
          <span>Scroll to zoom</span>
        </div>
      </div>
    </section>
  );
}
