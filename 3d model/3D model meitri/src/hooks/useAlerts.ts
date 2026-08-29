import { useStationStore } from '../lib/stationStore'

/** Active alerts + recent log with acknowledge / mute / drawer actions. */
export function useAlerts() {
  const alerts = useStationStore((s) => s.alerts)
  const alertLog = useStationStore((s) => s.alertLog)
  const alertsOpen = useStationStore((s) => s.alertsOpen)
  const acknowledgeAlert = useStationStore((s) => s.acknowledgeAlert)
  const muteAlert = useStationStore((s) => s.muteAlert)
  const toggleAlertsDrawer = useStationStore((s) => s.toggleAlertsDrawer)
  const selectSystem = useStationStore((s) => s.selectSystem)

  const locateIn3d = (systemId: string) => {
    selectSystem(systemId)
    toggleAlertsDrawer(false)
  }

  return {
    alerts,
    alertLog,
    alertsOpen,
    acknowledgeAlert,
    muteAlert,
    toggleAlertsDrawer,
    locateIn3d,
  }
}
