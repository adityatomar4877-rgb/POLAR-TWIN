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
    label: 'Mission',
    items: [
      { name: 'Overview', path: '/', icon: Home },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { name: 'Environment', path: '/environment', icon: CloudRain },
      { name: 'Energy', path: '/energy', icon: Zap },
      { name: 'Infrastructure', path: '/infrastructure', icon: Building2 },
      { name: 'Logistics', path: '/logistics', icon: Truck },
      { name: 'Communications', path: '/comms', icon: Wifi },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { name: 'AI Copilot', path: '/copilot', icon: Bot },
      { name: 'Alerts & Events', path: '/operations', icon: Bell },
      { name: 'Predictions', path: '/predictions', icon: TrendingUp },
      { name: 'What-If Simulation', path: '/simulation', icon: FlaskConical },
    ],
  },
  {
    label: 'Operations',
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
  const { lastSyncAt, dashboard } = useStation();
  const location = useLocation();

  return (
    <aside
      className={clsx(
        'relative flex h-full shrink-0 flex-col bg-[#0b1329] text-slate-300 transition-all duration-300',
        collapsed ? 'w-[76px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={clsx('flex items-center gap-3 border-b border-white/[0.06] px-5 py-5', collapsed && 'justify-center px-0')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 ring-1 ring-white/10">
          <Mountain size={19} className="text-cyan-300" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-[13px] font-extrabold tracking-wide text-white">
              ANTARCTIC
              <br />
              DIGITAL TWIN
            </p>
            <p className="mt-1 text-[8px] font-semibold tracking-[0.22em] text-slate-500">
              REMOTE OPERATIONS CENTER
            </p>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 theme-dark custom-scrollbar">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
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
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                        isItemActive
                          ? 'bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/25'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                      )
                    }
                  >
                    <item.icon
                      size={17}
                      className={clsx('shrink-0', isItemActive ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300')}
                    />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity group-hover:opacity-100">
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
            'rounded-xl bg-white/[0.04] p-3.5 ring-1 ring-white/[0.06]',
            collapsed && 'flex justify-center p-2.5'
          )}
        >
          {collapsed ? (
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" title="All systems nominal" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  System Status
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-bold text-emerald-400">ALL SYSTEMS NOMINAL</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Last updated:{' '}
                {lastSyncAt
                  ? lastSyncAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
                  : '—'}{' '}
                IST
              </p>
              {dashboard?.station?.code && (
                <p className="mt-0.5 text-[10px] text-slate-600">SYNC: {dashboard.station.code.toUpperCase()}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={clsx(
          'flex items-center gap-2 border-t border-white/[0.06] px-5 py-3.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-300',
          collapsed && 'justify-center px-0'
        )}
      >
        <ChevronLeft size={16} className={clsx('transition-transform duration-300', collapsed && 'rotate-180')} />
        {!collapsed && 'Collapse'}
      </button>
    </aside>
  );
};
