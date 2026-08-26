import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import TopBar from './TopBar';
import EmergencyModeHUD from '../emergency/EmergencyModeHUD';
import { useStation } from '../../context/StationContext';

export const MainLayout = () => {
  const { dashboard, emergencyModeActive } = useStation();

  const gridEmergency =
    dashboard?.energy?.grid_status?.toUpperCase() === 'EMERGENCY' ||
    dashboard?.energy?.grid_status?.toUpperCase() === 'CRITICAL';

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-slate-950 text-slate-800">
      {/* Dashboard photo background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{ backgroundImage: "url('/polar-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" />
      </div>

      <div className="relative z-10 flex h-full">
        <Sidebar />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="custom-scrollbar relative flex-1 overflow-y-auto px-6 pb-6 pt-5 lg:px-8">
          {/* Main content injected here by router */}
          <Outlet />
        </main>
      </div>

      {/* Emergency operational HUD overlay */}
      {(emergencyModeActive || gridEmergency) && <EmergencyModeHUD />}
    </div>
  );
};
