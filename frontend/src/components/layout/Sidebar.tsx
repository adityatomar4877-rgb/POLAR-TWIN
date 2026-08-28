import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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

  return (
    <aside
      className={clsx(
        'relative flex h-full shrink-0 flex-col bg-white border-r border-slate-200 text-slate-600 transition-all duration-300 z-30',
        collapsed ? 'w-[72px]' : 'w-[220px]'
      )}
    >
      {/* Logo */}
      <div className={clsx('flex items-center gap-3 border-b border-slate-100 px-4 py-4', collapsed && 'justify-center px-0')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
          <Mountain size={20} className="text-blue-600" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-[12px] font-extrabold tracking-wider text-slate-900 leading-[1.15]">
              ANTARCTIC
              <br />
              DIGITAL TWIN
            </p>
            <p className="mt-0.5 text-[7px] font-bold tracking-[0.18em] text-blue-500/80">
              REMOTE OPERATIONS CENTER
            </p>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar space-y-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {group.label}
              </p>
            )}
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
                    className={
                      clsx(
                        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-200',
                        isItemActive
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                      )
                    }
                  >
                    <item.icon
                      size={15}
                      className={clsx('shrink-0', isItemActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500')}
                    />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        {item.name}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System status */}
      <div className={clsx('px-3 pb-2', collapsed && 'px-2')}>
        <div
          className={clsx(
            'rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200',
            collapsed && 'flex justify-center p-2'
          )}
        >
          {collapsed ? (
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" title="All systems nominal" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
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
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={clsx(
          'flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-700 hover:bg-slate-50 cursor-pointer',
          collapsed && 'justify-center px-0'
        )}
      >
        <ChevronLeft size={14} className={clsx('transition-transform duration-300', collapsed && 'rotate-180')} />
        {!collapsed && 'Collapse'}
      </button>
    </aside>
  );
};
