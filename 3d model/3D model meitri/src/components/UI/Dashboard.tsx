import { useMemo, useState } from 'react'
import { STATION_SYSTEMS, getStationSystem, STATUS_BADGE, type SystemStatus } from '../../lib/stationSystems'
import { selectEffectiveStatus, useStationStore } from '../../lib/stationStore'
import { useTelemetry } from '../../hooks/useTelemetry'
import { TelemetryGraphPanel } from './TelemetryGraphPanel'
import { SopCenterList } from './SOPModal'
import type { AiInsight } from '../../lib/aiPredictiveEngine'

type DetailTab = 'telemetry' | 'ai' | 'sop'

const TAB_LABELS: Record<DetailTab, string> = {
  telemetry: 'TELEMETRY',
  ai: 'AI MAINTENANCE',
  sop: 'SOP CENTER',
}

function Sparkline({ history }: { history: number[] }) {
  const points = useMemo(() => {
    if (history.length < 2) return ''
    const min = Math.min(...history)
    const max = Math.max(...history)
    const span = max - min || 1
    return history
      .map((v, i) => {
        const x = (i / (history.length - 1)) * 100
        const y = 26 - ((v - min) / span) * 22 - 2
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [history])

  return (
    <svg className="spark" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} />
    </svg>
  )
}

function SystemRow({ id, label, selected }: { id: string; label: string; selected: boolean }) {
  const selectSystem = useStationStore((s) => s.selectSystem)
  const clearSelection = useStationStore((s) => s.clearSelection)
  const setHovered = useStationStore((s) => s.setHovered)
  const isHovered = useStationStore((s) => s.hoveredSystemId === id)
  const status = useStationStore(selectEffectiveStatus(id))

  return (
    <button
      type="button"
      className={`system-row${selected ? ' is-selected' : ''}${isHovered ? ' is-hovered' : ''}`}
      aria-pressed={selected}
      onClick={() => (selected ? clearSelection() : selectSystem(id))}
      onMouseEnter={() => setHovered(id)}
      onMouseLeave={() => setHovered(null)}
    >
      <span className={`status-dot status-${status}`} />
      <span className="system-row-label">{label}</span>
      <span className={`row-badge badge-${status}`}>{STATUS_BADGE[status]}</span>
    </button>
  )
}

function FailureCurve({ points }: { points: number[] }) {
  const path = points.map((p, i) => `${((i / (points.length - 1)) * 100).toFixed(1)},${(24 - p * 22).toFixed(1)}`).join(' ')
  return (
    <svg className="fail-curve" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={path} />
    </svg>
  )
}

function InsightCard({ insight }: { insight: AiInsight }) {
  return (
    <div className={`ai-card sev-${insight.severity.toLowerCase()}`}>
      <div className="ai-card-head">
        <span className="ai-kind">{insight.kind === 'RUL' ? 'RUL MODEL' : 'PATTERN AI'}</span>
        <span className={`ai-sev sev-${insight.severity.toLowerCase()}`}>{insight.severity}</span>
      </div>
      <div className="ai-title">{insight.title}</div>
      <div className="ai-asset">{insight.assetOrPattern}</div>
      <p className="ai-detail">{insight.detail}</p>
      {insight.kind === 'RUL' && insight.wearPercent !== undefined && (
        <div className="ai-rul-row">
          <div className="wear-bar" title={`Wear ${insight.wearPercent.toFixed(1)}%`}>
            <div className="wear-fill" style={{ width: `${Math.min(100, insight.wearPercent)}%` }} />
          </div>
          <span className="wear-pct">{insight.wearPercent.toFixed(1)}% WEAR</span>
        </div>
      )}
      {insight.rulHours !== undefined && (
        <div className="ai-rul-stats">
          <span>
            RUL <b>{insight.rulHours >= 9999 ? '9999+' : Math.round(insight.rulHours)} h</b>
          </span>
          <span>
            CONF <b>±{insight.rulConfidencePct?.toFixed(0)}%</b>
          </span>
          <span>
            SERVICE IN <b>{insight.daysToService! >= 999 ? '999+ d' : `${Math.round(insight.daysToService!)} d`}</b>
          </span>
        </div>
      )}
      {insight.failureCurve && <FailureCurve points={insight.failureCurve} />}
    </div>
  )
}

function AiMaintenanceTab() {
  const insights = useStationStore((s) => s.aiInsights)
  const selectSystem = useStationStore((s) => s.selectSystem)
  if (insights.length === 0) {
    return <div className="drawer-empty">AI ENGINE WARMING UP — degradation models initialize on the first mission ticks.</div>
  }
  const ruls = insights.filter((i) => i.kind === 'RUL')
  const patterns = insights.filter((i) => i.kind === 'CORRELATION')
  return (
    <div className="ai-tab">
      <div className="ai-section-label">ASSET HEALTH & REMAINING USEFUL LIFE</div>
      {ruls.map((i) => (
        <button key={i.id} type="button" className="ai-card-btn" onClick={() => i.systemId && selectSystem(i.systemId)}>
          <InsightCard insight={i} />
        </button>
      ))}
      <div className="ai-section-label">MULTI-VARIATE ANOMALY CORRELATION</div>
      {patterns.length === 0 && <div className="ai-none">No cross-system patterns detected.</div>}
      {patterns.map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}
    </div>
  )
}

function TelemetryTab() {
  const selectedSystemId = useStationStore((s) => s.selectedSystemId)
  const clearSelection = useStationStore((s) => s.clearSelection)
  const system = selectedSystemId ? getStationSystem(selectedSystemId) : undefined
  const status = useStationStore(selectedSystemId ? selectEffectiveStatus(selectedSystemId) : () => 'nominal' as SystemStatus)
  const readings = useTelemetry(system?.id ?? null)

  if (!system || !selectedSystemId) {
    return <div className="drawer-empty">SELECT A STATION SYSTEM (rail, 3D click or 1–7 keys) TO MONITOR ITS TELEMETRY.</div>
  }

  return (
    <>
      <header className="detail-head">
        <div>
          <div className="detail-category">{system.category.toUpperCase()}</div>
          <h2 className="detail-title">{system.label}</h2>
        </div>
        <button type="button" className="close-btn" onClick={clearSelection} aria-label="Close panel">
          ✕
        </button>
      </header>

      <div className="detail-status">
        <span className={`status-dot status-${status}`} />
        <span>{STATUS_BADGE[status]}</span>
        <span className="live-badge">LIVE · 1 Hz</span>
      </div>

      <p className="detail-summary">{system.summary}</p>

      <div className="telemetry-grid">
        {readings.map((r) => (
          <div className="tele-card" key={r.key}>
            <div className="tele-label">{r.label}</div>
            <div className="tele-value">
              {r.formatted}
              <span className="tele-unit">{r.unit}</span>
            </div>
            <Sparkline history={r.history} />
          </div>
        ))}
      </div>

      <TelemetryGraphPanel readings={readings} />
    </>
  )
}

function DetailPanel() {
  const [tab, setTab] = useState<DetailTab>('telemetry')
  const selectedSystemId = useStationStore((s) => s.selectedSystemId)

  return (
    <aside className="panel detail-panel" data-system-id={selectedSystemId ?? undefined} data-tab={tab}>
      <div className="detail-tabs" role="tablist">
        {(Object.keys(TAB_LABELS) as DetailTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`detail-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {tab === 'telemetry' && <TelemetryTab />}
      {tab === 'ai' && <AiMaintenanceTab />}
      {tab === 'sop' && (
        <div className="sop-tab">
          <SopCenterList />
        </div>
      )}
    </aside>
  )
}

export function Dashboard() {
  const selectedSystemId = useStationStore((s) => s.selectedSystemId)
  const viewMode = useStationStore((s) => s.viewMode)
  const clearSelection = useStationStore((s) => s.clearSelection)

  const activeStation = useStationStore((s) => s.activeStation)
  const visibleSystems = STATION_SYSTEMS.filter(s => s.id.toLowerCase().startsWith(activeStation))

  return (
    <>
      <nav className="panel system-rail" aria-label="Station systems">
        <div className="rail-head">
          <span>STATION SYSTEMS</span>
          <span className="viewmode-chip" data-mode={viewMode}>
            {viewMode.toUpperCase()}
          </span>
        </div>
        {visibleSystems.map((s, i) => (
          <SystemRow key={s.id} id={s.id} label={`${i + 1}. ${s.label}`} selected={s.id === selectedSystemId} />
        ))}
        <button
          type="button"
          className="reset-btn"
          onClick={clearSelection}
          disabled={!selectedSystemId}
          title="Reset camera to campus overview (Esc)"
        >
          RESET VIEW
        </button>
      </nav>
      <DetailPanel />
    </>
  )
}
