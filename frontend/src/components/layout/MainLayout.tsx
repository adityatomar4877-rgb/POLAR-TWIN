import { useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import TopBar from './TopBar';
import EmergencyModeHUD from '../emergency/EmergencyModeHUD';
import { useStation } from '../../context/StationContext';
import { useLenisScroll } from '../../hooks/useLenisScroll';

export const MainLayout = () => {
  const { dashboard, emergencyModeActive } = useStation();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const lenisRef = useLenisScroll({
    wrapperRef: mainRef,
    contentRef: contentRef,
    lerp: 0.1,
    wheelMultiplier: 1.1,
  });

  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    } else if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname, lenisRef]);

  const gridEmergency =
    dashboard?.energy?.grid_status?.toUpperCase() === 'EMERGENCY' ||
    dashboard?.energy?.grid_status?.toUpperCase() === 'CRITICAL';

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-slate-950 text-slate-800">
      {/* Dashboard photo background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/polar-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-slate-900/25" />
      </div>

      <div className="relative z-10 flex h-full">
        <Sidebar />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main
          ref={mainRef}
          className="custom-scrollbar relative flex-1 overflow-y-auto px-6 pb-6 pt-5 lg:px-8"
        >
          <div ref={contentRef}>
            {/* Route transitions — smooth crossfade + rise between workspaces */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Main content injected here by router */}
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Emergency operational HUD overlay */}
      {(emergencyModeActive || gridEmergency) && <EmergencyModeHUD />}
    </div>
  );
};
