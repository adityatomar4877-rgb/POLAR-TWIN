import { useMemo } from 'react';
import clsx from 'clsx';
import { Zap, Fuel, Sun, Wind, BatteryCharging, HeartPulse, Snowflake, FlaskConical, Utensils } from 'lucide-react';
import type { EnergyTelemetry, LoadGroup } from '../../api/types';

interface Props {
  energy?: EnergyTelemetry;
  loads?: LoadGroup[];
}

const LOAD_ICONS = [HeartPulse, Snowflake, FlaskConical, Utensils];

/**
 * Dynamic interactive power-flow schematic.
 * Generation -> Power Bus -> Battery Bank <-> Station Loads.
 * Particle direction reverses when the battery discharges into the bus.
 */
export default function EnergyFlowDiagram({ energy, loads }: Props) {
  const dieselKw = energy?.diesel_generation_kw ?? 0;
  const solarKw = energy?.solar_generation_kw ?? 0;
  const windKw = (energy as any)?.wind_generation_kw ?? 0;
  const balance = energy?.energy_balance ?? 0;
  const batteryPct = energy?.battery_percentage ?? 0;
  const batteryFlow = energy?.battery_power_kw ?? 0;
  const charging = batteryFlow > 0;

  const shedableLoads = useMemo(() => (loads ?? []).slice(0, 4), [loads]);

  const nodeLabel =
    'flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[11px] tracking-wider transition-colors';

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold tracking-[0.35em] text-slate-600">POWER FLOW SCHEMATIC</h3>
        <span
          className={clsx(
            'rounded px-2 py-1 font-mono text-[10px] tracking-widest',
            balance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
          )}
        >
          NET {balance >= 0 ? '+' : ''}
          {balance.toFixed(1)} kW
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">
        {/* ---------- GENERATION ---------- */}
        <div className="space-y-3">
          <p className="font-mono text-[9px] tracking-[0.4em] text-slate-500">GENERATION</p>
          <div className={clsx(nodeLabel, dieselKw > 0 ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white/60 text-slate-500')}>
            <Fuel size={13} /> DIESEL
            <span className="ml-auto font-bold">{dieselKw.toFixed(1)} kW</span>
          </div>
          <div className={clsx(nodeLabel, solarKw > 0 ? 'border-amber-300 bg-amber-50 text-amber-200' : 'border-slate-200 bg-white/60 text-slate-500')}>
            <Sun size={13} /> SOLAR PV
            <span className="ml-auto font-bold">{solarKw.toFixed(1)} kW</span>
          </div>
          <div className={clsx(nodeLabel, windKw > 0 ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white/60 text-slate-500')}>
            <Wind size={13} /> WIND
            <span className="ml-auto font-bold">{windKw > 0 ? `${windKw.toFixed(1)} kW` : 'STANDBY'}</span>
          </div>
        </div>

        {/* ---------- BUS + BATTERY ---------- */}
        <div className="relative flex h-full min-h-56 flex-col items-center justify-between py-1">
          {/* animated flow particles */}
          <svg className="pointer-events-none absolute inset-x-[-18px] top-6 h-16 w-[calc(100%+36px)]" aria-hidden>
            {(dieselKw > 0 || solarKw > 0) &&
              [0, 0.33, 0.66].map((t) => (
                <circle key={`g${t}`} r="3" fill="#22d3ee">
                  <animateMotion dur="1.6s" begin={`${t * 1.6}s`} repeatCount="indefinite" path="M 0 8 H 100%" />
                </circle>
              ))}
            {balance < 0 && (
              <text x="50%" y="52" textAnchor="middle" fill="#f59e0b" fontSize="9" fontFamily="monospace">
                DEFICIT
              </text>
            )}
          </svg>

          <div className="z-10 flex flex-col items-center gap-1">
            <Zap size={16} className="text-cyan-600" />
            <div className="w-2.5 rounded-full bg-gradient-to-b from-cyan-400 to-cyan-600 shadow-[0_0_18px_rgba(34,211,238,0.7)]" style={{ height: '120px' }} />
            <span className="mt-1 rotate-90 whitespace-nowrap font-mono text-[9px] tracking-[0.45em] text-slate-500">
              POWER BUS
            </span>
          </div>

          {/* Battery node below bus */}
          <div className="z-10 mt-2 flex flex-col items-center gap-1.5">
            <div
              className={clsx(
                'flex w-32 flex-col items-center rounded-lg border px-3 py-2',
                charging ? 'border-emerald-400/50 bg-emerald-400/5' : 'border-amber-300 bg-amber-50'
              )}
            >
              <BatteryCharging size={14} className={charging ? 'text-emerald-600' : 'text-amber-600'} />
              <span className="mt-1 font-mono text-sm font-bold text-white">{batteryPct.toFixed(0)}%</span>
              <span className={clsx('font-mono text-[9px] tracking-widest', charging ? 'text-emerald-600' : 'text-amber-600')}>
                {charging ? `CHARGING +${batteryFlow.toFixed(1)} kW` : `DISCHARGING ${Math.abs(batteryFlow).toFixed(1)} kW`}
              </span>
            </div>

            {/* battery <-> bus particles */}
            <svg width="20" height="34" aria-hidden>
              {charging ? (
                <circle r="2.5" fill="#34d399">
                  <animateMotion dur="1.1s" repeatCount="indefinite" path="M 10 30 L 10 4" />
                </circle>
              ) : (
                <circle r="2.5" fill="#fbbf24">
                  <animateMotion dur="1.1s" repeatCount="indefinite" path="M 10 4 L 10 30" />
                </circle>
              )}
            </svg>
          </div>
        </div>

        {/* ---------- LOADS ---------- */}
        <div className="space-y-3">
          <p className="text-right font-mono text-[9px] tracking-[0.4em] text-slate-500">STATION LOADS</p>
          {shedableLoads.length === 0 && (
            <>
              {[['LIFE SUPPORT', '~12 kW'], ['HVAC', '~29 kW'], ['SCIENCE LABS', '~15 kW'], ['GALLEY', '~4 kW']].map(
                ([name, val]) => (
                  <div key={name} className={clsx(nodeLabel, 'justify-between border-slate-200 bg-white/60 text-slate-600')}>
                    <span>{name}</span>
                    <span className="font-bold text-slate-500">{val}</span>
                  </div>
                )
              )}
            </>
          )}
          {shedableLoads.map((load, i) => {
            const Icon = LOAD_ICONS[i % LOAD_ICONS.length];
            return (
              <div
                key={load.id}
                className={clsx(
                  nodeLabel,
                  load.enabled
                    ? 'border-sky-300 bg-sky-50 text-sky-100'
                    : 'border-red-300 bg-red-500/5 text-red-600 line-through opacity-70'
                )}
              >
                <Icon size={13} /> {load.name.toUpperCase()}
                <span className="ml-auto font-bold">
                  {load.current_power_kw.toFixed(1)} kW {!load.enabled && '(SHED)'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
