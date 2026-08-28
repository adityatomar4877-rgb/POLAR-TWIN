import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface GSAPGaugeMeterProps {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  label: string;
  size?: number;
  strokeColor?: string;
  warningThreshold?: number;
  dangerThreshold?: number;
}

export default function GSAPGaugeMeter({
  value,
  min = 0,
  max = 100,
  unit = '%',
  label,
  size = 140,
  strokeColor = '#06b6d4',
  warningThreshold,
  dangerThreshold,
}: GSAPGaugeMeterProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const valueObj = useRef({ val: 0 });

  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  // Use a 240-degree sweep arc (open at bottom)
  const arcLength = circumference * (240 / 360);
  const clampedVal = Math.min(Math.max(value, min), max);
  const normalized = (clampedVal - min) / (max - min || 1);

  // Determine dynamic color
  let activeColor = strokeColor;
  if (dangerThreshold !== undefined && value >= dangerThreshold) {
    activeColor = '#ef4444';
  } else if (warningThreshold !== undefined && value >= warningThreshold) {
    activeColor = '#f59e0b';
  }

  useEffect(() => {
    const targetOffset = arcLength * (1 - normalized);

    if (circleRef.current) {
      gsap.to(circleRef.current, {
        strokeDashoffset: targetOffset,
        stroke: activeColor,
        duration: 1.2,
        ease: 'power3.out',
      });
    }

    if (textRef.current) {
      gsap.to(valueObj.current, {
        val: value,
        duration: 1.2,
        ease: 'power3.out',
        onUpdate: () => {
          if (textRef.current) {
            const currentVal = valueObj.current.val;
            if (currentVal >= 10000) {
              textRef.current.textContent = (currentVal / 1000).toFixed(1) + 'k';
            } else {
              textRef.current.textContent = currentVal.toFixed(max > 500 ? 0 : 1);
            }
          }
        },
      });
    }
  }, [value, normalized, activeColor, arcLength, max]);

  const isSmall = size < 120;
  
  const getInitialValue = (v: number) => {
    if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
    return v.toFixed(max > 500 ? 0 : 1);
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[150deg] transform"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-slate-200"
          strokeWidth="10"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />

        {/* Animated active arc */}
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={activeColor}
          strokeWidth="10"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={arcLength}
          strokeLinecap="round"
          className="transition-colors duration-500"
        />
      </svg>

      {/* Center value readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
        <span className={`font-mono font-black tracking-tight text-slate-800 ${isSmall ? 'text-[15px]' : 'text-xl'}`}>
          <span ref={textRef}>{getInitialValue(value)}</span>
          {!isSmall && (
            <span className="text-xs font-semibold text-slate-400 ml-0.5">{unit}</span>
          )}
        </span>
        {!isSmall && (
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mt-0.5 leading-tight">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
