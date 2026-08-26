import { Bot } from 'lucide-react';
import OperationsCopilot from '../components/copilot/OperationsCopilot';

export const CopilotPage = () => {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-violet-100 p-2.5 text-violet-600">
          <Bot size={20} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">AI Operations Copilot</h1>
          <p className="text-sm text-slate-400">
            Polaris AI — live diagnostics, ranked recommendations and one-click execution.
          </p>
        </div>
      </div>
      <OperationsCopilot />
    </div>
  );
};

export default CopilotPage;
