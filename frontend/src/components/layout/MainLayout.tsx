import { useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import TopBar from './TopBar';
import StationAmbientBackground from './StationAmbientBackground';
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
    lerp: 0.075,
    wheelMultiplier: 0.95,
  });

  /* Instant scroll-to-top on route change */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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
    <div className="relative flex h-screen w-full overflow-hidden bg-slate-100 text-slate-800">
      {/* Clean high-tech Station Ambient Background with animated ship & telemetry */}
      <StationAmbientBackground />

      <div className="relative z-10 flex h-full">
        <Sidebar />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main
          ref={mainRef}
          className="custom-scrollbar relative flex-1 overflow-y-auto px-6 pb-6 pt-5 lg:px-8"
        >
          <div ref={contentRef} className="animate-in fade-in duration-150">
            {/* Main workspace content injected here by router */}
            <Outlet />
          </div>
        </main>
      </div>

      {/* Emergency operational HUD overlay */}
      <AnimatePresence>
        {(emergencyModeActive || gridEmergency) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <EmergencyModeHUD />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
