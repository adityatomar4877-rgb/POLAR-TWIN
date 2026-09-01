import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  onEnterCommandCenter?: () => void;
  onScrollDown?: () => void;
}

export default function PolarTwinTypographicHero({
  onEnterCommandCenter,
  onScrollDown,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const masterTlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // ══════════════════════════════════════════════════════════════════
      // MASTER 6.5s INFINITE LOOP TIMELINE
      // ══════════════════════════════════════════════════════════════════
      const master = gsap.timeline({
        repeat: -1,
        defaults: { ease: 'power2.inOut' },
      });
      masterTlRef.current = master;

      // ──────────────────────────────────────────────────────────────────
      // 0. INITIAL STATE SETUP
      // ──────────────────────────────────────────────────────────────────
      // Illustrated characters visible and centered
      gsap.set('.char-group', {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        transformOrigin: '50% 80%',
      });

      // Outlines hidden initially
      gsap.set('.outline-group', {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 0,
        transformOrigin: '50% 50%',
      });

      // TWIN individual letters
      gsap.set('.twin-char', {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 0,
        opacity: 0,
        transformOrigin: '50% 50%',
      });

      // Character eyes open
      gsap.set('.char-eye', {
        scaleY: 1,
        transformOrigin: '50% 50%',
      });

      // ──────────────────────────────────────────────────────────────────
      // STEP 1: ENTRANCE (0.0s – 1.0s)
      // TWIN scales in from 0 with elastic overshoot and squash/stretch wobble
      // ──────────────────────────────────────────────────────────────────
      master.to(
        '.twin-char',
        {
          opacity: 1,
          scale: 1,
          duration: 0.85,
          stagger: 0.06,
          ease: 'elastic.out(1.2, 0.45)',
        },
        0.05
      );

      // ──────────────────────────────────────────────────────────────────
      // STEP 2: IDLE HOLD & SECONDARY MOTION (1.0s – 3.0s)
      // Gentle breathing scale (~1-2%) and character eye blinks
      // ──────────────────────────────────────────────────────────────────
      // Gentle breathing on POLAR illustrated characters
      master.to(
        '.char-group',
        {
          scaleY: 1.025,
          scaleX: 0.99,
          y: -4,
          duration: 0.9,
          stagger: 0.04,
          yoyo: true,
          repeat: 1,
          ease: 'sine.inOut',
        },
        1.0
      );

      // Character eye blinks (A mountain face and R sphere face)
      master.to(
        '.char-eye',
        {
          scaleY: 0.1,
          duration: 0.08,
          yoyo: true,
          repeat: 1,
          ease: 'power2.inOut',
        },
        1.5
      );

      master.to(
        '.char-eye',
        {
          scaleY: 0.1,
          duration: 0.08,
          yoyo: true,
          repeat: 1,
          ease: 'power2.inOut',
        },
        2.35
      );

      // Subtle ice-crystal specular glint pulse
      master.to(
        '.specular-glint',
        {
          opacity: 1,
          scale: 1.25,
          duration: 0.4,
          yoyo: true,
          repeat: 1,
          stagger: 0.08,
        },
        1.7
      );

      // ──────────────────────────────────────────────────────────────────
      // STEP 3: OUTLINE MORPH (3.0s – 3.6s)
      // POLAR crossfades into plain bold outline-only version; TWIN stays solid
      // ──────────────────────────────────────────────────────────────────
      master.to(
        '.char-group',
        {
          opacity: 0,
          scale: 0.97,
          duration: 0.45,
          ease: 'power2.inOut',
        },
        3.0
      );

      master.to(
        '.outline-group',
        {
          opacity: 1,
          scale: 1,
          duration: 0.45,
          ease: 'power2.inOut',
        },
        3.05
      );

      // ──────────────────────────────────────────────────────────────────
      // STEP 4: SHATTER & DRIFT (3.6s – 5.0s)
      // Outlined letters drift downward/outward with independent rotations (+/-15-30deg)
      // TWIN letters drift apart slightly and fade
      // ──────────────────────────────────────────────────────────────────
      // Outlined POLAR letters shattering drift
      master.to(
        '.outline-p',
        {
          x: -60,
          y: 75,
          rotation: -24,
          opacity: 0,
          duration: 1.15,
          ease: 'power2.in',
        },
        3.6
      );

      master.to(
        '.outline-o',
        {
          x: -20,
          y: 95,
          rotation: 28,
          opacity: 0,
          duration: 1.2,
          ease: 'power2.in',
        },
        3.65
      );

      master.to(
        '.outline-l',
        {
          x: 10,
          y: 65,
          rotation: -18,
          opacity: 0,
          duration: 1.15,
          ease: 'power2.in',
        },
        3.7
      );

      master.to(
        '.outline-a',
        {
          x: 40,
          y: 90,
          rotation: 26,
          opacity: 0,
          duration: 1.2,
          ease: 'power2.in',
        },
        3.75
      );

      master.to(
        '.outline-r',
        {
          x: 75,
          y: 80,
          rotation: -28,
          opacity: 0,
          duration: 1.2,
          ease: 'power2.in',
        },
        3.8
      );

      // TWIN letters drift apart and fade
      master.to(
        '.twin-t',
        {
          x: -45,
          y: 35,
          rotation: -14,
          opacity: 0,
          duration: 1.05,
          ease: 'power2.in',
        },
        3.7
      );

      master.to(
        '.twin-w',
        {
          x: -18,
          y: 50,
          rotation: 10,
          opacity: 0,
          duration: 1.1,
          ease: 'power2.in',
        },
        3.75
      );

      master.to(
        '.twin-i',
        {
          x: 18,
          y: 40,
          rotation: -8,
          opacity: 0,
          duration: 1.05,
          ease: 'power2.in',
        },
        3.8
      );

      master.to(
        '.twin-n',
        {
          x: 55,
          y: 45,
          rotation: 16,
          opacity: 0,
          duration: 1.1,
          ease: 'power2.in',
        },
        3.85
      );

      // ──────────────────────────────────────────────────────────────────
      // STEP 5: REASSEMBLE & COLOR RETURN (5.0s – 6.5s)
      // All pieces fly back to original positions, color returns
      // ──────────────────────────────────────────────────────────────────
      master.set(
        '.char-p',
        { x: -60, y: 75, rotation: -24, opacity: 0, scale: 0.9 },
        4.95
      );
      master.set(
        '.char-o',
        { x: -20, y: 95, rotation: 28, opacity: 0, scale: 0.9 },
        4.95
      );
      master.set(
        '.char-l',
        { x: 10, y: 65, rotation: -18, opacity: 0, scale: 0.9 },
        4.95
      );
      master.set(
        '.char-a',
        { x: 40, y: 90, rotation: 26, opacity: 0, scale: 0.9 },
        4.95
      );
      master.set(
        '.char-r',
        { x: 75, y: 80, rotation: -28, opacity: 0, scale: 0.9 },
        4.95
      );

      // POLAR illustrated characters fly back and lock in with color restored
      master.to(
        '.char-group',
        {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          opacity: 1,
          stagger: 0.05,
          duration: 0.95,
          ease: 'elastic.out(1.1, 0.5)',
        },
        5.05
      );

      // TWIN letters snap back in solid pure white
      master.to(
        '.twin-char',
        {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          opacity: 1,
          stagger: 0.05,
          duration: 0.9,
          ease: 'elastic.out(1.15, 0.48)',
        },
        5.15
      );

      // Brief hold before seamless loop repeat
      master.to({}, { duration: 0.35 });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Keyboard shortcut support (Space/Down -> scroll/enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowDown' || e.key === ' ') && onScrollDown) {
        onScrollDown();
      } else if (e.key === 'Enter' && onEnterCommandCenter) {
        onEnterCommandCenter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEnterCommandCenter, onScrollDown]);

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-screen w-full select-none flex-col items-center justify-center overflow-hidden bg-[#0A0A0A] text-[#FFFFFF] px-4 sm:px-8 py-6 font-sans"
      style={{
        backgroundColor: '#0A0A0A',
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════
         PERFECTLY CENTERED HERO CANVAS (~150-180px TALL LETTERFORMS)
         LINE 1: "POLAR" (Illustrated Character / Arctic Themed Letters)
         LINE 2: "TWIN" (Solid Heavy Bold White Sans-Serif with Space)
         ══════════════════════════════════════════════════════════════════ */}
      <main className="relative z-10 flex w-full flex-1 items-center justify-center max-w-[1400px] mx-auto my-auto">
        <div className="relative w-full max-w-[1150px] flex items-center justify-center">
          <svg
            viewBox="0 0 1100 500"
            className="h-auto w-full max-h-[82vh] select-none"
            style={{ overflow: 'visible' }}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Vibrant Cohesive Arctic Gradients */}
              <linearGradient id="pGradStem" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="60%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#818CF8" />
              </linearGradient>

              <linearGradient id="pGradGloss" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="oGradTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#BAE6FD" />
              </linearGradient>

              <linearGradient id="oGradLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>

              <linearGradient id="oGradRight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#4F46E5" />
              </linearGradient>

              <linearGradient id="lGradVert" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#818CF8" />
              </linearGradient>

              <linearGradient id="aGradMtn" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#818CF8" />
              </linearGradient>

              <radialGradient id="rGradSphere" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="30%" stopColor="#E0F2FE" />
                <stop offset="65%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#6366F1" />
              </radialGradient>
            </defs>

            {/* ═══════════════════════════════════════════════════════════
               1. ILLUSTRATED CHARACTER LAYER FOR "POLAR"
               ═══════════════════════════════════════════════════════════ */}
            <g className="illustrated-polar-layer">

              {/* ────── LETTER 'P': ROUNDED GLOSSY ICICLE / PAW BLOB ────── */}
              <g className="char-group char-p">
                {/* Main Stem with rounded icicle drip capsule */}
                <rect
                  x="120"
                  y="45"
                  width="44"
                  height="170"
                  rx="22"
                  fill="url(#pGradStem)"
                />
                {/* Glossy Curved Paw / Lobe */}
                <path
                  d="M 138,45 L 202,45 C 238,45 255,68 255,98 C 255,128 238,150 202,150 L 138,150 Z"
                  fill="url(#pGradStem)"
                />
                {/* Glossy Highlight Reflection */}
                <path
                  d="M 142,52 L 196,52 C 222,52 235,65 235,85 C 235,95 226,104 210,104 L 142,104 Z"
                  fill="url(#pGradGloss)"
                  opacity="0.75"
                />
                {/* Icicle Drip Highlight */}
                <rect
                  x="128"
                  y="58"
                  width="10"
                  height="110"
                  rx="5"
                  fill="#FFFFFF"
                  opacity="0.6"
                />
                {/* Cute Paw / Ice Pad Accent */}
                <circle cx="195" cy="98" r="14" fill="#FFFFFF" opacity="0.9" />
                <circle cx="172" cy="82" r="6" fill="#38BDF8" />
                <circle cx="195" cy="74" r="6" fill="#38BDF8" />
                <circle cx="216" cy="86" r="5" fill="#38BDF8" />
              </g>

              {/* ────── LETTER 'O': 3D ISOMETRIC ICE-CUBE WITH CUT-OUT ────── */}
              <g className="char-group char-o">
                {/* Isometric Outer Cube Faces */}
                {/* Top Diamond Face */}
                <polygon
                  points="355,42 425,80 355,118 285,80"
                  fill="url(#oGradTop)"
                />
                {/* Left Face */}
                <polygon
                  points="285,80 355,118 355,208 285,170"
                  fill="url(#oGradLeft)"
                />
                {/* Right Face */}
                <polygon
                  points="355,118 425,80 425,170 355,208"
                  fill="url(#oGradRight)"
                />

                {/* Inner Cut-out Facet (Hollow Isometric Window) */}
                <polygon
                  points="355,76 392,96 355,116 318,96"
                  fill="#0A0A0A"
                />
                <polygon
                  points="318,96 355,116 355,160 318,140"
                  fill="#0284C7"
                  opacity="0.85"
                />
                <polygon
                  points="355,116 392,96 392,140 355,160"
                  fill="#1E1B4B"
                />

                {/* Specular Glint on Top Vertex */}
                <circle
                  cx="355"
                  cy="42"
                  r="5"
                  fill="#FFFFFF"
                  className="specular-glint"
                />
                <polygon
                  points="355,38 359,42 355,46 351,42"
                  fill="#FB7185"
                  opacity="0.9"
                />
              </g>

              {/* ────── LETTER 'L': JAGGED CRYSTALLINE SHARD ────── */}
              <g className="char-group char-l">
                {/* Main Vertical Shard Body */}
                <polygon
                  points="475,45 512,65 518,215 465,215"
                  fill="url(#lGradVert)"
                />
                {/* Faceted Crystal Front Plane */}
                <polygon
                  points="475,45 512,65 538,180 505,215"
                  fill="#67E8F9"
                  opacity="0.9"
                />
                {/* Horizontal Crystalline Base Slab */}
                <polygon
                  points="505,180 585,185 565,215 465,215"
                  fill="#818CF8"
                />
                {/* Crystal Facet Specular Edge Lines */}
                <line
                  x1="475"
                  y1="45"
                  x2="538"
                  y2="180"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.8"
                />
                <line
                  x1="538"
                  y1="180"
                  x2="585"
                  y2="185"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.75"
                />
                {/* Sharp crystal apex spark */}
                <circle
                  cx="475"
                  cy="45"
                  r="4"
                  fill="#FFFFFF"
                  className="specular-glint"
                />
              </g>

              {/* ────── LETTER 'A': SNOW-CAPPED ARCH/MOUNTAIN SILHOUETTE WITH FACE ────── */}
              <g className="char-group char-a">
                {/* Mountain Silhouette Body */}
                <polygon
                  points="695,45 620,215 770,215"
                  fill="url(#aGradMtn)"
                />
                {/* Mountain Cave / Arch Opening */}
                <path
                  d="M 655,215 C 655,148 735,148 735,215 Z"
                  fill="#0A0A0A"
                />
                {/* Snow Cap Top */}
                <path
                  d="M 695,45 L 725,108 Q 712,118 700,106 Q 688,118 675,106 Q 662,118 665,108 Z"
                  fill="#FFFFFF"
                />

                {/* Peeking Cute Line-Art Face Inside Arch */}
                {/* Left Eye */}
                <ellipse
                  cx="684"
                  cy="168"
                  rx="3.5"
                  ry="4.5"
                  fill="#FFFFFF"
                  className="char-eye"
                />
                {/* Right Eye */}
                <ellipse
                  cx="706"
                  cy="168"
                  rx="3.5"
                  ry="4.5"
                  fill="#FFFFFF"
                  className="char-eye"
                />
                {/* Rosy Blush Accents */}
                <circle cx="676" cy="176" r="4.5" fill="#FB7185" opacity="0.85" />
                <circle cx="714" cy="176" r="4.5" fill="#FB7185" opacity="0.85" />
                {/* Happy Smile */}
                <path
                  d="M 690,176 Q 695,184 700,176"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </g>

              {/* ────── LETTER 'R': GLOSSY GRADIENT SPHERE WITH CARTOON FACE ────── */}
              <g className="char-group char-r">
                {/* Left Vertical Icicle Bar */}
                <rect
                  x="810"
                  y="45"
                  width="40"
                  height="170"
                  rx="20"
                  fill="#38BDF8"
                />
                {/* Diagonal Ice Leg */}
                <polygon
                  points="860,140 895,140 940,215 905,215"
                  fill="#22D3EE"
                />
                <circle cx="922" cy="215" r="10" fill="#22D3EE" />

                {/* Big Glossy Gradient Sphere Head */}
                <circle
                  cx="885"
                  cy="98"
                  r="54"
                  fill="url(#rGradSphere)"
                />
                {/* Specular Light Curve */}
                <ellipse
                  cx="865"
                  cy="72"
                  rx="18"
                  ry="10"
                  transform="rotate(-28 865 72)"
                  fill="#FFFFFF"
                  opacity="0.85"
                />

                {/* Minimal Cartoon Face on Sphere */}
                {/* Dot Eyes */}
                <circle
                  cx="875"
                  cy="96"
                  r="4.5"
                  fill="#0A0A0A"
                  className="char-eye"
                />
                <circle
                  cx="898"
                  cy="96"
                  r="4.5"
                  fill="#0A0A0A"
                  className="char-eye"
                />
                {/* Small Open Mouth (Warm Coral Accent) */}
                <ellipse
                  cx="886"
                  cy="110"
                  rx="4.5"
                  ry="6"
                  fill="#FB7185"
                />
              </g>

            </g>

            {/* ═══════════════════════════════════════════════════════════
               2. OUTLINE LAYER FOR "POLAR" (PLAIN BOLD VECTOR STROKES)
               Same font weight and bounds as TWIN, stroke only, no fill
               ═══════════════════════════════════════════════════════════ */}
            <g
              className="outline-polar-layer"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* P Outline */}
              <g className="outline-group outline-p">
                <path d="M 138,215 L 138,45 L 202,45 C 238,45 255,68 255,98 C 255,128 238,150 202,150 L 138,150" />
              </g>

              {/* O Outline */}
              <g className="outline-group outline-o">
                <path d="M 355,45 C 415,45 435,85 435,130 C 435,175 415,215 355,215 C 295,215 275,175 275,130 C 275,85 295,45 355,45 Z" />
              </g>

              {/* L Outline */}
              <g className="outline-group outline-l">
                <path d="M 485,45 L 485,215 L 585,215" />
              </g>

              {/* A Outline */}
              <g className="outline-group outline-a">
                <path d="M 635,215 L 695,45 L 755,215 M 658,154 L 732,154" />
              </g>

              {/* R Outline */}
              <g className="outline-group outline-r">
                <path d="M 822,215 L 822,45 L 882,45 C 918,45 938,68 938,98 C 938,128 918,150 882,150 L 822,150 M 882,150 L 938,215" />
              </g>
            </g>

            {/* ═══════════════════════════════════════════════════════════
               3. LINE 2: "TWIN" (SOLID BOLD ROUNDED WHITE SANS-SERIF)
               Increased vertical space beneath line 1
               ═══════════════════════════════════════════════════════════ */}
            <g
              className="twin-solid-layer"
              fill="#FFFFFF"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              {/* LETTER 'T' */}
              <g className="twin-char twin-t">
                {/* Horizontal Top Bar */}
                <rect x="160" y="265" width="170" height="42" rx="14" />
                {/* Vertical Stem */}
                <rect x="224" y="265" width="42" height="180" rx="14" />
              </g>

              {/* LETTER 'W' */}
              <g className="twin-char twin-w">
                {/* Left Down Stroke */}
                <polygon points="360,265 400,265 444,435 406,435" />
                {/* Left Inner Up Stroke */}
                <polygon points="406,435 444,435 476,310 446,310" />
                {/* Right Inner Down Stroke */}
                <polygon points="446,310 476,310 508,435 470,435" />
                {/* Right Up Stroke */}
                <polygon points="470,435 508,435 552,265 512,265" />
                {/* Soft rounded base joins */}
                <circle cx="425" cy="431" r="18" />
                <circle cx="489" cy="431" r="18" />
              </g>

              {/* LETTER 'I' */}
              <g className="twin-char twin-i">
                <rect x="590" y="265" width="46" height="180" rx="16" />
              </g>

              {/* LETTER 'N' */}
              <g className="twin-char twin-n">
                {/* Left Vertical Bar */}
                <rect x="680" y="265" width="44" height="180" rx="14" />
                {/* Diagonal Slash */}
                <polygon points="680,265 720,265 845,445 805,445" />
                {/* Right Vertical Bar */}
                <rect x="805" y="265" width="44" height="180" rx="14" />
              </g>
            </g>
          </svg>
        </div>
      </main>
    </section>
  );
}
