import { useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import gsap from 'gsap';
import { Sidebar } from './Sidebar';
import TopBar from './TopBar';
import StationAmbientBackground from './StationAmbientBackground';
import EmergencyModeHUD from '../emergency/EmergencyModeHUD';
import { useStation } from '../../context/StationContext';
import { useLenisScroll } from '../../hooks/useLenisScroll';

const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 18,
    filter: 'blur(4px)',
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      filter: { duration: 0.35 },
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: 'blur(3px)',
    scale: 0.998,
    transition: {
      duration: 0.22,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export const MainLayout = () => {
  const { dashboard, emergencyModeActive } = useStation();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const lenisRef = useLenisScroll({
    wrapperRef: mainRef,
    contentRef: contentRef,
    lerp: 0.075,
    wheelMultiplier: 0.95,
  });

  /* Smooth scroll-to-top on route change via GSAP */
  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: false, duration: 0.6 });
    } else if (mainRef.current) {
      gsap.to(mainRef.current, { scrollTop: 0, duration: 0.4, ease: 'power2.out' });
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
          <div ref={contentRef}>
            {/* Route transitions — smooth crossfade + rise + blur between workspaces */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                variants={reduced ? undefined : pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {/* Main content injected here by router */}
                <Outlet />
              </motion.div>
            </AnimatePresence>
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
