import { useEffect, useRef, type DependencyList } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Helper for managing GSAP timelines with automatic cleanup and resize
 * invalidation. The factory receives the scope element; return the timeline
 * (or void). All animations created inside are automatically reverted on
 * unmount or when deps change.
 */
export function useGSAPTimeline(
  factory: (scope: HTMLElement) => gsap.core.Timeline | void,
  dependencies: DependencyList = []
) {
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scopeRef.current) return;
    const ctx = gsap.context(() => {
      factory(scopeRef.current!);
    }, scopeRef);

    const invalidateOnResize = () => ScrollTrigger.refresh();
    window.addEventListener('resize', invalidateOnResize);

    return () => {
      window.removeEventListener('resize', invalidateOnResize);
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return scopeRef;
}
