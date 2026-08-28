import { memo } from 'react';
import { Ship, Radio, Compass, Navigation } from 'lucide-react';

export const StationAmbientBackground = memo(function StationAmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#f1f5f9] select-none">
      {/* Subtle polar tech grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.3) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Floating animated mesh gradient blobs */}
      <div className="absolute inset-0 overflow-hidden opacity-60">
        <div className="absolute -top-[10%] -left-[10%] h-[600px] w-[600px] animate-blob rounded-full bg-sky-200/40 mix-blend-multiply blur-3xl filter" />
        <div className="absolute top-[20%] -right-[10%] h-[700px] w-[700px] animate-blob rounded-full bg-cyan-200/40 mix-blend-multiply blur-3xl filter" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-[20%] left-[20%] h-[800px] w-[800px] animate-blob rounded-full bg-indigo-200/30 mix-blend-multiply blur-3xl filter" style={{ animationDelay: '4s' }} />
      </div>

      {/* Polar Coordinate HUD Watermark */}
      <div className="absolute bottom-6 right-8 hidden lg:flex flex-col items-end opacity-40 font-mono text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5 font-bold tracking-widest text-slate-700">
          <Compass size={12} className="text-blue-500 animate-spin" style={{ animationDuration: '40s' }} />
          ANTARCTICA SECTOR 4 · QUEEN MAUD LAND
        </div>
        <div className="tracking-wider mt-0.5 font-semibold text-slate-600">LAT: 70°46′00″S · LON: 11°44′00″E · ELEV: 130m</div>
      </div>

      {/* Animated Polar Research Vessel (R/V Bharati & Maritime Route) */}
      <div className="absolute bottom-16 left-24 hidden xl:flex items-center gap-3 opacity-50">
        <div className="relative flex items-center justify-center">
          {/* Radar ripple rings */}
          <span className="absolute h-8 w-8 rounded-full border border-blue-400 opacity-60 animate-ping" />
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 border border-blue-300 text-blue-700 shadow-2xs">
            <Ship size={14} />
          </div>
        </div>
        <div className="font-mono text-[10px] text-slate-700">
          <span className="font-bold text-slate-900 flex items-center gap-1">
            <Navigation size={10} className="text-blue-600" /> R/V BHARATI (ICE CLASS A1)
          </span>
          <span className="text-slate-500 font-medium">Voyage transit · Southern Ocean Sector</span>
        </div>
      </div>

      {/* Station Comms Satellite Link Watermark */}
      <div className="absolute top-20 right-28 hidden xl:flex items-center gap-2 opacity-40 font-mono text-[10px] text-slate-600 font-bold">
        <Radio size={12} className="text-blue-600 animate-pulse" />
        <span>GSAT-7 POLAR RELAY · ORBIT ELEV 38.4° · ACTIVE</span>
      </div>

      {/* Subtle topographic contour line watermark in bottom corner */}
      <svg
        className="absolute -bottom-10 -right-10 w-[500px] h-[400px] opacity-[0.04] text-slate-900 pointer-events-none"
        viewBox="0 0 400 300"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M 0,220 Q 100,160 200,210 T 400,180" />
        <path d="M 0,240 Q 120,180 220,230 T 400,200" />
        <path d="M 0,260 Q 140,200 240,250 T 400,220" />
        <path d="M 0,280 Q 160,220 260,270 T 400,240" />
        <path d="M 0,300 Q 180,240 280,290 T 400,260" />
      </svg>
    </div>
  );
});

export default StationAmbientBackground;
