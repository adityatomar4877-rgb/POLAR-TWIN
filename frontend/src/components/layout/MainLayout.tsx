import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useWebSocket } from '../../hooks/useWebSocket';

export const MainLayout = ({ currentStationId }: { currentStationId: number }) => {
  // Global WebSocket connection for the active station
  const { isConnected, lastMessageTime } = useWebSocket(currentStationId);

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden text-slate-200">
      <Sidebar />
      
      <div className="flex flex-col flex-1 min-w-0">
        <Header currentStationId={currentStationId} />
        
        <main className="flex-1 overflow-auto p-4 md:p-6 relative">
          {/* Main content injected here by router */}
          <Outlet />
        </main>
        
        {/* Global Footer / Status Bar */}
        <footer className="h-8 border-t border-slate-800 bg-slate-950 flex items-center px-4 text-xs font-mono text-slate-500 justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
              {isConnected ? 'SECURE_LINK_ACTIVE' : 'LINK_OFFLINE'}
            </span>
            <span>|</span>
            <span>PING: &lt;45ms</span>
          </div>
          <div className="flex items-center gap-4">
            <span>STATION: {currentStationId === 1 ? 'MAITRI' : 'BHARATI'}</span>
            <span>|</span>
            <span>LAST_SYNC: {lastMessageTime ? lastMessageTime.toLocaleTimeString() : 'AWAITING'}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
