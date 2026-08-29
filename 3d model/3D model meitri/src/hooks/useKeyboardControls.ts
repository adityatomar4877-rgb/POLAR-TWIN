import { useEffect } from 'react'
import { STATION_SYSTEMS } from '../lib/stationSystems'
import { useStationStore } from '../lib/stationStore'


/**
 * Phase 3 keyboard layer:
 * - Tab / ArrowRight / ArrowDown  -> next station system
 * - Shift+Tab / ArrowLeft / ArrowUp -> previous station system
 * - 1..7 -> jump directly to a facility
 * - Escape -> clear selection and glide back to the overview
 */
export function useKeyboardControls() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const store = useStationStore.getState()
      
      const activeStation = store.activeStation
      const activeSystems = STATION_SYSTEMS.filter(s => 
        activeStation === 'bharati' ? s.id.startsWith('Bharati') : s.id.startsWith('Maitri')
      )
      const activeSystemIds = activeSystems.map(s => s.id)
      
      const currentIdx = store.selectedSystemId ? activeSystemIds.indexOf(store.selectedSystemId) : -1

      if (e.code === 'Escape') {
        // Close the top-most overlay first, then clear the selection.
        if (store.sopModalId !== null) store.openSopModal(null)
        else if (store.reportOpen) store.toggleReport(false)
        else if (store.whatIfOpen) store.toggleWhatIf(false)
        else if (store.alertsOpen) store.toggleAlertsDrawer(false)
        else if (store.copilotOpen) store.toggleCopilot(false)
        else store.clearSelection()
        return
      }

      switch (e.code) {
        case 'Tab':
        case 'ArrowRight':
        case 'ArrowDown': {
          e.preventDefault()
          store.selectSystem(activeSystemIds[(currentIdx + 1) % activeSystemIds.length])
          return
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          e.preventDefault()
          store.selectSystem(activeSystemIds[(currentIdx - 1 + activeSystemIds.length) % activeSystemIds.length])
          return
        }
        default: {
          const match = /^(?:Digit|Numpad)([1-7])$/.exec(e.code)
          if (match) {
            const index = Number(match[1]) - 1
            if (index < activeSystemIds.length) {
              store.selectSystem(activeSystemIds[index])
            }
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
