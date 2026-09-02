import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StationProvider, useStation } from './context/StationContext';
import { MainLayout } from './components/layout/MainLayout';
import Landing from './pages/Landing';
import { CommandCenter } from './pages/CommandCenter';
import { EnergySystems } from './pages/EnergySystems';
import { Environment } from './pages/Environment';
import { Infrastructure } from './pages/Infrastructure';
import { Logistics } from './pages/Logistics';
import { Operations } from './pages/Operations';
import CopilotPage from './pages/CopilotPage';
import PredictionsPage from './pages/PredictionsPage';
import SimulationPage from './pages/SimulationPage';
import AuditPage from './pages/AuditPage';
import CommsPage from './pages/CommsPage';
import TasksPage from './pages/TasksPage';
import MaintenancePage from './pages/MaintenancePage';

/** Injects the globally selected station id into a workspace page. */
function Stationed({ render }: { render: (stationId: number) => ReactNode }) {
  const { selectedStationId } = useStation();
  return <>{render(selectedStationId)}</>;
}

function App() {
  return (
    <StationProvider>
      <BrowserRouter>
        <Routes>
          {/* Optional cinematic landing narrative */}
          <Route path="/landing" element={<Landing />} />

          {/* Operational workspaces — root directly opens the operations dashboard */}
          <Route element={<MainLayout />}>
            <Route
              path="/"
              element={<Stationed render={(id) => <CommandCenter stationId={id} />} />}
            />
            <Route
              path="/command"
              element={<Stationed render={(id) => <CommandCenter stationId={id} />} />}
            />
            <Route
              path="/energy"
              element={<Stationed render={(id) => <EnergySystems stationId={id} />} />}
            />
            <Route
              path="/environment"
              element={<Stationed render={(id) => <Environment stationId={id} />} />}
            />
            <Route
              path="/infrastructure"
              element={<Stationed render={(id) => <Infrastructure stationId={id} />} />}
            />
            <Route
              path="/logistics"
              element={<Stationed render={(id) => <Logistics stationId={id} />} />}
            />
            <Route
              path="/operations"
              element={<Stationed render={(id) => <Operations stationId={id} />} />}
            />
            <Route path="/copilot" element={<CopilotPage />} />
            <Route
              path="/predictions"
              element={<Stationed render={(id) => <PredictionsPage stationId={id} />} />}
            />
            <Route
              path="/simulation"
              element={<Stationed render={(id) => <SimulationPage stationId={id} />} />}
            />
            <Route path="/comms" element={<CommsPage />} />
            <Route
              path="/tasks"
              element={<Stationed render={(id) => <TasksPage stationId={id} />} />}
            />
            <Route
              path="/maintenance"
              element={<Stationed render={(id) => <MaintenancePage stationId={id} />} />}
            />
            <Route
              path="/resupply"
              element={<Stationed render={(id) => <Logistics stationId={id} />} />}
            />
            <Route
              path="/audit"
              element={<Stationed render={(id) => <AuditPage stationId={id} />} />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StationProvider>
  );
}

export default App;
