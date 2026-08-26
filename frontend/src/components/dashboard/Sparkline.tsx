interface Props {
  values: number[];
  stroke?: string;
  height?: number;
  className?: string;
  fill?: boolean;
}

/**
 * Lightweight SVG sparkline with soft gradient area fill.
 */
export default function Sparkline({
  values,
  stroke = '#3b82f6',
  height = 36,
  className = '',
  fill = true,
}: Props) {
  const width = 160;
  const pts = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 3;

  const stepX = width / (pts.length - 1);
  const points = pts.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const id = `spark-${stroke.replace(/[^a-z0-9]/gi, '')}-${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <polygon
          points={`0,${height} ${points.join(' ')} ${width},${height}`}
          fill={`url(#${id})`}
        />
      )}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
