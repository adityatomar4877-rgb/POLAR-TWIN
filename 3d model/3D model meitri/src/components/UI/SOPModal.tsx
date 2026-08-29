import { autoMitigation, getActiveSops, SOP_PROTOCOLS, type ActiveSop } from '../../lib/sopEngine'
import { useStationStore } from '../../lib/stationStore'

function SopWorkflow({ active, onClose }: { active: ActiveSop; onClose: () => void }) {
  const sopProgress = useStationStore((s) => s.sopProgress)
  const setSopProgress = useStationStore((s) => s.setSopProgress)
  const setMitigation = useStationStore((s) => s.setMitigation)
  const protocol = active.protocol
  const executed = sopProgress[protocol.id] ?? 0
  const complete = executed >= protocol.steps.length

  const runStep = (index: number) => {
    const step = protocol.steps[index]
    if (step.auto) setMitigation(step.auto, true)
    setSopProgress(protocol.id, Math.max(executed, index + 1))
  }

  const executeAll = () => {
    const auto = autoMitigation(protocol)
    if (auto) setMitigation(auto, true)
    setSopProgress(protocol.id, protocol.steps.length)
  }

  return (
    <div className="sop-workflow">
      <div className="sop-meta">
        <span className="sop-trigger">{active.triggeredBy.length} TRIGGER ALERT(S)</span>
        <span className="sop-progress">
          {executed}/{protocol.steps.length} STEPS
        </span>
      </div>
      <ol className="sop-steps">
        {protocol.steps.map((step, i) => {
          const done = i < executed
          return (
            <li key={step.label} className={`sop-step${done ? ' done' : ''}${step.auto ? ' auto' : ''}`}>
              <button
                type="button"
                className="sop-check"
                disabled={i > executed}
                onClick={() => runStep(i)}
                title={done ? 'Completed' : i === executed ? 'Execute this step' : 'Complete previous steps first'}
              >
                {done ? '✓' : i + 1}
              </button>
              <span className="sop-step-label">{step.label}</span>
              {step.auto && !done && i === executed && (
                <button type="button" className="alert-btn locate" onClick={() => runStep(i)}>
                  EXECUTE
                </button>
              )}
            </li>
          )
        })}
      </ol>
      <div className="sop-actions">
        {!complete ? (
          <button type="button" className="alert-btn locate" onClick={executeAll}>
            EXECUTE AUTOMATED STEPS
          </button>
        ) : (
          <span className="sop-complete">
            ✓ MITIGATION ACTIVE — telemetry recovering, alerts will auto-resolve
          </span>
        )}
        <button type="button" className="alert-btn" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  )
}

/** Interactive step-by-step SOP mitigation modal. */
export function SOPModal() {
  const sopModalId = useStationStore((s) => s.sopModalId)
  const openSopModal = useStationStore((s) => s.openSopModal)
  const alerts = useStationStore((s) => s.alerts)
  if (!sopModalId) return null

  const protocol = SOP_PROTOCOLS.find((p) => p.id === sopModalId)
  if (!protocol) return null
  const active: ActiveSop = {
    protocol,
    triggeredBy: alerts.filter((a) => a.systemId === protocol.systemId && !a.autoResolved),
  }

  return (
    <div className="modal-backdrop" onClick={() => openSopModal(null)}>
      <div className="modal panel sop-modal" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="drawer-title">SOP — {protocol.title}</div>
            <div className="drawer-sub">NCPOR ANTARCTIC OPERATIONS PROTOCOL · {protocol.triggerLabel}</div>
          </div>
          <button type="button" className="close-btn" onClick={() => openSopModal(null)} aria-label="Close SOP">
            ✕
          </button>
        </header>
        <div className="modal-body">
          <SopWorkflow active={active} onClose={() => openSopModal(null)} />
        </div>
      </div>
    </div>
  )
}

/** Compact SOP list for the SOP Action Center tab. */
export function SopCenterList() {
  const alerts = useStationStore((s) => s.alerts)
  const sopProgress = useStationStore((s) => s.sopProgress)
  const openSopModal = useStationStore((s) => s.openSopModal)
  const activeSops = getActiveSops(alerts)

  if (activeSops.length === 0) {
    return (
      <div className="sop-center">
        <div className="drawer-empty">
          NO SOP TRIGGERS — checklists arm automatically when anomaly alerts match an operational protocol.
        </div>
        <div className="sop-standby">
          {SOP_PROTOCOLS.map((p) => (
            <div key={p.id} className="sop-standby-row">
              <span className="sop-standby-dot" />
              {p.title}
              <span className="sop-standby-hint">STANDBY</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="sop-center">
      {activeSops.map(({ protocol, triggeredBy }) => {
        const executed = sopProgress[protocol.id] ?? 0
        return (
          <div key={protocol.id} className="sop-card">
            <div className="sop-card-head">
              <div>
                <div className="sop-card-title">{protocol.title}</div>
                <div className="sop-card-sub">
                  {triggeredBy.length} trigger alert(s) · {executed}/{protocol.steps.length} steps done
                </div>
              </div>
              <button type="button" className="alert-btn locate" onClick={() => openSopModal(protocol.id)}>
                OPEN WORKFLOW
              </button>
            </div>
            <div className="sop-mini-steps">
              {protocol.steps.map((s, i) => (
                <span key={s.label} className={`sop-mini-step${i < executed ? ' done' : ''}`}>
                  {i < executed ? '✓' : i + 1}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
