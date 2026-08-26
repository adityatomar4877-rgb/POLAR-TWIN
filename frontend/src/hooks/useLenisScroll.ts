import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Initializes a Lenis smooth-scroll instance and synchronizes its ticker
 * with GSAP ScrollTrigger so scroll-scrubbed timelines stay perfectly in phase.
 */
export function useLenisScroll(options?: {
  lerp?: number;
  wheelMultiplier?: number;
  enabled?: boolean;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  const { lerp = 0.09, wheelMultiplier = 1, enabled = true } = options ?? {};

  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      lerp,
      wheelMultiplier,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    // Drive Lenis from GSAP's ticker so ScrollTrigger stays synchronized
    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [lerp, wheelMultiplier, enabled]);

  return lenisRef;
}
