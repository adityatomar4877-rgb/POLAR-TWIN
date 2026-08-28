import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Bell, Settings, ChevronDown, Globe } from 'lucide-react';
import { useStation } from '../../context/StationContext';
import clsx from 'clsx';

const STATION_META: Record<number, { name: string; region: string; coords: string; elevation: string }> = {
  1: { name: 'MAITRI STATION', region: 'Schirmacher Oasis, Queen Maud Land', coords: "70°46'S, 11°44'E", elevation: '130 m' },
  2: { name: 'BHARATI STATION', region: 'Larsemann Hills, East Antarctica', coords: "69°24'S, 76°12'E", elevation: '32 m' },
};

const greeting = () => {
  const hourIST = Number(
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false })
  );
  if (hourIST < 12) return 'Good Morning';
  if (hourIST < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export default function TopBar() {
  const navigate = useNavigate();
  const { stations, selectedStationId, setSelectedStationId, dashboard } = useStation();
  const [now, setNow] = useState(new Date());
  const prevAlertCount = useRef(0);
  const [bellWobble, setBellWobble] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const meta = STATION_META[selectedStationId] ?? STATION_META[2];
  const activeAlerts = (dashboard?.alerts ?? []).filter((a) => !a.resolved_at && a.is_active !== false);

  /* Trigger bell wobble when alert count changes */
  useEffect(() => {
    const count = activeAlerts.length;
    if (count > prevAlertCount.current) {
      setBellWobble(true);
      const timeout = setTimeout(() => setBellWobble(false), 700);
      return () => clearTimeout(timeout);
    }
    prevAlertCount.current = count;
  }, [activeAlerts.length]);

  const istTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
  const istDate = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <motion.header
      className="relative z-20 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl px-6 py-3.5 lg:px-8 text-slate-800"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Identity block */}
        <div className="min-w-0">
          <motion.p
            className="text-[11px] font-medium text-slate-400"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {greeting()}, Operator
          </motion.p>

          <div className="mt-0.5 flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={selectedStationId}
                onChange={(e) => setSelectedStationId(Number(e.target.value))}
                className="appearance-none bg-transparent text-[24px] font-black tracking-tight text-slate-900 lg:text-[26px] uppercase pr-8 outline-none cursor-pointer"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name.toUpperCase()}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400">
                <ChevronDown size={20} />
              </div>
            </div>

            {/* Animated LIVE badge */}
            <motion.span
              className="flex items-center gap-1.5 rounded-md animate-live-gradient px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.2 }}
            >
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-white"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              LIVE <span className="opacity-70">∿</span>
            </motion.span>
          </div>

          <motion.div
            className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <span className="flex items-center gap-1">
              <MapPin size={11} className="text-slate-400" />
              {meta.region}
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <Globe size={11} className="text-slate-400" />
              {meta.coords}
            </span>
          </motion.div>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          {/* IST clock */}
          <motion.div
            className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.15 }}
          >
            <p className="font-mono text-sm font-bold leading-tight tabular-nums text-slate-800">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={istTime}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -8, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {istTime}
                </motion.span>
              </AnimatePresence>
              {' '}<span className="text-[10px] text-slate-400 font-semibold">IST</span>
            </p>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5">
              {istDate}
            </p>
          </motion.div>

          {/* Operator card */}
          <motion.button
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-3 shadow-xs cursor-pointer"
            whileHover={{ scale: 1.03, borderColor: '#cbd5e1' }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xs font-black text-slate-700">
              👨‍🔬
            </div>
            <div className="hidden text-left leading-tight md:block">
              <span className="block text-xs font-semibold text-slate-700">Operator</span>
              <span className="block text-[10px] text-slate-400 font-medium">Research Team</span>
            </div>
            <ChevronDown size={12} className="text-slate-400" />
          </motion.button>

          {/* Notifications */}
          <motion.button
            onClick={() => navigate('/operations')}
            title="Alerts & events"
            className={clsx(
              'relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-xs cursor-pointer',
              bellWobble && 'animate-wobble'
            )}
            whileHover={{ scale: 1.08, borderColor: '#cbd5e1' }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Bell size={15} />
            <motion.span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.4 }}
            >
              {activeAlerts.length > 0 ? activeAlerts.length : 7}
            </motion.span>
          </motion.button>

          {/* Settings */}
          <motion.button
            title="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-xs cursor-pointer"
            whileHover={{ scale: 1.08, rotate: 45, borderColor: '#cbd5e1' }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <Settings size={15} />
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
}
