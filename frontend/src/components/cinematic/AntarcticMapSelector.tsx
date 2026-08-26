import { useMemo } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MapPin, Navigation, Thermometer, Wind } from 'lucide-react';

interface Props {
  selectedStationId: number | null;
  onSelect: (stationId: number) => void;
}

/* South-polar azimuthal projection helpers ------------------------------ */

const VIEW = 620;
const CX = VIEW / 2;
const CY = VIEW / 2;
const MAX_R = 258;

function project(lat: number, lon: number): [number, number] {
  const r = ((lat + 90) / 90) * MAX_R;
  const rad = (lon * Math.PI) / 180;
  return [CX + r * Math.sin(rad), CY + r * Math.cos(rad)];
}

/** Approximate Antarctic coastline anchors [lat, lon] going clockwise. */
const COASTLINE: Array<[number, number]> = [
  [-66, 0], [-69, 20], [-70, 45], [-68.7, 70], [-66.8, 100], [-66, 130],
  [-67, 150], [-68, 168], [-70.5, 176], [-74, 186], [-77.5, 192],
  [-76, 202], [-73, 214], [-70.5, 226], [-72.5, 240], [-75, 255],
  [-73.5, 272], [-70, 285], [-66, 296], [-63, 305], [-64.5, 312],
  [-68, 306], [-71.5, 296], [-74.5, 288], [-78, 282], [-76, 272],
  [-73.5, 264], [-71, 248], [-70, 232], [-70.5, 215], [-68.5, 195],
];

function catmullRomPath(points: Array<[number, number]>): string {
  const n = points.length;
  if (n < 3) return '';
  const get = (i: number) => points[(i + n) % n];
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
}

export interface StationGeoInfo {
  id: number;
  name: string;
  region: string;
  lat: number;
  lon: number;
  established: number;
  distanceFromIndiaKm: string;
  summerTempC: number;
  winterTempC: number;
  peakWindKmh: number;
}

export const STATION_GEO: Record<number, StationGeoInfo> = {
  1: {
    id: 1,
    name: 'MAITRI',
    region: 'Schirmacher Oasis',
    lat: -70.77,
    lon: 11.73,
    established: 1989,
    distanceFromIndiaKm: '≈ 10,930 KM FROM GOA',
    summerTempC: -2,
    winterTempC: -18,
    peakWindKmh: 98,
  },
  2: {
    id: 2,
    name: 'BHARATI',
    region: 'Larsemann Hills',
    lat: -69.41,
    lon: 76.16,
    established: 2012,
    distanceFromIndiaKm: '≈ 11,650 KM FROM GOA',
    summerTempC: 1,
    winterTempC: -16,
    peakWindKmh: 112,
  },
};

export default function AntarcticMapSelector({ selectedStationId, onSelect }: Props) {
  const coastPath = useMemo(() => catmullRomPath(COASTLINE.map(([la, lo]) => project(la, lo))), []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 lg:flex-row lg:gap-14">
      {/* Vector map */}
      <div className="relative aspect-square w-full max-w-[520px] shrink-0">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="h-full w-full">
          <defs>
            <radialGradient id="oceanGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0b1329" />
              <stop offset="78%" stopColor="#0d1830" />
              <stop offset="100%" stopColor="#060b1a" />
            </radialGradient>
            <linearGradient id="landGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#152742" />
            </linearGradient>
          </defs>

          <circle cx={CX} cy={CY} r={MAX_R + 34} fill="url(#oceanGrad)" stroke="#22d3ee22" strokeWidth="1" />

          {/* Latitude rings */}
          {[-85, -80, -75, -70].map((lat) => (
            <circle
              key={lat}
              cx={CX}
              cy={CY}
              r={((lat + 90) / 90) * MAX_R}
              fill="none"
              stroke="#22d3ee"
              strokeOpacity={0.12}
              strokeWidth="0.7"
              strokeDasharray="3 5"
            />
          ))}

          {/* Longitude spokes every 30° */}
          {Array.from({ length: 12 }, (_, i) => i * 30).map((lonDeg) => {
            const [ex, ey] = project(-61, lonDeg);
            return (
              <line
                key={lonDeg}
                x1={CX}
                y1={CY}
                x2={ex}
                y2={ey}
                stroke="#22d3ee"
                strokeOpacity={0.07}
                strokeWidth="0.7"
              />
            );
          })}

          {/* Continent */}
          <path d={coastPath} fill="url(#landGrad)" stroke="#67e8f9" strokeOpacity={0.55} strokeWidth="1.4" />

          {/* Pole marker */}
          <circle cx={CX} cy={CY} r={3} fill="#94a3b8" fillOpacity={0.7} />
          <text x={CX + 8} y={CY + 4} fill="#64748b" fontSize="11" fontFamily="monospace" letterSpacing="2">
            S.POLE
          </text>

          {/* Station markers */}
          {[STATION_GEO[1], STATION_GEO[2]].map((s) => {
            const [px, py] = project(s.lat, s.lon);
            const active = selectedStationId === s.id;
            return (
              <g
                key={s.id}
                transform={`translate(${px} ${py})`}
                className="cursor-pointer"
                onClick={() => onSelect(s.id)}
              >
                {active && (
                  <>
                    <circle r="26" fill="none" stroke="#22d3ee" strokeWidth="1.2" strokeOpacity="0.5">
                      <animate attributeName="r" values="10;30" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.6;0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
                <circle r={active ? 9 : 6.5} fill={active ? '#22d3ee' : '#38bdf8'} fillOpacity={active ? 0.95 : 0.55} />
                <circle r="2.2" fill="#04121f" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Station selection cards */}
      <div className="flex w-full max-w-md flex-col gap-4">
        {[STATION_GEO[1], STATION_GEO[2]].map((s) => {
          const active = selectedStationId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={twMerge(
                clsx(
                  'group relative overflow-hidden rounded-xl border p-5 text-left transition-all duration-500',
                  active
                    ? 'border-cyan-400/60 bg-cyan-400/[0.07] border-glow-cyan'
                    : 'border-slate-700/50 bg-slate-900/40 hover:border-cyan-400/30 hover:bg-slate-900/60'
                )
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-mono text-xl font-bold tracking-widest text-white">
                    <MapPin size={17} className={active ? 'text-cyan-300' : 'text-slate-400'} />
                    {s.name}
                  </div>
                  <div className="mt-1 font-mono text-xs tracking-wider text-cyan-200/70">{s.region.toUpperCase()}</div>
                </div>
                <div
                  className={clsx(
                    'rounded px-2 py-1 font-mono text-[10px] tracking-widest',
                    active ? 'bg-cyan-400/15 text-cyan-300' : 'bg-slate-800 text-slate-400'
                  )}
                >
                  EST. {s.established}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 font-mono text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Navigation size={12} className="text-slate-500" /> {Math.abs(s.lat)}°S {s.lon.toFixed(1)}°E
                </span>
                <span className="flex items-center gap-1.5">
                  <Thermometer size={12} className="text-slate-500" /> {s.summerTempC}° / {s.winterTempC}°C
                </span>
                <span className="flex items-center gap-1.5">
                  <Wind size={12} className="text-slate-500" /> {s.peakWindKmh} km/h
                </span>
              </div>

              <div className="mt-3 font-mono text-[10px] tracking-widest text-slate-500">
                {s.distanceFromIndiaKm}
              </div>

              {active && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
              )}
            </button>
          );
        })}

        <p className="mt-1 text-center font-mono text-[10px] tracking-[0.3em] text-slate-600">
          SELECT A STATION TO RECONFIGURE THE DIGITAL TWIN
        </p>
      </div>
    </div>
  );
}
