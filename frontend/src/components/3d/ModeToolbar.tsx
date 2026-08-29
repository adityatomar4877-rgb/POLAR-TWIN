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
        <div className="w-[300px] rounded-xl border border-white/60 bg-white/85 p-2.5 shadow-md backdrop-blur-md">
          <div className="h-2.5 rounded-full bg-gradient-to-r from-[#0a1128] via-[#312e81] via-50% via-[#22d3ee] via-65% via-[#4ade80] via-82% to-[#ef4444]" />
          <div className="mt-1 flex justify-between font-mono text-[8px] font-semibold tracking-wide text-slate-500">
            <span>-25°C</span>
            <span>-5°C</span>
            <span>15°C</span>
            <span>45°C</span>
            <span>80°C</span>
          </div>
          <div className="mt-1 text-center font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-slate-400">
            IR False-Colour Scale
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
