import { useMemo, useState } from 'react'
import type { TelemetryReading } from '../../lib/telemetry'

const W = 268
const H = 46
const PAD = 2

/** Live 60-second time-series chart with safe operating bounds shaded. */
function TrendChart({ reading }: { reading: TelemetryReading }) {
  const { def, history, formatted, unit } = reading

  const { points, bands } = useMemo(() => {
    const min = def.min
    const max = def.max
    const span = max - min || 1
    const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2)
    const pts = history
      .map((v, i) => `${((i / (history.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ')
    const zone = (lo: number, hi: number, cls: string) => (
      <rect key={cls + lo} x={0} y={y(hi)} width={W} height={Math.max(0.5, y(lo) - y(hi))} className={`chart-band ${cls}`} />
    )
    const bands: React.ReactElement[] = []
    const wb = def.warnBelow ?? def.critBelow
    const wa = def.warnAbove ?? def.critAbove
    if (wb !== undefined) bands.push(zone(min, wb, 'band-warn'))
    if (wa !== undefined) bands.push(zone(wa, max, 'band-warn'))
    if (def.critBelow !== undefined) bands.push(zone(min, def.critBelow, 'band-crit'))
    if (def.critAbove !== undefined) bands.push(zone(def.critAbove, max, 'band-crit'))
    return { points: pts, bands }
  }, [def, history])

  return (
    <div className="trend-chart">
      <div className="trend-head">
        <span className="trend-label">{def.label}</span>
        <span className="trend-value">
          {formatted} <span className="trend-unit">{unit}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="trend-svg">
        {bands}
        <polyline points={points} className="trend-line" />
      </svg>
    </div>
  )
}

/**
 * Expandable real-time trend charts (60 s rolling buffer @ 1 Hz) for the
 * inspected system, with warning / critical operating bounds shaded.
 */
export function TelemetryGraphPanel({ readings }: { readings: TelemetryReading[] }) {
  const [open, setOpen] = useState(false)
  if (readings.length === 0) return null

  return (
    <section className="trend-panel">
      <button type="button" className="trend-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        TREND GRAPHS · 60 S BUFFER
        <span className="sim-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="trend-list">
          {readings.map((r) => (
            <TrendChart key={r.key} reading={r} />
          ))}
          <div className="trend-legend">
            <span className="legend-swatch band-warn" /> WARNING BAND
            <span className="legend-swatch band-crit" /> CRITICAL BAND
            <span className="legend-swatch line" /> LIVE 1 HZ
          </div>
        </div>
      )}
    </section>
  )
}
