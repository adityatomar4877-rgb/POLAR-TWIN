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
  const [stationMenuOpen, setStationMenuOpen] = useState(false);
  const stationMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const meta = STATION_META[selectedStationId] ?? STATION_META[2];
  const activeAlerts = (dashboard?.alerts ?? []).filter((a) => !a.resolved_at && a.is_active !== false);

  /* Close the station dropdown on outside click / Escape */
  useEffect(() => {
    if (!stationMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (stationMenuRef.current && !stationMenuRef.current.contains(e.target as Node)) {
        setStationMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStationMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [stationMenuOpen]);

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
            <div className="relative" ref={stationMenuRef}>
              <button
                onClick={() => setStationMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-[24px] font-black tracking-tight text-slate-900 uppercase outline-none cursor-pointer transition-colors hover:text-cyan-700 lg:text-[26px]"
              >
                {(stations.find((s) => s.id === selectedStationId)?.name ?? meta.name).toUpperCase().replace(' STATION', '')}
                <ChevronDown
                  size={20}
                  className={clsx('text-slate-400 transition-transform duration-200', stationMenuOpen && 'rotate-180')}
                />
              </button>
              <AnimatePresence>
                {stationMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-2xl border border-white/50 bg-white/85 p-2 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Antarctic Research Stations
                    </div>
                    {stations.map((s) => {
                      const m = STATION_META[s.id] ?? STATION_META[2];
                      const active = s.id === selectedStationId;
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelectedStationId(s.id);
                            setStationMenuOpen(false);
                          }}
                          className={clsx(
                            'group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer',
                            active
                              ? 'border-cyan-300 bg-cyan-50/70'
                              : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                          )}
                        >
                          <span
                            className={clsx(
                              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black',
                              active
                                ? 'border-cyan-400 bg-cyan-100 text-cyan-700'
                                : 'border-slate-200 bg-slate-50 text-slate-500',
                            )}
                          >
                            {s.code?.slice(0, 3) ?? s.id}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold uppercase tracking-tight text-slate-900">
                                {s.name.replace(' Station', '')}
                              </span>
                              {active && (
                                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">{m.region}</p>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Globe size={9} /> {m.coords}
                              </span>
                              <span>Elev {m.elevation}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
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
          {/* IST clock — fixed width so seconds increment never jitters the box */}
          <motion.div
            className="hidden w-[145px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.15 }}
          >
            <p className="font-mono text-sm font-bold leading-tight tabular-nums text-slate-800">
              <span className="inline-block w-[68px] text-right tabular-nums">{istTime}</span>
              {' '}<span className="text-[10px] text-slate-400 font-semibold">IST</span>
            </p>
            <p className="mt-0.5 text-[10px] font-medium tabular-nums text-slate-400">
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
