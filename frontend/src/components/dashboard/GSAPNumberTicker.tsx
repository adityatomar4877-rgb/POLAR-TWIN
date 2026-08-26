import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface GSAPNumberTickerProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * GSAP-powered smooth animated number ticker.
 * Interpolates smoothly whenever telemetry values change.
 */
export default function GSAPNumberTicker({
  value,
  decimals = 0,
  duration = 0.85,
  className = '',
  prefix = '',
  suffix = '',
}: GSAPNumberTickerProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const currentValRef = useRef<number>(value);

  useEffect(() => {
    if (!spanRef.current) return;

    const proxy = { val: currentValRef.current };
    const tween = gsap.to(proxy, {
      val: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (spanRef.current) {
          spanRef.current.textContent = `${prefix}${proxy.val.toFixed(decimals)}${suffix}`;
        }
      },
      onComplete: () => {
        currentValRef.current = value;
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, decimals, duration, prefix, suffix]);

  return (
    <span ref={spanRef} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
