import { useMemo, useState } from 'react'
import { simulateWhatIf, WHAT_IF_DEFAULTS, type WhatIfParams } from '../../lib/whatIfSimulator'
import { useStationStore } from '../../lib/stationStore'

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <label className="whatif-slider">
      <span className="whatif-slider-label">
        {label}
        <b>
          {value}
          {unit}
        </b>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

/** Crisis "What-If" projection panel with sliders and outcome chart. */
export function WhatIfPanel() {
  const whatIfOpen = useStationStore((s) => s.whatIfOpen)
  const toggleWhatIf = useStationStore((s) => s.toggleWhatIf)
  const predictive = useStationStore((s) => s.predictive)
  const [params, setParams] = useState<WhatIfParams>(WHAT_IF_DEFAULTS)

  const result = useMemo(
    () => (predictive ? simulateWhatIf(params, predictive) : null),
    [params, predictive],
  )

  if (!whatIfOpen || !result) return null

  const W = 300
  const H = 90
  const horizon = Math.max(30, Math.min(120, params.vesselDelayDays + 20))
  const x = (d: number) => (d / horizon) * W
  const y = (v: number) => H - (v / 100) * H
  const pts = result.points.filter((p) => p.day <= horizon)
  const chart =
    pts.length < 2 ? null : (
      <svg viewBox={`0 0 ${W} ${H}`} className="whatif-chart">
        <rect x={0} y={0} width={x(Math.min(params.blizzardDays, horizon))} height={H} className="whatif-storm-band" />
        <line x1={x(Math.min(params.vesselDelayDays, horizon))} y1={0} x2={x(Math.min(params.vesselDelayDays, horizon))} y2={H} className="whatif-vessel-line" />
        <polyline points={pts.map((p) => `${x(p.day).toFixed(1)},${y(p.fuelPercent).toFixed(1)}`).join(' ')} className="whatif-line fuel" />
        <polyline points={pts.map((p) => `${x(p.day).toFixed(1)},${y(p.waterPercent).toFixed(1)}`).join(' ')} className="whatif-line water" />
      </svg>
    )

  return (
    <section className="panel whatif-panel" aria-label="What-if crisis simulator">
      <header className="drawer-head">
        <div>
          <div className="drawer-title">WHAT-IF CRISIS SIMULATOR</div>
          <div className="drawer-sub">DETERMINISTIC 120-DAY LOGISTICS FORECAST</div>
        </div>
        <button type="button" className="close-btn" onClick={() => toggleWhatIf(false)} aria-label="Close simulator">
          ✕
        </button>
      </header>

      <div className="whatif-body">
        <Slider label="Blizzard duration" value={params.blizzardDays} min={1} max={30} unit=" d" onChange={(v) => setParams((p) => ({ ...p, blizzardDays: v }))} />
        <Slider label="Next resupply vessel" value={params.vesselDelayDays} min={0} max={90} unit=" d" onChange={(v) => setParams((p) => ({ ...p, vesselDelayDays: v }))} />
        <Slider label="Generator efficiency loss" value={params.genEfficiencyLossPct} min={0} max={50} unit="%" onChange={(v) => setParams((p) => ({ ...p, genEfficiencyLossPct: v }))} />
        <Slider label="Camp occupancy surge" value={params.campOccupancy} min={20} max={65} unit=" pax" onChange={(v) => setParams((p) => ({ ...p, campOccupancy: v }))} />

        {result && chart}

        <div className="whatif-stats">
          <div>
            <b>{result.fuelDepletionDay === null ? '120+' : `Day ${result.fuelDepletionDay}`}</b>
            <span>FUEL DEPLETION</span>
          </div>
          <div>
            <b>{result.waterDeficitDay === null ? '120+' : `Day ${result.waterDeficitDay}`}</b>
            <span>WATER DEFICIT</span>
          </div>
          <div>
            <b>{result.powerMarginPct}%</b>
            <span>POWER MARGIN</span>
          </div>
        </div>

        <div className="whatif-recommendation">{result.recommendation}</div>
        <div className="whatif-legend">
          <span className="legend-swatch line fuel" /> FUEL
          <span className="legend-swatch line water" /> WATER
          <span className="whatif-legend-note">shaded = blizzard · vertical line = resupply ETA</span>
        </div>
      </div>
    </section>
  )
}
