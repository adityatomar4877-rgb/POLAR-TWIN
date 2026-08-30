import { useStationStore, type VisualMode } from '../../lib/3d/stationStore';
import { Snowflake, Thermometer, Activity, Moon, Eye } from 'lucide-react';

const MODES: { id: VisualMode; label: string; icon: typeof Eye }[] = [
  { id: 'standard', label: 'Standard', icon: Eye },
  { id: 'thermal', label: 'Thermal IR', icon: Thermometer },
  { id: 'utilities', label: 'Utility Flows', icon: Activity },
  { id: 'night', label: 'Polar Night', icon: Moon },
];

/**
 * Floating 3D viewport mode selector + manual blizzard toggle + legends.
 * Blizzard is a deliberate operator action (never auto-triggered by wind).
 */
export function ModeToolbar() {
  const visualMode = useStationStore((s) => s.visualMode);
  const setVisualMode = useStationStore((s) => s.setVisualMode);
  const weather = useStationStore((s) => s.weather);
  const setWeather = useStationStore((s) => s.setWeather);
  const blizzardActive = weather === 'blizzard';

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      <div
        className="flex items-center gap-1 rounded-full border border-white/60 bg-white/85 p-1 shadow-lg backdrop-blur-md"
        role="toolbar"
        aria-label="Visualization modes"
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = visualMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={active}
              onClick={() => setVisualMode(m.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={12} /> {m.label}
            </button>
          );
        })}

        <span className="mx-0.5 h-5 w-px bg-slate-200" />

        <button
          type="button"
          aria-pressed={blizzardActive}
          onClick={() => setWeather(blizzardActive ? 'clear' : 'blizzard')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            blizzardActive
              ? 'bg-sky-500 text-white shadow-[0_0_14px_rgba(56,189,248,0.45)]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Snowflake size={12} /> Blizzard
        </button>
      </div>

      {visualMode === 'thermal' && (
        <div className="w-[320px] rounded-xl border border-white/60 bg-white/90 p-2.5 shadow-lg backdrop-blur-md">
          <div
            className="h-3 rounded-full shadow-inner border border-black/10"
            style={{
              background: 'linear-gradient(to right, #1e3a8a 0%, #312e81 16%, #22d3ee 36%, #4ade80 52%, #fbbf24 70%, #f59e0b 86%, #ef4444 100%)',
            }}
          />
          <div className="mt-1.5 flex justify-between font-mono text-[9px] font-bold tracking-tight text-slate-600">
            <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1e3a8a]" />-25°C</span>
            <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#312e81]" />-5°C</span>
            <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22d3ee]" />15°C</span>
            <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#fbbf24]" />45°C</span>
            <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444]" />80°C</span>
          </div>
          <div className="mt-1 text-center font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-slate-400">
            IR False-Colour Thermal Scale
          </div>
        </div>
      )}

      {visualMode === 'utilities' && (
        <div className="rounded-xl border border-white/60 bg-white/85 p-2.5 shadow-md backdrop-blur-md">
          <div className="flex flex-col gap-1.5">
            {[
              { c: '#f97316', l: 'Fuel Supply' },
              { c: '#38bdf8', l: 'Water Intake' },
              { c: '#facc15', l: 'Power Grid' },
            ].map((x) => (
              <div key={x.l} className="flex items-center gap-2 font-mono text-[10px] font-semibold text-slate-600">
                <span className="h-2.5 w-4 rounded-sm" style={{ background: x.c }} />
                {x.l}
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-center font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-slate-400">
            Conduit Contents
          </div>
        </div>
      )}
    </div>
  );
}

export default ModeToolbar;
