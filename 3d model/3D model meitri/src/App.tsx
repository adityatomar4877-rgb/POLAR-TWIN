import { useEffect } from 'react'
import { BharatiScene } from './components/3d/BharatiScene'
import { MaitriScene } from './components/3d/maitri/MaitriScene'
import { Overlay } from './components/UI/Overlay'
import { Dashboard } from './components/UI/Dashboard'
import { ModeToolbar } from './components/UI/ModeToolbar'
import { ScenarioSimulator } from './components/UI/ScenarioSimulator'
import { MissionHeader } from './components/UI/MissionHeader'
import { AlertsDrawer } from './components/UI/AlertsDrawer'
import { WhatIfPanel } from './components/UI/WhatIfPanel'
import { SOPModal } from './components/UI/SOPModal'
import { MissionReportModal } from './components/UI/MissionReportModal'
import { MissionCopilot } from './components/UI/MissionCopilot'
import { useKeyboardControls } from './hooks/useKeyboardControls'
import { startMissionClock } from './lib/missionClock'
import { useStationStore } from './lib/stationStore'

export default function App() {
  useKeyboardControls()
  const activeStation = useStationStore((s) => s.activeStation)

  useEffect(() => startMissionClock(), [])

  return (
    <div className="app-root">
      {activeStation === 'bharati' ? <BharatiScene /> : <MaitriScene />}
      <MissionHeader />
      <ModeToolbar />
      <Dashboard />
      <AlertsDrawer />
      <WhatIfPanel />
      <SOPModal />
      <MissionReportModal />
      <MissionCopilot />
      <ScenarioSimulator />
      <Overlay />
    </div>
  )
}
