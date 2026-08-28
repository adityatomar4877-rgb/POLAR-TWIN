import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, AnimatePresence, type Variants } from 'framer-motion';
import gsap from 'gsap';

/* ─── Shared Easings ─── */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 };
export const EASE_SMOOTH = { type: 'spring' as const, stiffness: 260, damping: 32 };

/* ─── Stagger Container ─── */
const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
};

/** Staggered entrance container — wraps a grid/stack of StaggerItem children. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial={reduced ? false : 'hidden'}
      animate="show"
    >
      {children}
    </motion.div>
  );
}

/** Child of Stagger — fades/rises into place with the group rhythm. */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/* ─── FadeIn ─── */
/** Single-element fade/rise entrance. */
export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* ─── SlideIn ─── */
type Direction = 'up' | 'down' | 'left' | 'right';
const directionMap: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 24 },
  down: { x: 0, y: -24 },
  left: { x: 24, y: 0 },
  right: { x: -24, y: 0 },
};

/** Directional slide entrance with spring physics. */
export function SlideIn({
  children,
  className,
  direction = 'up',
  delay = 0,
  duration = 0.5,
}: {
  children: ReactNode;
  className?: string;
  direction?: Direction;
  delay?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const offset = directionMap[direction];
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* ─── ScaleIn ─── */
/** Scale-from-zero entrance for badges, modals, alerts. */
export function ScaleIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ ...EASE_SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ─── HoverLift ─── */
/** Subtle hover-lift micro-interaction for interactive cards. */
export function HoverLift({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={
        reduced
          ? undefined
          : { y: -4, scale: 1.01, transition: { ...EASE_SPRING } }
      }
      whileTap={reduced ? undefined : { scale: 0.985 }}
    >
      {children}
    </motion.div>
  );
}

/* ─── GlowPulse ─── */
/** Ambient breathing glow effect for live-data indicators. */
export function GlowPulse({
  children,
  className,
  color = 'rgba(6,182,212,0.4)',
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <motion.div
      className={className}
      animate={{
        boxShadow: [
          `0 0 0px ${color}`,
          `0 0 16px ${color}`,
          `0 0 0px ${color}`,
        ],
      }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

/* ─── ShimmerLoader ─── */
/** Skeleton shimmer loading placeholder. */
export function ShimmerLoader({
  className = '',
  height = '100%',
  borderRadius = '12px',
}: {
  className?: string;
  height?: string | number;
  borderRadius?: string;
}) {
  return (
    <div
      className={`animate-shimmer bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 bg-[length:200%_100%] ${className}`}
      style={{ height, borderRadius }}
    />
  );
}

/* ─── AnimatedBorder ─── */
/** Gradient-animated border wrapper for focused/active cards. */
export function AnimatedBorder({
  children,
  className = '',
  active = true,
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl p-[1.5px] ${
        active ? 'animate-gradient-shift bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-[length:200%_100%]' : 'bg-slate-200'
      } ${className}`}
    >
      <div className="rounded-[14px] bg-white h-full">{children}</div>
    </div>
  );
}

/* ─── TypeWriter ─── */
/** Character-by-character text reveal for status messages. */
export function TypeWriter({
  text,
  className = '',
  speed = 35,
  delay = 0,
}: {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
}) {
  const [displayed, setDisplayed] = useState('');
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplayed(text);
      return;
    }
    setDisplayed('');
    let i = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay, reduced]);

  return (
    <span className={className}>
      {displayed}
      {!reduced && displayed.length < text.length && (
        <span className="inline-block w-[2px] h-[1em] bg-current animate-pulse ml-px align-text-bottom" />
      )}
    </span>
  );
}

/* ─── MagneticHover ─── */
/** Cursor-reactive micro-displacement on interactive elements. */
export function MagneticHover({
  children,
  className,
  strength = 0.15,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !ref.current) return;
    const el = ref.current;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      gsap.to(el, { x: dx, y: dy, duration: 0.35, ease: 'power2.out' });
    };

    const handleLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, [strength, reduced]);

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}

/* ─── PresenceTransition ─── */
/** Wrapper for AnimatePresence with enter/exit for conditional content. */
export function PresenceTransition({
  show,
  children,
  className,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          className={className}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { InteractiveHoverButton, type InteractiveHoverButtonProps, type InteractiveHoverButtonVariant } from './InteractiveHoverButton';
