import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Renders a numeric value that smoothly tweens to new telemetry readings
 * using GSAP. Updates are written directly to the DOM node, so live data
 * never triggers parent re-renders.
 */
export default function GsapNumber({
  value,
  decimals = 1,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const displayed = useRef(Number.isFinite(value) ? value : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(value)) return;

    if (Math.abs(value - displayed.current) < Math.pow(10, -decimals) / 2) {
      el.textContent = value.toFixed(decimals);
      return;
    }

    const state = { v: displayed.current };
    const tween = gsap.to(state, {
      v: value,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = state.v.toFixed(decimals);
      },
      onComplete: () => {
        displayed.current = value;
      },
    });

    return () => {
      tween.kill();
      displayed.current = state.v;
    };
  }, [value, decimals]);

  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals)}
    </span>
  );
}
