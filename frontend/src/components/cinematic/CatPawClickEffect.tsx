import { useState, useEffect, useCallback } from 'react';

interface PawPrint {
  id: number;
  x: number;
  y: number;
  rotate: number;
}

export function CatPawClickEffect() {
  const [paws, setPaws] = useState<PawPrint[]>([]);

  const handlePointerDown = useCallback((e: MouseEvent | PointerEvent) => {
    // Avoid spawning if clicked on interactive elements that might prevent default
    const id = Date.now() + Math.random();
    const rotate = (Math.random() - 0.5) * 40; // -20deg to +20deg natural paw angle

    setPaws((prev) => [...prev, { id, x: e.clientX, y: e.clientY, rotate }]);

    // Remove this paw print after exactly 1 second (1000ms)
    setTimeout(() => {
      setPaws((prev) => prev.filter((p) => p.id !== id));
    }, 1000);
  }, []);

  useEffect(() => {
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [handlePointerDown]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none">
      {paws.map((paw) => (
        <div
          key={paw.id}
          className="absolute pointer-events-none will-change-transform"
          style={{
            left: `${paw.x}px`,
            top: `${paw.y}px`,
            animation: 'catPawFade 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
            transform: `translate(-50%, -50%) rotate(${paw.rotate}deg)`,
          }}
        >
          {/* ─── CARTOON CAT PAW PRINT (MAX 50% OPACITY) ─── */}
          <svg
            viewBox="0 0 60 60"
            className="h-10 w-10 text-slate-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
            fill="currentColor"
          >
            {/* 1. MAIN LARGE PALM PAD */}
            <path
              d="M 19 32 C 11 32 6 38 6 46 C 6 54 17 58 30 58 C 43 58 54 54 54 46 C 54 38 49 32 41 32 C 36 32 32 35 30 36 C 28 35 24 32 19 32 Z"
            />

            {/* 2. FOUR TOE BEANS WITH SUBTLE CLAW TIPS */}
            {/* Toe 1 (Far Left) */}
            <ellipse cx="12" cy="22" rx="4.5" ry="5.5" transform="rotate(-25 12 22)" />
            <path d="M 10 16 Q 11 12 13 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />

            {/* Toe 2 (Center Left) */}
            <ellipse cx="23" cy="14" rx="4.8" ry="6" transform="rotate(-8 23 14)" />
            <path d="M 22 7 Q 23 3 25 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />

            {/* Toe 3 (Center Right) */}
            <ellipse cx="37" cy="14" rx="4.8" ry="6" transform="rotate(8 37 14)" />
            <path d="M 35 5 Q 37 3 38 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />

            {/* Toe 4 (Far Right) */}
            <ellipse cx="48" cy="22" rx="4.5" ry="5.5" transform="rotate(25 48 22)" />
            <path d="M 47 14 Q 49 12 50 16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      ))}
    </div>
  );
}
