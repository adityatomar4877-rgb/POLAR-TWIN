import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import {
  Home,
  CloudRain,
  Zap,
  Building2,
  Truck,
  Wifi,
  Bot,
  Bell,
  TrendingUp,
  FlaskConical,
  ClipboardList,
  Wrench,
  Package,
  History,
  Mountain,
  ChevronLeft,
} from 'lucide-react';
import clsx from 'clsx';
import { useStation } from '../../context/StationContext';

interface NavItem {
  name: string;
  path: string;
  icon: typeof Home;
}

const GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'MISSION',
    items: [
      { name: 'Overview', path: '/', icon: Home },
      { name: 'Mission Brief', path: '/landing', icon: ClipboardList },
    ],
  },
  {
    label: 'MONITORING',
    items: [
      { name: 'Environment', path: '/environment', icon: CloudRain },
      { name: 'Energy', path: '/energy', icon: Zap },
      { name: 'Infrastructure', path: '/infrastructure', icon: Building2 },
      { name: 'Logistics', path: '/logistics', icon: Truck },
      { name: 'Communications', path: '/comms', icon: Wifi },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { name: 'AI Copilot', path: '/copilot', icon: Bot },
      { name: 'Alerts & Events', path: '/operations', icon: Bell },
      { name: 'Predictions', path: '/predictions', icon: TrendingUp },
      { name: 'What-If Simulation', path: '/simulation', icon: FlaskConical },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Tasks', path: '/tasks', icon: ClipboardList },
      { name: 'Maintenance', path: '/maintenance', icon: Wrench },
      { name: 'Resupply', path: '/resupply', icon: Package },
      { name: 'Command History', path: '/audit', icon: History },
    ],
  },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { lastSyncAt } = useStation();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const prevCollapsed = useRef(collapsed);

  /* Stagger-animate group labels when expanding */
  useEffect(() => {
    if (prevCollapsed.current && !collapsed && navRef.current) {
      const labels = navRef.current.querySelectorAll('.nav-group-label');
      gsap.fromTo(
        labels,
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.35, stagger: 0.05, ease: 'power2.out', delay: 0.15 }
      );
    }
    prevCollapsed.current = collapsed;
  }, [collapsed]);

  return (
    <aside
      className={clsx(
        'relative flex h-full shrink-0 flex-col bg-white border-r border-slate-200 text-slate-600 z-30',
        'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        collapsed ? 'w-[72px]' : 'w-[220px]'
      )}
    >
      {/* Logo */}
      <div className={clsx('flex items-center gap-3 border-b border-slate-100 px-4 py-4', collapsed && 'justify-center px-0')}>
        <motion.div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100"
          whileHover={{ scale: 1.08, rotate: 3 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <Mountain size={20} className="text-blue-600" />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              className="leading-tight overflow-hidden"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[12px] font-extrabold tracking-wider text-slate-900 leading-[1.15] whitespace-nowrap">
                ANTARCTIC
                <br />
                DIGITAL TWIN
              </p>
              <p className="mt-0.5 text-[7px] font-bold tracking-[0.18em] text-blue-500/80 whitespace-nowrap">
                REMOTE OPERATIONS CENTER
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav groups */}
      <nav ref={navRef} className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar space-y-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  className="nav-group-label mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isItemActive =
                  item.path === '/'
                    ? location.pathname === '/' || location.pathname === '/command'
                    : location.pathname === item.path;

                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    title={collapsed ? item.name : undefined}
                    className="relative"
                  >
                    <motion.div
                      className={clsx(
                        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium',
                        'transition-colors duration-200',
                        isItemActive
                          ? 'text-blue-700 font-bold'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                      whileHover={!isItemActive ? { x: 2 } : undefined}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      {/* Active background pill with layoutId animation */}
                      {isItemActive && (
                        <motion.div
                          layoutId="sidebar-active-pill"
                          className="absolute inset-0 rounded-lg bg-blue-50"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                          style={{ zIndex: 0 }}
                        />
                      )}

                      <motion.div
                        className="relative z-10"
                        whileHover={{ scale: 1.15 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      >
                        <item.icon
                          size={15}
                          className={clsx('shrink-0', isItemActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500')}
                        />
                      </motion.div>

                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            className="relative z-10 truncate"
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -4 }}
                            transition={{ duration: 0.2 }}
                          >
                            {item.name}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {collapsed && (
                        <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          {item.name}
                        </span>
                      )}
                    </motion.div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System status */}
      <div className={clsx('px-3 pb-2', collapsed && 'px-2')}>
        <motion.div
          className={clsx(
            'rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200',
            collapsed && 'flex justify-center p-2'
          )}
          initial={false}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {collapsed ? (
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)] animate-data-pulse" title="All systems nominal" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-glow-breathe" />
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  SYSTEM STATUS
                </span>
              </div>
              <p className="mt-1 text-[12px] font-bold text-emerald-600">ALL SYSTEMS NOMINAL</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Last updated:{' '}
                {lastSyncAt
                  ? lastSyncAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
                  : '16:42'}{' '}
                IST
              </p>
            </>
          )}
        </motion.div>
      </div>

      {/* Collapse toggle */}
      <motion.button
        onClick={() => setCollapsed((c) => !c)}
        className={clsx(
          'flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-700 hover:bg-slate-50 cursor-pointer',
          collapsed && 'justify-center px-0'
        )}
        whileHover={{ backgroundColor: 'rgba(241,245,249,1)' }}
        whileTap={{ scale: 0.97 }}
      >
        <motion.div
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <ChevronLeft size={14} />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              Collapse
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </aside>
  );
};
