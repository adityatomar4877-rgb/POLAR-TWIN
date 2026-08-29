import { useStationStore, type VisualMode } from '../../lib/stationStore'

const MODES: { id: VisualMode; label: string }[] = [
  { id: 'standard', label: 'STANDARD VIEW' },
  { id: 'thermal', label: 'THERMAL IR' },
  { id: 'utilities', label: 'UTILITY FLOW' },
  { id: 'night', label: 'POLAR NIGHT' },
]

/** Floating viewport-mode selector + thermal calibration legend. */
export function ModeToolbar() {
  const visualMode = useStationStore((s) => s.visualMode)
  const setVisualMode = useStationStore((s) => s.setVisualMode)
  const weather = useStationStore((s) => s.weather)
  const setWeather = useStationStore((s) => s.setWeather)

  return (
    <div className="mode-toolbar">
      <div className="mode-toolbar-row" role="toolbar" aria-label="Visualization modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mode-btn${visualMode === m.id ? ' active' : ''}`}
            aria-pressed={visualMode === m.id}
            onClick={() => setVisualMode(m.id)}
          >
            {m.label}
          </button>
        ))}
        <span className="mode-sep" />
        <button
          type="button"
          className={`mode-btn mode-btn-weather${weather === 'blizzard' ? ' active' : ''}`}
          aria-pressed={weather === 'blizzard'}
          onClick={() => setWeather(weather === 'blizzard' ? 'clear' : 'blizzard')}
        >
          BLIZZARD
        </button>
      </div>

      {visualMode === 'thermal' && (
        <div className="thermal-legend" aria-label="Thermal temperature scale">
          <div className="thermal-gradient" />
          <div className="thermal-ticks">
            <span>-25°C</span>
            <span>-5°C</span>
            <span>15°C</span>
            <span>45°C</span>
            <span>80°C</span>
          </div>
          <div className="thermal-caption">IR FALSE-COLOUR SCALE</div>
        </div>
      )}

      {visualMode === 'utilities' && (
        <div className="thermal-legend utility-legend" aria-label="Utility flow legend">
          <div className="utility-legend-items">
            <div className="whatif-legend">
              <span className="legend-swatch line" style={{ background: '#f97316' }} />
              <span>FUEL SUPPLY</span>
            </div>
            <div className="whatif-legend">
              <span className="legend-swatch line" style={{ background: '#38bdf8' }} />
              <span>WATER INTAKE</span>
            </div>
            <div className="whatif-legend">
              <span className="legend-swatch line" style={{ background: '#facc15' }} />
              <span>POWER GRID</span>
            </div>
          </div>
          <div className="thermal-caption" style={{ marginTop: '8px' }}>CONDUIT CONTENTS</div>
        </div>
      )}
    </div>
  )
}
