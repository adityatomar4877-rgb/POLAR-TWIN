import { memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import GSAPNumberTicker from './GSAPNumberTicker';

export interface EnergySlice {
  name: string;
  value: number;
  color: string;
  unit?: string;
}

interface EnergyBalancePieChartProps {
  generated: number;
  consumed: number;
  stored: number;
  balancePercentage?: number;
  label?: string;
  size?: number;
}

const COLORS = {
  generated: '#10b981', // Emerald green
  consumed: '#3b82f6',  // Polar blue
  stored: '#8b5cf6',    // Aurora violet
};

/* Custom sleek tooltip */
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 shadow-lg backdrop-blur-md text-[11px] font-sans">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: data.color }} />
          <span>{data.name}</span>
        </div>
        <div className="mt-0.5 font-mono text-slate-600 font-semibold">
          {Number(data.value).toFixed(1)} {data.unit || 'kW'}
        </div>
      </div>
    );
  }
  return null;
};

export const EnergyBalancePieChart = memo(function EnergyBalancePieChart({
  generated,
  consumed,
  stored,
  balancePercentage = 84,
  label = 'ENERGY BALANCE',
  size = 120,
}: EnergyBalancePieChartProps) {
  const data: EnergySlice[] = [
    { name: 'Generated', value: Math.max(generated, 0.1), color: COLORS.generated, unit: 'kW' },
    { name: 'Consumed', value: Math.max(consumed, 0.1), color: COLORS.consumed, unit: 'kW' },
    { name: 'Stored', value: Math.max(stored, 0.1), color: COLORS.stored, unit: 'kW' },
  ];

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<CustomTooltip />} />
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="64%"
            outerRadius="88%"
            paddingAngle={3}
            cornerRadius={4}
            dataKey="value"
            nameKey="name"
            startAngle={90}
            endAngle={-270}
            isAnimationActive={true}
            animationDuration={850}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="#ffffff"
                strokeWidth={1.5}
                className="transition-all duration-300 hover:opacity-85 cursor-pointer"
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Centered Readout */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-1">
        <span className="text-[17px] font-black text-slate-900 leading-none font-mono">
          <GSAPNumberTicker value={balancePercentage} decimals={0} suffix="%" />
        </span>
        <span className="text-[7.5px] font-extrabold uppercase tracking-tight text-slate-400 leading-tight mt-0.5">
          {label}
        </span>
      </div>
    </div>
  );
});

export default EnergyBalancePieChart;
