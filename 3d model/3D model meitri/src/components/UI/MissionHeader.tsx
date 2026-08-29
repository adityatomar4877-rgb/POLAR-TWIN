import { stationTimeNow } from '../../lib/alertEngine'
import { useStationStore } from '../../lib/stationStore'

function HealthGauge({ value }: { value: number }) {
  const R = 15
  const C = 2 * Math.PI * R
  const frac = Math.max(0, Math.min(100, value)) / 100
  const color = value >= 70 ? '#35b26a' : value >= 40 ? '#e0a11c' : '#ef4444'
  return (
    <div className="mh-gauge" title={`Composite health ${value}%`}>
      <svg viewBox="0 0 40 40" width="40" height="40">
        <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(140,180,210,0.25)" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(C * frac).toFixed(1)} ${C.toFixed(1)}`}
          transform="rotate(-90 20 20)"
        />
        <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#e6eef4">
          {value}
        </text>
      </svg>
      <div className="mh-gauge-label">HEALTH</div>
    </div>
  )
}

/** Top mission operations strip: health, clock, weather, alarms, runway. */
export function MissionHeader() {
  const predictive = useStationStore((s) => s.predictive)
  const environment = useStationStore((s) => s.environment)
  const alerts = useStationStore((s) => s.alerts)
  const missionTick = useStationStore((s) => s.missionTick)
  const toggleAlertsDrawer = useStationStore((s) => s.toggleAlertsDrawer)
  const alertsOpen = useStationStore((s) => s.alertsOpen)
  const toggleCopilot = useStationStore((s) => s.toggleCopilot)
  const toggleWhatIf = useStationStore((s) => s.toggleWhatIf)
  const toggleReport = useStationStore((s) => s.toggleReport)
  const activeStation = useStationStore((s) => s.activeStation)
  const setActiveStation = useStationStore((s) => s.setActiveStation)

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length
  const warningCount = alerts.length - criticalCount
  const clock = stationTimeNow() + ` · t+${missionTick}s`

  return (
    <header className="mission-header" data-testid="mission-header">
      <div className="mh-brand">
        <div className="mh-title">
          <select 
            value={activeStation} 
            onChange={(e) => setActiveStation(e.target.value as 'bharati' | 'maitri')}
            style={{ 
              background: 'transparent', 
              color: 'inherit', 
              border: 'none', 
              font: 'inherit', 
              fontWeight: 'inherit',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              textTransform: 'uppercase'
            }}
          >
            <option value="bharati" style={{ color: '#000' }}>BHARATI</option>
            <option value="maitri" style={{ color: '#000' }}>MAITRI</option>
          </select> MOC
        </div>
        <div className="mh-sub">MISSION OPERATIONS CENTER</div>
      </div>

      {predictive && <HealthGauge value={predictive.healthIndex} />}

      <div className="mh-cell">
        <div className="mh-value">{clock}</div>
        <div className="mh-label">STATION TIME (UTC+5)</div>
      </div>

      <div className="mh-cell">
        <div className="mh-value mh-weather">{environment?.label ?? '—'}</div>
        <div className="mh-label">
          {environment ? `${environment.ambientTemp.toFixed(0)}°C AMBIENT · ${environment.windKts.toFixed(0)} KTS WIND` : 'ENV'}
        </div>
      </div>

      {predictive && (
        <>
          <div className="mh-cell">
            <div className="mh-value">{predictive.fuelDaysLabel}</div>
            <div className="mh-label">FUEL AUTONOMY</div>
          </div>
          <div className="mh-cell">
            <div className="mh-value">
              {predictive.stationLoadKw}
              <span className="mh-unit">/{predictive.generationCapacityKw} kW</span>
            </div>
            <div className="mh-label">
              GRID · N+1 {predictive.nPlusOneOk ? 'OK' : 'AT RISK'}
            </div>
          </div>
          <div className="mh-cell">
            <div className="mh-value">{predictive.waterReservePercent.toFixed(1)}%</div>
            <div className="mh-label">
              WATER · {predictive.waterAutonomyHours >= 48 ? `${Math.floor(predictive.waterAutonomyHours / 24)} D` : `${Math.floor(predictive.waterAutonomyHours)} H`} RESERVE
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        className={`mh-alarms${criticalCount > 0 ? ' has-critical' : ''}${alertsOpen ? ' open' : ''}`}
        onClick={() => toggleAlertsDrawer()}
        aria-label={`Active alarms: ${alerts.length}`}
      >
        <span className={`mh-alarm-dot${criticalCount > 0 ? ' critical' : warningCount > 0 ? ' warning' : ''}`} />
        {alerts.length}
        <span className="mh-alarms-label">ALARMS</span>
      </button>

      <div className="mh-tools">
        <button type="button" className="mh-tool" onClick={() => toggleCopilot()}>
          COPILOT
        </button>
        <button type="button" className="mh-tool" onClick={() => toggleWhatIf()}>
          WHAT-IF
        </button>
        <button type="button" className="mh-tool" onClick={() => toggleReport()}>
          BRIEFING
        </button>
      </div>
    </header>
  )
}
