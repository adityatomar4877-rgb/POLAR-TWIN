import { NavLink } from 'react-router-dom';
import { 
  Zap, 
  CloudRain, 
  Settings, 
  ShieldAlert, 
  Package, 
  LayoutDashboard,
  Radio
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const navItems = [
  { name: 'Command Center', path: '/', icon: LayoutDashboard },
  { name: 'Energy Systems', path: '/energy', icon: Zap },
  { name: 'Environment', path: '/environment', icon: CloudRain },
  { name: 'Infrastructure', path: '/infrastructure', icon: Settings },
  { name: 'Logistics', path: '/logistics', icon: Package },
  { name: 'Operations & Alerts', path: '/operations', icon: ShieldAlert },
];

export const Sidebar = () => {
  return (
    <aside className="w-16 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 transition-all duration-300">
      <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800">
        <Radio className="text-cyan-400 w-6 h-6 animate-pulse" />
        <span className="ml-3 font-bold tracking-widest text-sm text-slate-100 hidden md:block">
          POLAR-TWIN
        </span>
      </div>
      
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2 md:px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              twMerge(
                clsx(
                  "flex items-center px-3 py-3 rounded-md transition-colors duration-200 group relative",
                  isActive 
                    ? "bg-slate-800/80 text-cyan-400" 
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                )
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={clsx("w-5 h-5 shrink-0", isActive && "drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]")} />
                <span className="ml-3 font-medium text-sm hidden md:block">
                  {item.name}
                </span>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-400 rounded-r-md hidden md:block" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-slate-800 hidden md:block">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">System Status</div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
          ALL SYSTEMS NOMINAL
        </div>
      </div>
    </aside>
  );
};
