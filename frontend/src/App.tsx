import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { CommandCenter } from './pages/CommandCenter';
import { EnergySystems } from './pages/EnergySystems';
import { Environment } from './pages/Environment';
import { Infrastructure } from './pages/Infrastructure';
import { Logistics } from './pages/Logistics';
import { Operations } from './pages/Operations';

function App() {
  // Hardcoded to Bharati (ID 2) for the Generator Failure demo scenario
  const [currentStationId] = useState<number>(2);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout currentStationId={currentStationId} />}>
          <Route index element={<CommandCenter stationId={currentStationId} />} />
          <Route path="energy" element={<EnergySystems stationId={currentStationId} />} />
          <Route path="environment" element={<Environment stationId={currentStationId} />} />
          <Route path="infrastructure" element={<Infrastructure stationId={currentStationId} />} />
          <Route path="logistics" element={<Logistics stationId={currentStationId} />} />
          <Route path="operations" element={<Operations stationId={currentStationId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
