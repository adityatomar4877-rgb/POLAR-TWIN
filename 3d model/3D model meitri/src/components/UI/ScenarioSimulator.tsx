import { useState } from 'react'
import { STATION_SYSTEMS, type SystemStatus } from '../../lib/stationSystems'
import { SCENARIO_META, selectEffectiveStatus, useStationStore, type ScenarioId } from '../../lib/stationStore'

const OPTIONS: { value: SystemStatus; label: string }[] = [
  { value: 'nominal', label: 'NOMINAL' },
  { value: 'elevated', label: 'WARNING' },
  { value: 'critical', label: 'CRITICAL' },
  { value: 'maintenance', label: 'MAINTENANCE' },
]

function SimRow({ id, label }: { id: string; label: string }) {
  const effective = useStationStore(selectEffectiveStatus(id))
  const setStatusOverride = useStationStore((s) => s.setStatusOverride)
  return (
    <label className="sim-row">
      <span className="sim-label">{label}</span>
      <select
        className={`sim-select sim-${effective}`}
        value={effective}
        onChange={(e) => setStatusOverride(id, e.target.value as SystemStatus)}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Mock fault injector: overrides any system's operational status so judges
 * can watch beacons, pulse rings, flow conduits and the dashboard react live.
 */
export function ScenarioSimulator() {
  const [open, setOpen] = useState(false)
  const overrides = useStationStore((s) => s.statusOverrides)
  const resetStatusOverrides = useStationStore((s) => s.resetStatusOverrides)
  const overrideCount = Object.keys(overrides).length
  const scenario = useStationStore((s) => s.scenario)
  const applyScenario = useStationStore((s) => s.applyScenario)
  const clearScenario = useStationStore((s) => s.clearScenario)
  const faults = useStationStore((s) => s.faults)
  const activeStation = useStationStore((s) => s.activeStation)

  return (
    <section className={`panel simulator${open ? ' open' : ''}`} aria-label="Scenario simulator">
      <button
        type="button"
        className="sim-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`sim-indicator${overrideCount > 0 || faults.fuelLeak || faults.genBearing ? ' active' : ''}`} />
        SCENARIO SIMULATOR
        {overrideCount > 0 && <span className="sim-count">{overrideCount}</span>}
        <span className="sim-chevron">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="sim-body">
          <div className="sim-presets-head">MISSION DEMO PRESETS</div>
          {(Object.keys(SCENARIO_META) as ScenarioId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`sim-preset${scenario === id ? ' active' : ''}`}
              onClick={() => applyScenario(id)}
              title={SCENARIO_META[id].description}
            >
              <span className="sim-preset-id">{id}</span>
              <span className="sim-preset-label">{SCENARIO_META[id].label}</span>
            </button>
          ))}
          {scenario && (
            <button type="button" className="sim-reset" onClick={clearScenario}>
              CLEAR PRESET (STOP FAULT PHYSICS)
            </button>
          )}

          <div className="sim-presets-head">MANUAL STATUS OVERRIDE</div>
          {STATION_SYSTEMS.filter(s => s.id.toLowerCase().startsWith(activeStation)).map((system) => (
            <SimRow key={system.id} id={system.id} label={system.label} />
          ))}
          <button
            type="button"
            className="sim-reset"
            onClick={resetStatusOverrides}
            disabled={overrideCount === 0}
          >
            RESET ALL STATUSES
          </button>
          <p className="sim-hint">
            Injected faults instantly drive 3D beacons, pulse rings, flow conduits and dashboard
            badges.
          </p>
        </div>
      )}
    </section>
  )
}
