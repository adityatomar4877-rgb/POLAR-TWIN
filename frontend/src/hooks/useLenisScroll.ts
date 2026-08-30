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
  duration?: number;
  wheelMultiplier?: number;
  touchMultiplier?: number;
  enabled?: boolean;
  wrapperRef?: RefObject<HTMLElement | null>;
  contentRef?: RefObject<HTMLElement | null>;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  const {
    lerp = 0.045,
    duration = 1.2,
    wheelMultiplier = 0.95,
    touchMultiplier = 1.5,
    enabled = true,
    wrapperRef,
    contentRef,
  } = options ?? {};

  useEffect(() => {
    if (!enabled) return;

    const wrapper = wrapperRef?.current ?? undefined;
    const content = contentRef?.current ?? undefined;

    const lenis = new Lenis({
      wrapper,
      content,
      lerp,
      duration,
      wheelMultiplier,
      touchMultiplier,
      smoothWheel: true,
      syncTouch: true,
      prevent: (node) => {
        return (
          node.hasAttribute('data-lenis-prevent') ||
          Boolean(node.closest('[data-lenis-prevent]')) ||
          Boolean(node.closest('.twin-viewport')) ||
          Boolean(node.closest('canvas'))
        );
      },
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
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
  }, [lerp, duration, wheelMultiplier, touchMultiplier, enabled, wrapperRef, contentRef]);

  return lenisRef;
}

