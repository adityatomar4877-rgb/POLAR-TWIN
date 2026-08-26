import { useEffect, useRef, type RefObject } from 'react';
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
  wrapperRef?: RefObject<HTMLElement | null>;
  contentRef?: RefObject<HTMLElement | null>;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  const { lerp = 0.09, wheelMultiplier = 1, enabled = true, wrapperRef, contentRef } = options ?? {};

  useEffect(() => {
    if (!enabled) return;

    const wrapper = wrapperRef?.current ?? undefined;
    const content = contentRef?.current ?? undefined;

    const lenis = new Lenis({
      wrapper,
      content,
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
  }, [lerp, wheelMultiplier, enabled, wrapperRef, contentRef]);

  return lenisRef;
}

