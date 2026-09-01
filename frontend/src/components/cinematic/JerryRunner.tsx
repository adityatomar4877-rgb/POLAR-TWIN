import { useEffect, useState, useRef } from 'react';

interface JerryRunnerProps {
  progress: number; // 0.0 to 1.0 from horizontal scroll
  isInsideHorizontal: boolean;
}

export function JerryRunner({ progress, isInsideHorizontal }: JerryRunnerProps) {
  const [jerryPos, setJerryPos] = useState({
    x: -100,
    y: -100,
    rotate: 0,
    isJumping: false,
    isAtEnd: false,
    visible: false,
  });
  const [isMoving, setIsMoving] = useState(false);
  const [legCycle, setLegCycle] = useState(0);
  const lastProgressRef = useRef(progress);
  const moveTimeoutRef = useRef<number | null>(null);

  // Detect scroll movement: ONLY run when scrolling, stop and stare in front when not
  useEffect(() => {
    const delta = Math.abs(progress - lastProgressRef.current);
    if (delta > 0.00012) {
      setIsMoving(true);
      setLegCycle((prev) => (prev + 1) % 4);

      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
      moveTimeoutRef.current = window.setTimeout(() => {
        setIsMoving(false); // Stop immediately and stare forward when scrolling stops
      }, 130);
    }
    lastProgressRef.current = progress;
  }, [progress]);

  // Physics engine for running across all 7 cards and reaching the very bottom-right of Card 7
  useEffect(() => {
    const updatePhysics = () => {
      const cards = document.querySelectorAll('.slide-story-card');
      if (!cards || cards.length < 7) return;

      const footHeightOffset = 48; // Sits precisely on card's 1px bottom border

      let x = 0;
      let y = 0;
      let rotate = 0;
      let isJumping = false;
      let isAtEnd = false;

      // Map progress [0, 1] into 6 transition segments
      const u = Math.max(0, Math.min(6, progress * 6));
      const segment = Math.min(5, Math.floor(u));
      const t = u - segment; // Intra-segment progress [0, 1]

      if (segment < 5) {
        // ─── CARDS 1 TO 6 (SEGMENTS 0 TO 4) ───
        const cCurrent = cards[segment].getBoundingClientRect();
        const cNext = cards[segment + 1].getBoundingClientRect();

        if (t <= 0.65) {
          // Running on current card bottom border from left to right
          const runP = t / 0.65;
          const startX = cCurrent.left + 25;
          const endX = cCurrent.right - 18;
          x = startX + (endX - startX) * runP;
          y = cCurrent.bottom - footHeightOffset;
          rotate = 0;
        } else {
          // Leaping across the physical gap into next card
          isJumping = true;
          const jumpP = (t - 0.65) / 0.35;
          const startX = cCurrent.right - 15;
          const targetX = cNext.left + 25;
          x = startX + (targetX - startX) * jumpP;

          const baseStartY = cCurrent.bottom - footHeightOffset;
          const baseTargetY = cNext.bottom - footHeightOffset;
          const interpolatedY = baseStartY + (baseTargetY - baseStartY) * jumpP;
          const arc = Math.sin(jumpP * Math.PI) * 75; // 75px high leap
          y = interpolatedY - arc;
          rotate = Math.sin(jumpP * Math.PI) * 24; // Forward leaping tilt
        }
      } else {
        // ─── SEGMENT 5 (TRANSITION FROM CARD 6 TO CARD 7 & FULL RUN TO VERY END) ───
        const c6 = cards[5].getBoundingClientRect(); // 6th card
        const c7 = cards[6].getBoundingClientRect(); // 7th card (Final slide)

        if (t <= 0.35) {
          // Finish run on Card 6
          const runP = t / 0.35;
          const startX = c6.left + 25;
          const endX = c6.right - 18;
          x = startX + (endX - startX) * runP;
          y = c6.bottom - footHeightOffset;
          rotate = 0;
        } else if (t <= 0.58) {
          // Final Leap from Card 6 to Card 7
          isJumping = true;
          const jumpP = (t - 0.35) / 0.23;
          const startX = c6.right - 15;
          const targetX = c7.left + 25;
          x = startX + (targetX - startX) * jumpP;

          const baseStartY = c6.bottom - footHeightOffset;
          const baseTargetY = c7.bottom - footHeightOffset;
          const interpolatedY = baseStartY + (baseTargetY - baseStartY) * jumpP;
          const arc = Math.sin(jumpP * Math.PI) * 75;
          y = interpolatedY - arc;
          rotate = Math.sin(jumpP * Math.PI) * 24;
        } else {
          // SPRINT ALL THE WAY ACROSS CARD 7 TO THE VERY BOTTOM-RIGHT CORNER!
          const runP = (t - 0.58) / 0.42;
          const startX = c7.left + 25;
          const endX = c7.right - 14; // The very right tip of the card border
          x = startX + (endX - startX) * Math.min(1, runP);
          y = c7.bottom - footHeightOffset;
          rotate = 0;

          // When reaching the end (t >= 0.94 or progress >= 0.99), trigger "IT'S TOO COLD!" pose
          if (t >= 0.94 || progress >= 0.99) {
            isAtEnd = true;
            x = c7.right - 14; // Locked at the very bottom-right corner
          }
        }
      }

      setJerryPos({
        x,
        y,
        rotate,
        isJumping,
        isAtEnd,
        visible: isInsideHorizontal || progress > 0,
      });
    };

    updatePhysics();
    window.addEventListener('resize', updatePhysics);
    window.addEventListener('scroll', updatePhysics, { passive: true });
    return () => {
      window.removeEventListener('resize', updatePhysics);
      window.removeEventListener('scroll', updatePhysics);
    };
  }, [progress, isInsideHorizontal]);

  if (!jerryPos.visible && progress <= 0) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 transition-opacity duration-300 select-none will-change-transform"
      style={{
        left: `${jerryPos.x}px`,
        top: `${jerryPos.y}px`,
        transform: `translate3d(-50%, 0, 0) rotate(${jerryPos.rotate}deg)`,
        opacity: jerryPos.visible ? 1 : 0,
      }}
    >
      {/* ─── FLOATING "IT'S TOO COLD!" EMOTE BUBBLE AT VERY BOTTOM-RIGHT OF CARD 7 ─── */}
      {jerryPos.isAtEnd && (
        <div className="absolute -top-16 -left-14 flex items-center gap-1.5 rounded-full border border-sky-400/80 bg-[#071328]/95 px-3.5 py-1.5 font-mono text-[11px] font-black text-sky-200 shadow-[0_4px_25px_rgba(56,189,248,0.6)] backdrop-blur-md animate-bounce whitespace-nowrap">
          <span className="text-base">🥶</span>
          <span className="tracking-tight uppercase">BRRR... IT'S TOO COLD!</span>
          <span className="text-xs">❄️</span>
          {/* Speech bubble tail pointer */}
          <div className="absolute -bottom-1 left-16 h-2.5 w-2.5 rotate-45 border-r border-b border-sky-400/80 bg-[#071328]" />
        </div>
      )}

      {/* ─── DUST PUFF PARTICLES (ONLY WHEN ACTIVELY RUNNING) ─── */}
      {isMoving && !jerryPos.isJumping && !jerryPos.isAtEnd && (
        <div className="absolute bottom-1 -left-3 flex gap-1 pointer-events-none opacity-80 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-white/60 blur-[0.5px]" />
          <span className="h-2 w-2 rounded-full bg-white/40 blur-[0.5px] -translate-y-1" />
        </div>
      )}

      {/* ─── FLOATING FROST PARTICLES WHEN SHIVERING AT THE END ─── */}
      {jerryPos.isAtEnd && (
        <div className="absolute -top-2 -right-2 flex flex-col items-center pointer-events-none animate-pulse">
          <span className="text-[10px] text-sky-300 animate-spin" style={{ animationDuration: '4s' }}>❄</span>
          <span className="text-[8px] text-sky-400 -translate-x-2">❄</span>
        </div>
      )}

      {/* ─── AUTHENTIC TOM & JERRY CARTOON JERRY MOUSE SVG CHARACTER ─── */}
      <div
        className={`relative h-15 w-15 transition-transform duration-100 ${
          jerryPos.isAtEnd
            ? 'animate-[jerryShiver_0.12s_infinite]'
            : isMoving && !jerryPos.isJumping
            ? 'scale-y-[0.94] scale-x-[1.06] -rotate-6' // Sprinting athletic lean forward
            : 'scale-100' // Upright standing & staring in front
        }`}
      >
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)]"
        >
          <defs>
            {/* Classic Hanna-Barbera Jerry fur gradient */}
            <linearGradient id="classicJerryFur" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#B45309" />
              <stop offset="35%" stopColor="#9A3412" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>

            {/* Soft cream muzzle & chest gradient */}
            <linearGradient id="classicJerryTan" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#FDE047" />
            </linearGradient>

            {/* Inner ear rosy pink gradient */}
            <linearGradient id="classicJerryPink" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDA4AF" />
              <stop offset="100%" stopColor="#F43F5E" />
            </linearGradient>

            {/* Frost Blue Gradient */}
            <linearGradient id="jerryFrost" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#BAE6FD" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
          </defs>

          {/* 1. SIGNATURE THIN S-CURVE MOUSE TAIL */}
          {jerryPos.isAtEnd ? (
            // Shivering curled tail
            <path
              d="M 28 66 Q 16 72 18 60 Q 20 54 26 58"
              fill="none"
              stroke="#78350F"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          ) : jerryPos.isJumping ? (
            // Tail trailing straight in air during jump
            <path
              d="M 24 64 Q 10 60 2 50"
              fill="none"
              stroke="#78350F"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          ) : isMoving ? (
            // Wavy sprint tail
            <path
              d={`M 26 64 Q 14 ${legCycle % 2 === 0 ? 52 : 72} 8 ${legCycle % 2 === 0 ? 68 : 48}`}
              fill="none"
              stroke="#78350F"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          ) : (
            // Classic idle relaxed Jerry tail curling up gracefully
            <path
              d="M 28 66 Q 14 74 12 60 Q 10 46 18 40"
              fill="none"
              stroke="#78350F"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          )}

          {/* 2. LEGS & FEET */}
          {jerryPos.isAtEnd ? (
            // Shivering huddled feet
            <g>
              <ellipse cx="44" cy="86" rx="7" ry="4" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" />
              <ellipse cx="56" cy="86" rx="7" ry="4" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" />
            </g>
          ) : jerryPos.isJumping ? (
            // Tucked legs in air
            <g>
              <ellipse cx="36" cy="74" rx="7" ry="5" fill="#FDE047" transform="rotate(-25 36 74)" stroke="#78350F" strokeWidth="1.2" />
              <ellipse cx="62" cy="70" rx="7" ry="5" fill="#FDE047" transform="rotate(25 62 70)" stroke="#78350F" strokeWidth="1.2" />
            </g>
          ) : isMoving ? (
            // Running leg strides (ONLY active while scrolling)
            <g>
              <ellipse
                cx={legCycle % 2 === 0 ? 30 : 58}
                cy={legCycle % 2 === 0 ? 82 : 86}
                rx="8"
                ry="4.5"
                transform={legCycle % 2 === 0 ? 'rotate(-22 30 82)' : 'rotate(16 58 86)'}
                fill="#FDE047"
                stroke="#78350F"
                strokeWidth="1.2"
              />
              <ellipse
                cx={legCycle % 2 === 0 ? 66 : 34}
                cy={legCycle % 2 === 0 ? 86 : 82}
                rx="8"
                ry="4.5"
                transform={legCycle % 2 === 0 ? 'rotate(22 66 86)' : 'rotate(-16 34 82)'}
                fill="#FDE047"
                stroke="#78350F"
                strokeWidth="1.2"
              />
            </g>
          ) : (
            // IDLE STARE IN FRONT: Both feet planted side-by-side on bottom border line
            <g>
              <ellipse cx="40" cy="86" rx="7.5" ry="4.5" fill="#FDE047" stroke="#78350F" strokeWidth="1.2" />
              <ellipse cx="58" cy="86" rx="7.5" ry="4.5" fill="#FDE047" stroke="#78350F" strokeWidth="1.2" />
            </g>
          )}

          {/* 3. PEAR-SHAPED BODY & OVAL CHEST/TUMMY PATCH */}
          <ellipse cx="48" cy="62" rx="19" ry="21" fill="url(#classicJerryFur)" stroke="#78350F" strokeWidth="1.5" />
          {/* Classic cream/yellow belly patch */}
          <ellipse cx="50" cy="64" rx="12" ry="15" fill={jerryPos.isAtEnd ? 'url(#jerryFrost)' : 'url(#classicJerryTan)'} />

          {/* 4. ARMS & HANDS */}
          {jerryPos.isAtEnd ? (
            // Shivering wrapped arms hugging himself
            <g>
              <path d="M 32 54 Q 46 64 60 56" fill="none" stroke="url(#classicJerryFur)" strokeWidth="6" strokeLinecap="round" />
              <circle cx="61" cy="56" r="3.5" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1" />
              <path d="M 64 56 Q 50 66 36 58" fill="none" stroke="url(#classicJerryFur)" strokeWidth="5.5" strokeLinecap="round" />
              <circle cx="35" cy="58" r="3.5" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1" />
            </g>
          ) : jerryPos.isJumping ? (
            // Flying outstretched jump arms
            <g>
              <path d="M 40 56 Q 50 48 68 42" fill="none" stroke="url(#classicJerryFur)" strokeWidth="5" strokeLinecap="round" />
              <circle cx="70" cy="42" r="3.5" fill="#FDE047" />
              <path d="M 38 60 Q 46 54 62 50" fill="none" stroke="url(#classicJerryFur)" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="64" cy="50" r="3" fill="#FDE047" />
            </g>
          ) : isMoving ? (
            // Pumping running arms (ONLY active while scrolling)
            <g>
              <path
                d={legCycle % 2 === 0 ? "M 42 56 Q 56 50 68 58" : "M 42 56 Q 30 50 24 58"}
                fill="none"
                stroke="url(#classicJerryFur)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <circle cx={legCycle % 2 === 0 ? 69 : 23} cy="58" r="3.5" fill="#FDE047" />
            </g>
          ) : (
            // IDLE STARE IN FRONT: Classic Jerry standing with hands on hips
            <g>
              {/* Left hand on hip */}
              <path d="M 36 56 Q 27 60 33 66" fill="none" stroke="url(#classicJerryFur)" strokeWidth="4.8" strokeLinecap="round" />
              <circle cx="33" cy="66" r="3" fill="#FDE047" />
              {/* Right hand on hip */}
              <path d="M 60 56 Q 69 60 63 66" fill="none" stroke="url(#classicJerryFur)" strokeWidth="4.8" strokeLinecap="round" />
              <circle cx="63" cy="66" r="3" fill="#FDE047" />
            </g>
          )}

          {/* 5. BIG ROUND MOUSE EARS (WITH DISTINCTIVE HANNA-BARBERA INNER OVALS) */}
          {/* Back/Left Ear */}
          <circle cx="33" cy="22" r="14.5" fill="url(#classicJerryFur)" stroke="#78350F" strokeWidth="1.5" />
          <ellipse cx="34" cy="23" rx="9" ry="10" fill={jerryPos.isAtEnd ? '#BAE6FD' : 'url(#classicJerryPink)'} />

          {/* Front/Right Ear */}
          <circle cx="66" cy="19" r="15.5" fill="url(#classicJerryFur)" stroke="#78350F" strokeWidth="1.5" />
          <ellipse cx="65" cy="20" rx="9.5" ry="10.5" fill={jerryPos.isAtEnd ? '#BAE6FD' : 'url(#classicJerryPink)'} />

          {/* 6. DISTINCTIVE TUFT OF 3 HAIRS BETWEEN EARS (SIGNATURE JERRY FEATURE) */}
          <path d="M 48 22 Q 46 15 43 13" stroke="#78350F" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M 51 21 Q 52 14 51 11" stroke="#78350F" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M 54 22 Q 56 15 59 13" stroke="#78350F" strokeWidth="1.6" fill="none" strokeLinecap="round" />

          {/* 7. HEAD & CHUBBY CHEEKS */}
          <circle cx="50" cy="38" rx="17.5" ry="16.5" fill="url(#classicJerryFur)" stroke="#78350F" strokeWidth="1.5" />

          {/* Cream Muzzle & Chubby Jowls */}
          <ellipse cx="58" cy="43" rx="12" ry="9" fill={jerryPos.isAtEnd ? '#E0F2FE' : 'url(#classicJerryTan)'} />
          <ellipse cx="44" cy="44" rx="10" ry="8.5" fill={jerryPos.isAtEnd ? '#E0F2FE' : 'url(#classicJerryTan)'} />

          {/* 8. EYES & EXPRESSION */}
          {jerryPos.isAtEnd ? (
            // Shivering frosty eyes with tear
            <g>
              <ellipse cx="45" cy="32" rx="5.5" ry="8" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.2" />
              <ellipse cx="57" cy="31" rx="6" ry="8.5" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.2" />
              <circle cx="45" cy="33" r="2.6" fill="#0369A1" />
              <circle cx="57" cy="32" r="2.8" fill="#0369A1" />
              <circle cx="44" cy="31" r="1" fill="#FFFFFF" />
              <circle cx="56" cy="30" r="1.2" fill="#FFFFFF" />
              <path d="M 39 22 Q 44 25 48 21" fill="none" stroke="#0284C7" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M 54 21 Q 58 25 63 21" fill="none" stroke="#0284C7" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M 42 38 Q 40 42 42 45 Q 44 42 42 38" fill="#38BDF8" />
            </g>
          ) : isMoving ? (
            // RUNNING EYES: Focused forward in sprint direction
            <g>
              <ellipse cx="47" cy="32" rx="5" ry="7.5" fill="#FFFFFF" stroke="#451A03" strokeWidth="1.2" />
              <ellipse cx="58" cy="31" rx="5.5" ry="8" fill="#FFFFFF" stroke="#451A03" strokeWidth="1.2" />
              <circle cx="49" cy="32" r="3" fill="#18181B" />
              <circle cx="60" cy="31" r="3.2" fill="#18181B" />
              <circle cx="48" cy="30" r="1.2" fill="#FFFFFF" />
              <circle cx="59" cy="29" r="1.3" fill="#FFFFFF" />
              <path d="M 43 23 Q 48 19 51 22" fill="none" stroke="#451A03" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M 55 22 Q 60 18 64 22" fill="none" stroke="#451A03" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          ) : (
            // IDLE STARE IN FRONT: Big curious eyes looking directly straight at the user
            <g>
              <ellipse cx="44" cy="32" rx="6" ry="8.5" fill="#FFFFFF" stroke="#451A03" strokeWidth="1.3" />
              <ellipse cx="56" cy="32" rx="6" ry="8.5" fill="#FFFFFF" stroke="#451A03" strokeWidth="1.3" />
              {/* Centered pupils staring straight ahead */}
              <circle cx="44" cy="32" r="3.4" fill="#18181B" />
              <circle cx="56" cy="32" r="3.4" fill="#18181B" />
              {/* Dual glint catchlights */}
              <circle cx="42.5" cy="30" r="1.3" fill="#FFFFFF" />
              <circle cx="54.5" cy="30" r="1.3" fill="#FFFFFF" />
              <circle cx="45.5" cy="33.5" r="0.7" fill="#FFFFFF" />
              <circle cx="57.5" cy="33.5" r="0.7" fill="#FFFFFF" />
              {/* Friendly arched eyebrows */}
              <path d="M 39 21 Q 44 16 49 20" fill="none" stroke="#451A03" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M 52 20 Q 57 16 62 21" fill="none" stroke="#451A03" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          )}

          {/* 9. SIGNATURE TRIANGULAR BLACK BUTTON NOSE */}
          <ellipse cx="64" cy="39" rx="3.8" ry="2.8" fill={jerryPos.isAtEnd ? '#0284C7' : '#18181B'} />
          <ellipse cx="63" cy="38" rx="1.2" ry="0.8" fill="#FFFFFF" />

          {/* 10. MOUTH & SMILE */}
          {jerryPos.isAtEnd ? (
            // Chattering zigzag teeth line
            <g>
              <path
                d="M 50 46 L 53 49 L 56 46 L 59 49 L 62 46"
                fill="none"
                stroke="#0284C7"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polygon points="56,49 59,49 57.5,55" fill="#7DD3FC" opacity="0.9" />
            </g>
          ) : (
            // Classic cheeky Jerry grin with pink tongue
            <g>
              <path d="M 48 44 Q 56 52 64 43" fill="none" stroke="#451A03" strokeWidth="1.6" strokeLinecap="round" />
              {/* Subtle rosy tongue */}
              <path d="M 52 47 Q 56 53 60 47" fill="#F43F5E" />
            </g>
          )}

          {/* 11. 3 CRISP WHISKERS ON EACH CHEEK */}
          <g>
            <line x1="66" y1="41" x2="84" y2="39" stroke={jerryPos.isAtEnd ? '#38BDF8' : '#334155'} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="65" y1="43" x2="83" y2="45" stroke={jerryPos.isAtEnd ? '#38BDF8' : '#334155'} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="48" y1="43" x2="32" y2="42" stroke={jerryPos.isAtEnd ? '#38BDF8' : '#334155'} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="47" y1="45" x2="33" y2="47" stroke={jerryPos.isAtEnd ? '#38BDF8' : '#334155'} strokeWidth="1.2" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      {/* ─── PHYSICAL SHADOW BENEATH JERRY ON CARD BORDER ─── */}
      <div
        className={`mx-auto h-1.5 rounded-full bg-black/60 blur-[1.5px] transition-all duration-150 ${
          jerryPos.isJumping ? 'w-5 opacity-20 translate-y-12' : jerryPos.isAtEnd ? 'w-10 opacity-80' : 'w-12 opacity-65'
        }`}
      />
    </div>
  );
}
