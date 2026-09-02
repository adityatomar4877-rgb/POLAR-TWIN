import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface Props {
  collapsed?: boolean;
}

export default function PolarTwinBrandLogo({ collapsed = false }: Props) {
  if (collapsed) {
    return (
      <Link to="/" title="POLAR TWIN — Remote Operations Center">
        <motion.div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50/80 border border-sky-200/70 shadow-xs cursor-pointer group"
          whileHover={{ scale: 1.08, rotate: 2 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        >
          {/* Collapsed Icon: The Iconic P-Paw Ice Character */}
          <svg viewBox="0 0 160 170" className="h-7 w-7 select-none drop-shadow-xs">
            <defs>
              <linearGradient id="collapsedPStem" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="60%" stopColor="#0284C7" />
                <stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
            </defs>
            {/* P Main Stem */}
            <rect x="25" y="10" width="38" height="150" rx="19" fill="url(#collapsedPStem)" />
            {/* P Lobe */}
            <path
              d="M 40,10 L 95,10 C 128,10 145,30 145,58 C 145,86 128,106 95,106 L 40,106 Z"
              fill="url(#collapsedPStem)"
            />
            {/* Highlight */}
            <path
              d="M 44,16 L 90,16 C 114,16 126,28 126,46 C 126,55 118,63 104,63 L 44,63 Z"
              fill="#FFFFFF"
              opacity="0.6"
            />
            {/* Paw Print */}
            <circle cx="92" cy="58" r="12" fill="#FFFFFF" opacity="0.95" />
            <circle cx="72" cy="44" r="5" fill="#38BDF8" />
            <circle cx="92" cy="37" r="5" fill="#38BDF8" />
            <circle cx="111" cy="47" r="4.5" fill="#38BDF8" />
          </svg>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link
      to="/"
      title="POLAR TWIN — Remote Operations Center"
      className="group flex flex-col justify-center select-none cursor-pointer py-1"
    >
      <div className="flex items-center gap-2.5">
        {/* Full Illustrated POLAR TWIN Logo SVG */}
        <div className="flex flex-col">
          <svg
            viewBox="0 0 1000 440"
            className="h-9 w-auto select-none transition-transform duration-200 group-hover:scale-[1.02]"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="logoPStem" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="60%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#818CF8" />
              </linearGradient>

              <linearGradient id="logoPGloss" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="logoOTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#BAE6FD" />
              </linearGradient>

              <linearGradient id="logoOLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>

              <linearGradient id="logoORight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#4F46E5" />
              </linearGradient>

              <linearGradient id="logoLVert" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#818CF8" />
              </linearGradient>

              <linearGradient id="logoAMtn" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#818CF8" />
              </linearGradient>

              <radialGradient id="logoRSphere" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="30%" stopColor="#E0F2FE" />
                <stop offset="65%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#6366F1" />
              </radialGradient>
            </defs>

            {/* ═══════════════════════════════════════════════════════════
               1. ROW 1: "POLAR" (5 Illustrated Arctic Characters)
               ═══════════════════════════════════════════════════════════ */}
            <g className="logo-polar-chars">
              {/* LETTER 'P' (Paw Capsule) */}
              <g className="char-p">
                <rect x="20" y="20" width="44" height="170" rx="22" fill="url(#logoPStem)" />
                <path d="M 38,20 L 102,20 C 138,20 155,43 155,73 C 155,103 138,125 102,125 L 38,125 Z" fill="url(#logoPStem)" />
                <path d="M 42,27 L 96,27 C 122,27 135,40 135,60 C 135,70 126,79 110,79 L 42,79 Z" fill="url(#logoPGloss)" opacity="0.75" />
                <rect x="28" y="33" width="10" height="110" rx="5" fill="#FFFFFF" opacity="0.6" />
                <circle cx="95" cy="73" r="14" fill="#FFFFFF" opacity="0.95" />
                <circle cx="72" cy="57" r="6" fill="#38BDF8" />
                <circle cx="95" cy="49" r="6" fill="#38BDF8" />
                <circle cx="116" cy="61" r="5" fill="#38BDF8" />
              </g>

              {/* LETTER 'O' (Isometric Cube) */}
              <g className="char-o">
                <polygon points="255,17 325,55 255,93 185,55" fill="url(#logoOTop)" />
                <polygon points="185,55 255,93 255,183 185,145" fill="url(#logoOLeft)" />
                <polygon points="255,93 325,55 325,145 255,183" fill="url(#logoORight)" />
                <polygon points="255,51 292,71 255,91 218,71" fill="#0A0A0A" />
                <polygon points="218,71 255,91 255,135 218,115" fill="#0284C7" opacity="0.85" />
                <polygon points="255,91 292,71 292,115 255,135" fill="#1E1B4B" />
                <circle cx="255" cy="17" r="5" fill="#FFFFFF" />
                <polygon points="255,13 259,17 255,21 251,17" fill="#FB7185" opacity="0.9" />
              </g>

              {/* LETTER 'L' (Origami Shard) */}
              <g className="char-l">
                <polygon points="375,20 412,40 418,190 365,190" fill="url(#logoLVert)" />
                <polygon points="375,20 412,40 438,155 405,190" fill="#67E8F9" opacity="0.9" />
                <polygon points="405,155 485,160 465,190 365,190" fill="#818CF8" />
                <line x1="375" y1="20" x2="438" y2="155" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                <line x1="438" y1="155" x2="485" y2="160" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
                <circle cx="375" cy="20" r="4" fill="#FFFFFF" />
              </g>

              {/* LETTER 'A' (Snowy Peak with Smiley Face) */}
              <g className="char-a">
                <polygon points="595,20 520,190 670,190" fill="url(#logoAMtn)" />
                <path d="M 555,190 C 555,123 635,123 635,190 Z" fill="#0A0A0A" />
                <path d="M 595,20 L 625,83 Q 612,93 600,81 Q 588,93 575,81 Q 562,93 565,83 Z" fill="#FFFFFF" />
                <ellipse cx="585" cy="155" rx="3.5" ry="4.5" fill="#FFFFFF" />
                <ellipse cx="605" cy="155" rx="3.5" ry="4.5" fill="#FFFFFF" />
                <path d="M 588,168 Q 595,175 602,168" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="578" cy="164" r="3.5" fill="#FB7185" opacity="0.85" />
                <circle cx="612" cy="164" r="3.5" fill="#FB7185" opacity="0.85" />
              </g>

              {/* LETTER 'R' (Bubble Sphere Creature) */}
              <g className="char-r">
                <rect x="705" y="20" width="40" height="170" rx="20" fill="url(#logoLVert)" />
                <path d="M 755,115 L 815,190 L 785,190 L 735,125 Z" fill="#22D3EE" />
                <circle cx="780" cy="72" r="54" fill="url(#logoRSphere)" />
                <ellipse cx="762" cy="50" rx="14" ry="9" fill="#FFFFFF" opacity="0.85" transform="rotate(-28 762 50)" />
                <circle cx="766" cy="72" r="4.5" fill="#0A0A0A" />
                <circle cx="792" cy="72" r="4.5" fill="#0A0A0A" />
                <circle cx="767.5" cy="70" r="1.5" fill="#FFFFFF" />
                <circle cx="793.5" cy="70" r="1.5" fill="#FFFFFF" />
                <ellipse cx="779" cy="84" rx="4" ry="5.5" fill="#F43F5E" />
              </g>
            </g>

            {/* ═══════════════════════════════════════════════════════════
               2. ROW 2: "TWIN" (Solid Bold Sans-Serif)
               ═══════════════════════════════════════════════════════════ */}
            <g className="logo-twin-chars" fill="#0F172A">
              {/* LETTER 'T' */}
              <g className="twin-t">
                <rect x="65" y="240" width="165" height="42" rx="14" />
                <rect x="127" y="240" width="42" height="170" rx="14" />
              </g>

              {/* LETTER 'W' */}
              <g className="twin-w">
                <polygon points="260,240 300,240 344,410 306,410" />
                <polygon points="306,410 344,410 376,285 346,285" />
                <polygon points="346,285 376,285 408,410 370,410" />
                <polygon points="370,410 408,410 452,240 412,240" />
                <circle cx="325" cy="406" r="18" />
                <circle cx="389" cy="406" r="18" />
              </g>

              {/* LETTER 'I' */}
              <g className="twin-i">
                <rect x="495" y="240" width="46" height="170" rx="16" />
              </g>

              {/* LETTER 'N' */}
              <g className="twin-n">
                <rect x="585" y="240" width="44" height="170" rx="14" />
                <polygon points="585,240 625,240 750,420 710,420" />
                <rect x="710" y="240" width="44" height="170" rx="14" />
              </g>
            </g>
          </svg>

          {/* Subtitle tag */}
          <p className="text-[7.5px] font-mono font-bold tracking-[0.22em] text-sky-600 uppercase pl-0.5 mt-0.5">
            REMOTE OPERATIONS CENTER
          </p>
        </div>
      </div>
    </Link>
  );
}
