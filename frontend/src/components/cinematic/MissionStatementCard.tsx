import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface StatTileConfig {
  prefix: string;
  initial: string;
  target: number;
  decimals: number;
  suffix: string;
  label: string;
}

const STAT_TILES: StatTileConfig[] = [
  { prefix: '−', initial: '0.0', target: 89.2, decimals: 1, suffix: '°C', label: 'RECORD MIN TEMP' },
  { prefix: '~', initial: '0', target: 90, decimals: 0, suffix: '%', label: 'GLOBAL GLACIAL ICE' },
  { prefix: '', initial: '0', target: 300, decimals: 0, suffix: '+ KM/H', label: 'KATABATIC WINDS' },
  { prefix: '', initial: '0', target: 43, decimals: 0, suffix: ' YEARS', label: 'CONTINUOUS SCIENCE' },
];

export default function MissionStatementCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const kickerRef = useRef<HTMLDivElement>(null);
  const headlineLine1Ref = useRef<HTMLSpanElement>(null);
  const headlineLine2Ref = useRef<HTMLSpanElement>(null);
  const underlineRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const checklistRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const statNumberRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const animationTriggeredRef = useRef(false);

  useEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl) return;

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Immediately set all final values without motion
      STAT_TILES.forEach((tile, idx) => {
        const el = statNumberRefs.current[idx];
        if (el) {
          el.textContent = tile.decimals > 0 ? tile.target.toFixed(tile.decimals) : tile.target.toString();
        }
      });
      return;
    }

    // Set initial hidden states using lightweight GPU-accelerated transforms
    gsap.set(kickerRef.current, { opacity: 0, x: -15 });
    gsap.set([headlineLine1Ref.current, headlineLine2Ref.current], { opacity: 0, y: 16 });
    gsap.set(underlineRef.current, { scaleX: 0, transformOrigin: 'left center' });
    gsap.set(bodyRef.current, { opacity: 0, y: 8 });
    gsap.set(checklistRefs.current, { opacity: 0, x: -8 });
    gsap.set(tileRefs.current, { opacity: 0, scale: 0.92 });

    const runEntranceAnimation = () => {
      if (animationTriggeredRef.current) return;
      animationTriggeredRef.current = true;

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      // 1. Kicker row ("01 — THE MISSION") fades + slides in from left (~15px, 0.35s)
      tl.to(kickerRef.current, {
        opacity: 1,
        x: 0,
        duration: 0.35,
      });

      // 2. Headline lines reveal line by line with slight upward slide + fade, slight overshoot ease
      tl.to(
        [headlineLine1Ref.current, headlineLine2Ref.current],
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.08,
          ease: 'back.out(1.2)',
        },
        '-=0.15'
      );

      // 3. Thin blue underline draws in from left to right (width 0% → 100%, ~0.45s) right after headline
      tl.to(
        underlineRef.current,
        {
          scaleX: 1,
          duration: 0.45,
          ease: 'power2.out',
        },
        '-=0.05'
      );

      // 4. Body paragraph fades in as a block, slightly after the underline
      tl.to(
        bodyRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
        },
        '-=0.18'
      );

      // 5. Checklist lines animate in staggered ~140ms:
      // The two "NOT..." lines fade in struck-through
      const checkItems = checklistRefs.current.filter(Boolean);
      if (checkItems.length >= 2) {
        tl.to(
          [checkItems[0], checkItems[1]],
          {
            opacity: 1,
            x: 0,
            duration: 0.3,
            stagger: 0.14,
          },
          '-=0.08'
        );
      }

      // Final green checkmark line pops in with a small scale bounce (1 -> 1.05 -> 1) payoff
      if (checkItems[2]) {
        tl.fromTo(
          checkItems[2],
          { opacity: 0, scale: 0.9, x: -4 },
          {
            opacity: 1,
            scale: 1,
            x: 0,
            duration: 0.42,
            ease: 'back.out(2.2)',
          },
          '+=0.04'
        );
      }

      // 6. The four stat tiles animate in as a staggered grid (scale 0.92 -> 1, fade in, staggered ~90ms)
      tl.to(
        tileRefs.current.filter(Boolean),
        {
          opacity: 1,
          scale: 1,
          duration: 0.38,
          stagger: 0.09,
          ease: 'power2.out',
          onStart: () => {
            // Count up numeric values via direct DOM mutations (ZERO React re-renders for buttery 60fps)
            const countObj = { val0: 0, val1: 0, val2: 0, val3: 0 };
            gsap.to(countObj, {
              val0: STAT_TILES[0].target,
              val1: STAT_TILES[1].target,
              val2: STAT_TILES[2].target,
              val3: STAT_TILES[3].target,
              duration: 1.05,
              ease: 'power2.out',
              onUpdate: () => {
                const el0 = statNumberRefs.current[0];
                const el1 = statNumberRefs.current[1];
                const el2 = statNumberRefs.current[2];
                const el3 = statNumberRefs.current[3];

                if (el0) el0.textContent = countObj.val0.toFixed(1);
                if (el1) el1.textContent = Math.round(countObj.val1).toString();
                if (el2) el2.textContent = Math.round(countObj.val2).toString();
                if (el3) el3.textContent = Math.round(countObj.val3).toString();
              },
              onComplete: () => {
                STAT_TILES.forEach((tile, idx) => {
                  const el = statNumberRefs.current[idx];
                  if (el) {
                    el.textContent = tile.decimals > 0 ? tile.target.toFixed(tile.decimals) : tile.target.toString();
                  }
                });
              },
            });
          },
        },
        '-=0.2'
      );
    };

    // Trigger entrance animation using IntersectionObserver when scrolled into view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runEntranceAnimation();
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    observer.observe(cardEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className="slide-story-card relative w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0E121E] p-8 sm:p-14 shadow-2xl overflow-hidden will-change-transform"
    >
      {/* ─────────────────────────────────────────────────────────────
         AMBIENT LOOPING BACKGROUND GLOW (GPU-Accelerated Top-Right Figure-8 Loop)
         Keeps card base completely solid/opaque; only light position shifts smoothly
         ───────────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.2)_0%,rgba(99,102,241,0.06)_50%,transparent_70%)] blur-2xl animate-mission-glow"
      />

      {/* ─────────────────────────────────────────────────────────────
         KICKER ROW ("01 — THE MISSION")
         ───────────────────────────────────────────────────────────── */}
      <div
        ref={kickerRef}
        className="flex items-center gap-3 text-xs font-mono font-bold tracking-widest text-slate-400"
      >
        <span className="text-rose-400">01</span>
        <span className="h-[2px] w-8 bg-rose-500/60" />
        <span>THE MISSION</span>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         HEADLINE LINES (Word/Line Reveal + Staggered Overshoot Ease)
         ───────────────────────────────────────────────────────────── */}
      <h2 className="mt-6 font-sans text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
        <span ref={headlineLine1Ref} className="block will-change-transform">
          INDIA AT THE BOTTOM
        </span>
        <span ref={headlineLine2Ref} className="block will-change-transform">
          OF THE WORLD.
        </span>
      </h2>

      {/* Animated Underline (Width draws in 0% → 100%) */}
      <div
        ref={underlineRef}
        className="mt-4 h-[2px] w-24 bg-[#38BDF8] will-change-transform"
      />

      {/* ─────────────────────────────────────────────────────────────
         GRID: SUPPORTING BODY / CHECKLIST & 4 WHITE STAT TILES
         ───────────────────────────────────────────────────────────── */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative z-10">
        {/* Supporting Body & Struck-through Checklist */}
        <div>
          <p
            ref={bodyRef}
            className="text-sm sm:text-base leading-relaxed text-slate-300 font-medium will-change-transform"
          >
            Four decades of Indian scientific expeditions have crossed the Southern Ocean to build permanent research habitats on Antarctica — decoding climate, glaciology, and polar biology through winters no human was meant to endure.
          </p>

          <div className="mt-6 space-y-2 font-mono text-xs">
            {/* Checklist Item 1 (Struck) */}
            <div
              ref={(el) => { checklistRefs.current[0] = el; }}
              className="flex items-center gap-2 text-slate-500 line-through will-change-transform"
            >
              <span className="text-slate-600 font-bold select-none">✕</span>
              <span>NOT A TEMPORARY FIELD CAMP</span>
            </div>

            {/* Checklist Item 2 (Struck) */}
            <div
              ref={(el) => { checklistRefs.current[1] = el; }}
              className="flex items-center gap-2 text-slate-500 line-through will-change-transform"
            >
              <span className="text-slate-600 font-bold select-none">✕</span>
              <span>NOT ISOLATED FROM MAINLAND</span>
            </div>

            {/* Checklist Item 3 (Payoff Line - Scale Bounce) */}
            <div
              ref={(el) => { checklistRefs.current[2] = el; }}
              className="flex items-center gap-2 text-emerald-400 font-bold will-change-transform"
            >
              <span className="text-emerald-400 font-black select-none">✓</span>
              <span>365-DAY AUTONOMOUS DIGITAL TWIN OPERATIONS</span>
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────
           4 CRISP WHITE STAT TILES GRID
           (Staggered Entrance, DOM-based Count-Up, Idle Pulse & Hover Lift)
           ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {STAT_TILES.map(({ prefix, initial, suffix, label }, index) => (
            <div
              key={label}
              ref={(el) => { tileRefs.current[index] = el; }}
              className={`mission-stat-tile mission-stat-tile-${index} rounded-2xl bg-white p-5 text-center cursor-default will-change-transform select-none`}
            >
              {/* Number with static prefix & static units/suffix */}
              <p className="font-mono text-2xl sm:text-3xl font-black text-[#0284C7] tracking-tight leading-none">
                <span className="text-[#0284C7]/90">{prefix}</span>
                <span ref={(el) => { statNumberRefs.current[index] = el; }}>{initial}</span>
                <span className="text-[#0284C7]/90">{suffix}</span>
              </p>

              {/* Subtitle label */}
              <p className="mt-2 font-mono text-[9.5px] font-bold tracking-wider text-slate-500 uppercase">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
