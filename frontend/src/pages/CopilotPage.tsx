import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Bot, Sparkles } from 'lucide-react';
import OperationsCopilot from '../components/copilot/OperationsCopilot';

export const CopilotPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-copilot-item',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="gsap-copilot-item flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-violet-100 p-2.5 text-violet-600 shadow-xs ring-1 ring-violet-200">
            <Bot size={22} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Polaris AI Operations Copilot</h1>
              <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600 border border-violet-200">
                <Sparkles size={10} /> LLM REASONING
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Station intelligence engine — autonomous diagnostics, ranked recommendations and one-click execution.
            </p>
          </div>
        </div>
      </div>

      <div className="gsap-copilot-item">
        <OperationsCopilot />
      </div>
    </div>
  );
};

export default CopilotPage;

