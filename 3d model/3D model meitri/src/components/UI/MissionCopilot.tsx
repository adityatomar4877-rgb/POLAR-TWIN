import { useEffect, useRef, useState } from 'react'
import { answerQuery, QUICK_PROMPTS } from '../../lib/copilotKnowledge'
import { useStationStore } from '../../lib/stationStore'

/**
 * Antarctic Mission AI Copilot drawer.
 * Deterministic client-side intent engine over live telemetry; facility
 * references trigger the 3D camera glide + pulse via selectSystem.
 */
export function MissionCopilot() {
  const open = useStationStore((s) => s.copilotOpen)
  const toggleCopilot = useStationStore((s) => s.toggleCopilot)
  const messages = useStationStore((s) => s.copilotMessages)
  const addCopilotMessage = useStationStore((s) => s.addCopilotMessage)
  const clearCopilot = useStationStore((s) => s.clearCopilot)
  const activeStation = useStationStore((s) => s.activeStation)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const stationName = activeStation === 'maitri' ? 'Maitri' : 'Bharati'
  const brandName = activeStation === 'maitri' ? 'MAITRI INTELLIGENCE' : 'BHARATI INTELLIGENCE'

  const send = (raw: string) => {
    const text = raw.trim()
    if (text.length === 0) return
    addCopilotMessage({ role: 'user', text })
    // Instant deterministic reasoning over the freshest state.
    const reply = answerQuery(text, useStationStore.getState())
    addCopilotMessage({ role: 'copilot', text: reply.text })
    if (reply.focusSystemId) {
      useStationStore.getState().selectSystem(reply.focusSystemId)
    }
    setDraft('')
  }

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  if (!open) {
    return (
      <button type="button" className="copilot-launch" onClick={() => toggleCopilot(true)} aria-label="Open AI copilot">
        <span className="copilot-launch-orb" />
        {brandName}
      </button>
    )
  }

  return (
    <section className="panel copilot" aria-label="Mission AI copilot">
      <header className="copilot-head">
        <span className="copilot-orb" />
        <div>
          <div className="copilot-title">{brandName}</div>
          <div className="copilot-sub">MISSION COPILOT · OFFLINE REASONING CORE</div>
        </div>
        <button type="button" className="close-btn" onClick={clearCopilot} title="Clear transcript">
          ⟲
        </button>
        <button type="button" className="close-btn" onClick={() => toggleCopilot(false)} aria-label="Close copilot">
          ✕
        </button>
      </header>

      <div className="copilot-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="copilot-empty">
            Ask about any {stationName} facility, alert or runway — e.g. “Why is the water pump in warning?”
          </div>
        )}
        {messages.map((m, i) => (
          <div key={`${m.at}-${i}`} className={`copilot-msg ${m.role}`}>
            <div className="copilot-bubble">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="copilot-chips">
        {QUICK_PROMPTS.map((p) => (
          <button key={p} type="button" className="copilot-chip" onClick={() => send(p)}>
            {p}
          </button>
        ))}
      </div>

      <form
        className="copilot-input-row"
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
      >
        <input
          className="copilot-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ask ${stationName} Intelligence…`}
          aria-label="Copilot query"
        />
        <button type="submit" className="copilot-send" disabled={draft.trim().length === 0}>
          SEND
        </button>
      </form>
    </section>
  )
}

