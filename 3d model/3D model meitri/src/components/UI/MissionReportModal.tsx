import { STATUS_BADGE, STATION_SYSTEMS } from '../../lib/stationSystems'
import { selectEffectiveStatus, useStationStore } from '../../lib/stationStore'
import { missionEngine } from '../../lib/telemetry'

function HealthMatrixRow({ id }: { id: string }) {
  const status = useStationStore(selectEffectiveStatus(id))
  const system = STATION_SYSTEMS.find((s) => s.id === id)
  const alerts = useStationStore((s) => s.alerts.filter((a) => a.systemId === id && !a.autoResolved).length)
  const keyChannel = system?.channels[0]
  const value = keyChannel ? missionEngine.getValue(id, keyChannel.key) : 0
  return (
    <tr>
      <td>{system?.label ?? id}</td>
      <td>
        <span className={`row-badge badge-${status}`}>{STATUS_BADGE[status]}</span>
      </td>
      <td className="report-num">
        {keyChannel ? `${value.toFixed(keyChannel.decimals)} ${keyChannel.unit}` : '—'}
      </td>
      <td className="report-num">{alerts}</td>
    </tr>
  )
}

/** Printable mission briefing modal (Phase 6 audit exporter). */
export function MissionReportModal() {
  const reportOpen = useStationStore((s) => s.reportOpen)
  const toggleReport = useStationStore((s) => s.toggleReport)
  const predictive = useStationStore((s) => s.predictive)
  const alerts = useStationStore((s) => s.alerts)
  const alertLog = useStationStore((s) => s.alertLog)
  const aiInsights = useStationStore((s) => s.aiInsights)
  const sopProgress = useStationStore((s) => s.sopProgress)
  const environment = useStationStore((s) => s.environment)

  if (!reportOpen) return null

  const saveHtml = () => {
    const node = document.querySelector('.report-doc')
    if (!node) return
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bharati Station Status Report</title><style>body{font-family:Segoe UI,Arial,sans-serif;background:#fff;color:#122;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #bbb;padding:6px 8px;font-size:12px;text-align:left;}h1,h2{margin:4px 0;}pre{white-space:pre-wrap;font:11px/1.5 Segoe UI,Arial;}</style></head><body>${node.innerHTML}</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bharati-mission-briefing.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-backdrop" onClick={() => toggleReport(false)}>
      <div className="modal panel report-modal" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head report-actions no-print">
          <div>
            <div className="drawer-title">STATION STATUS REPORT</div>
            <div className="drawer-sub">DIGITAL TWIN AUDIT · SIH EVALUATION SUMMARY</div>
          </div>
          <div className="report-btns">
            <button type="button" className="alert-btn locate" onClick={() => window.print()}>
              PRINT / PDF
            </button>
            <button type="button" className="alert-btn" onClick={saveHtml}>
              SAVE SUMMARY
            </button>
            <button type="button" className="close-btn" onClick={() => toggleReport(false)} aria-label="Close report">
              ✕
            </button>
          </div>
        </header>

        <div className="modal-body">
          <article className="report-doc">
            <h1>BHARATI ANTARCTIC DIGITAL TWIN — MISSION BRIEFING</h1>
            <p className="report-meta">
              Generated {new Date().toUTCString()} · Environment: {environment?.label ?? '—'} at{' '}
              {environment?.ambientTemp.toFixed(0)}°C, {environment?.windKts.toFixed(0)} kts
            </p>

            <h2>1 · Operational Readiness Score</h2>
            <p className="report-big-score">{predictive ? `${predictive.healthIndex}%` : '—'}</p>
            {predictive && (
              <table>
                <tbody>
                  <tr>
                    <th>Power stability</th>
                    <th>Life support</th>
                    <th>Environmental margin</th>
                    <th>Comms integrity</th>
                  </tr>
                  <tr>
                    <td>{predictive.powerStability}%</td>
                    <td>{predictive.lifeSupport}%</td>
                    <td>{predictive.environmentalRisk}%</td>
                    <td>{predictive.commsIntegrity}%</td>
                  </tr>
                </tbody>
              </table>
            )}

            <h2>2 · Subsystem Health Matrix</h2>
            <table>
              <thead>
                <tr>
                  <th>System</th>
                  <th>Status</th>
                  <th>Primary channel</th>
                  <th>Active alerts</th>
                </tr>
              </thead>
              <tbody>
                {STATION_SYSTEMS.map((s) => (
                  <HealthMatrixRow key={s.id} id={s.id} />
                ))}
              </tbody>
            </table>

            <h2>3 · Consumables Runway</h2>
            {predictive && (
              <table>
                <tbody>
                  <tr>
                    <td>Fuel autonomy</td>
                    <td className="report-num">{predictive.fuelDaysLabel}</td>
                    <td>Water reserve</td>
                    <td className="report-num">
                      {predictive.waterReservePercent.toFixed(1)}% ({Math.floor(predictive.waterAutonomyHours)} h)
                    </td>
                    <td>Grid</td>
                    <td className="report-num">
                      {predictive.stationLoadKw}/{predictive.generationCapacityKw} kW · N+1{' '}
                      {predictive.nPlusOneOk ? 'OK' : 'AT RISK'}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            <h2>4 · Active Anomaly Log</h2>
            <pre>{alerts.length > 0 ? alerts.map((a) => `[${a.severity}] ${a.timestamp} ${a.systemLabel}: ${a.message}`).join('\n') : 'No active anomalies.'}</pre>

            <h2>5 · AI Predictive Insights</h2>
            <pre>
              {aiInsights
                .filter((i) => i.severity !== 'INFO')
                .map((i) => `[${i.severity}] ${i.assetOrPattern}: ${i.title} — ${i.detail}`)
                .join('\n') || 'All degradation curves nominal.'}
            </pre>

            <h2>6 · Executed SOP Mitigations</h2>
            <pre>
              {Object.entries(sopProgress).length > 0
                ? Object.entries(sopProgress)
                    .map(([id, n]) => `${id}: ${n} step(s) executed`)
                    .join('\n')
                : 'No SOP workflows executed this session.'}
            </pre>
            <p className="report-meta">
              Recent alert history: {alertLog.length} entr{alertLog.length === 1 ? 'y' : 'ies'} (auto-resolved + acknowledged).
            </p>
          </article>
        </div>
      </div>
    </div>
  )
}
