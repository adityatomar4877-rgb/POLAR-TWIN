import { useEffect, useRef, useState } from 'react';

/**
 * Accumulates a rolling history buffer for a live metric so sparklines render
 * immediately (seeded with a synthetic warm-up walk) and grow with real
 * telemetry as the dashboard poll / websocket updates arrive.
 */
export function useTelemetryHistory(
  value: number | undefined,
  size = 26,
  volatility = 0.05
): number[] {
  const [history, setHistory] = useState<number[]>([]);
  const lastValue = useRef<number | null>(null);

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    // Skip duplicate pushes (same value polled twice)
    if (lastValue.current === value && history.length > 0) return;
    lastValue.current = value;

    setHistory((prev) => {
      let base = prev;
      if (base.length === 0) {
        // Seed a plausible warm-up walk that converges to the current value
        const pts: number[] = [];
        const magnitude = Math.max(Math.abs(value), 1);
        let v = value - magnitude * volatility * 3;
        for (let i = 0; i < size - 1; i++) {
          v += (value - v) * 0.22 + (Math.random() - 0.5) * magnitude * volatility;
          pts.push(v);
        }
        base = pts;
      }
      return [...base, value].slice(-size);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, size]);

  return history.length > 1 ? history : [value ?? 0, value ?? 0];
}
