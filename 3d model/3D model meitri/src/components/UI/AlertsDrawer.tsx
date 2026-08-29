import { STATUS_BADGE } from '../../lib/stationSystems'
import { useAlerts } from '../../hooks/useAlerts'
import type { StationAlert } from '../../lib/alertEngine'

function AlertRow({ alert }: { alert: StationAlert }) {
  const { acknowledgeAlert, muteAlert, locateIn3d } = useAlerts()
  return (
    <div className={`alert-row sev-${alert.severity.toLowerCase()}${alert.acknowledged ? ' acked' : ''}`}>
      <div className="alert-top">
        <span className={`alert-sev sev-${alert.severity.toLowerCase()}`}>{alert.severity}</span>
        <span className="alert-system">{alert.systemLabel}</span>
        <span className="alert-time">{alert.timestamp}</span>
      </div>
      <div className="alert-msg">{alert.message}</div>
      <div className="alert-actions">
        <button type="button" className="alert-btn locate" onClick={() => locateIn3d(alert.systemId)}>
          LOCATE IN 3D
        </button>
        <button type="button" className="alert-btn" onClick={() => acknowledgeAlert(alert.id)}>
          {alert.acknowledged ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE'}
        </button>
        <button type="button" className="alert-btn" onClick={() => muteAlert(alert.id)}>
          {alert.muted ? 'UNMUTE' : 'MUTE'}
        </button>
      </div>
    </div>
  )
}

/** Slide-out alert center with Locate-in-3D, acknowledge and mute actions. */
export function AlertsDrawer() {
  const { alerts, alertLog, alertsOpen, toggleAlertsDrawer } = useAlerts()
  const sorted = [...alerts].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'CRITICAL' ? -1 : 1,
  )
  const resolvedRecent = alertLog.filter((a) => a.autoResolved).slice(0, 4)

  return (
    <aside className={`alerts-drawer panel${alertsOpen ? ' open' : ''}`} aria-label="Mission alerts" aria-hidden={!alertsOpen}>
      <header className="drawer-head">
        <div>
          <div className="drawer-title">MISSION ALERTS</div>
          <div className="drawer-sub">{alerts.length} ACTIVE · ANOMALY PIPELINE 1 HZ</div>
        </div>
        <button type="button" className="close-btn" onClick={() => toggleAlertsDrawer(false)} aria-label="Close alerts">
          ✕
        </button>
      </header>

      <div className="drawer-body">
        {sorted.length === 0 && <div className="drawer-empty">NO ACTIVE ANOMALIES — ALL CHANNELS NOMINAL</div>}
        {sorted.map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}

        {resolvedRecent.length > 0 && (
          <div className="drawer-resolved">
            <div className="drawer-resolved-head">RECENTLY AUTO-RESOLVED</div>
            {resolvedRecent.map((a) => (
              <div key={a.id + a.timestamp} className="alert-row resolved">
                <div className="alert-top">
                  <span className="alert-sev resolved">{STATUS_BADGE.nominal}</span>
                  <span className="alert-system">{a.systemLabel}</span>
                  <span className="alert-time">{a.timestamp}</span>
                </div>
                <div className="alert-msg">{a.channelLabel} returned to nominal band</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
