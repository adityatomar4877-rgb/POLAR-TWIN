import { History } from 'lucide-react';
import CommandHistoryTable from '../components/operations/CommandHistoryTable';

export const AuditPage = ({ stationId }: { stationId: number }) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
          <History size={20} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Command History</h1>
          <p className="text-sm text-slate-400">
            Immutable audit trail of every operator and automated action.
          </p>
        </div>
      </div>
      <CommandHistoryTable stationId={stationId} className="max-h-none" />
    </div>
  );
};

export default AuditPage;
