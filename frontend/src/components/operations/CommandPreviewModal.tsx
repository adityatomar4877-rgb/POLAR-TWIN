import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Zap, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { previewCommand, executeCommand } from '../../api/operations';
import type { CommandRequest } from '../../api/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stationId: number | string;
  request: CommandRequest | null;
}

export const CommandPreviewModal = ({ isOpen, onClose, stationId, request }: Props) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'PREVIEW' | 'EXECUTING' | 'RESULT'>('PREVIEW');
  const [executionMessage, setExecutionMessage] = useState<string>('');
  
  const { data: preview, isLoading: isPreviewing, error } = useQuery({
    queryKey: ['preview', stationId, request],
    queryFn: () => request ? previewCommand(stationId, {
      command_type: request.command_type,
      target_id: request.target_id,
      parameters: request.parameters,
    }) : Promise.reject('No request'),
    enabled: isOpen && !!request && step === 'PREVIEW',
    retry: false,
  });

  const execMutation = useMutation({
    mutationFn: () => {
      if (!request) return Promise.reject('No request');
      return executeCommand(stationId, {
        ...request,
        confirmed: true,
      });
    },
    onSuccess: (data) => {
      setStep('RESULT');
      setExecutionMessage(data.message || 'Command executed successfully.');
      queryClient.invalidateQueries({ queryKey: ['equipment', stationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
      queryClient.invalidateQueries({ queryKey: ['alerts', stationId] });
    },
    onError: (err: any) => {
      console.error('Execution failed', err);
      setExecutionMessage(err?.response?.data?.message || 'Execution failed due to safety interlock violation.');
      setStep('RESULT');
    }
  });

  if (!isOpen || !request) return null;

  const handleAuthorize = () => {
    setStep('EXECUTING');
    execMutation.mutate();
  };

  const handleClose = () => {
    setStep('PREVIEW');
    setExecutionMessage('');
    onClose();
  };

  const isSafe = preview ? preview.safe : false;
  const energyDelta = preview?.impact?.energy_delta_kw ?? preview?.impact?.generation_change_kw ?? 0;
  const riskLevel = preview?.impact?.risk_level || (isSafe ? 'LOW' : 'HIGH');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold font-mono tracking-widest text-slate-200">
              COMMAND_AUTHORIZATION_REQUIRED
            </h2>
          </div>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-300">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-mono text-slate-500">REQUESTED_ACTION</div>
            <div className="text-xl font-bold text-cyan-400">{request.command_type}</div>
            <div className="text-sm font-mono text-slate-400">
              TARGET: {request.target_type || 'EQUIPMENT'} #{request.target_id ?? 'N/A'}
            </div>
          </div>

          {step === 'PREVIEW' && (
            <>
              {isPreviewing ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <Zap className="w-8 h-8 text-amber-500 animate-pulse" />
                  <span className="font-mono text-sm tracking-widest text-slate-400">
                    SIMULATING_SYSTEM_IMPACT...
                  </span>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-950/30 border border-red-900/50 rounded flex gap-3 text-red-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div className="text-sm">
                    Command preview rejected by remote safety interlocks.
                  </div>
                </div>
              ) : preview ? (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950 rounded border border-slate-800">
                      <div className="text-xs font-mono text-slate-500 mb-1">IMPACT: ENERGY_DELTA</div>
                      <div className={`text-2xl font-bold font-mono ${energyDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {energyDelta > 0 ? '+' : ''}{energyDelta} kW
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950 rounded border border-slate-800">
                      <div className="text-xs font-mono text-slate-500 mb-1">RISK_LEVEL</div>
                      <div className={`text-2xl font-bold font-mono ${riskLevel === 'HIGH' || riskLevel === 'CRITICAL' ? 'text-red-500' : riskLevel === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {riskLevel}
                      </div>
                    </div>
                  </div>

                  {preview.warnings && preview.warnings.length > 0 && (
                    <div className="p-4 bg-amber-950/20 border border-amber-900/50 rounded">
                      <div className="flex items-center gap-2 text-amber-500 font-bold text-sm mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        SYSTEM_WARNINGS
                      </div>
                      <ul className="list-disc pl-5 text-sm text-amber-200/80 space-y-1">
                        {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}

                  {preview.recommendations && preview.recommendations.length > 0 && (
                    <div className="p-4 bg-cyan-950/20 border border-cyan-900/50 rounded">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm mb-2 font-mono">
                        RECOMMENDATIONS
                      </div>
                      <ul className="list-disc pl-5 text-sm text-cyan-200/80 space-y-1">
                        {preview.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}

                  {!preview.safe && (
                    <div className="p-4 bg-red-950/20 border border-red-900/50 rounded flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-red-500 font-bold text-sm">SAFETY_INTERLOCK_ENGAGED</div>
                        <div className="text-red-200/80 text-sm mt-1">
                          This command violates hard safety constraints (e.g. sole online generator shutdown). Confirmation required.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}

          {step === 'EXECUTING' && (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 border-4 border-slate-800 border-t-cyan-500 rounded-full animate-spin" />
              <span className="font-mono text-sm tracking-widest text-slate-400">
                EXECUTING_COMMAND...
              </span>
            </div>
          )}

          {step === 'RESULT' && (
            <div className="py-8 flex flex-col items-center justify-center gap-4 animate-in zoom-in-95">
              {execMutation.isError ? (
                <XCircle className="w-16 h-16 text-red-500" />
              ) : (
                <CheckCircle className="w-16 h-16 text-emerald-500" />
              )}
              <span className={`font-mono font-bold tracking-widest text-lg ${execMutation.isError ? 'text-red-400' : 'text-emerald-400'}`}>
                {execMutation.isError ? 'EXECUTION_FAILED' : 'EXECUTION_SUCCESSFUL'}
              </span>
              <p className="text-slate-300 text-sm text-center max-w-md font-mono">
                {executionMessage}
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
          {step === 'RESULT' ? (
            <button 
              onClick={handleClose}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono text-sm transition-colors"
            >
              CLOSE
            </button>
          ) : (
            <>
              <button 
                onClick={handleClose}
                disabled={step === 'EXECUTING'}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 font-mono text-sm transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button 
                onClick={handleAuthorize}
                disabled={!preview || step === 'EXECUTING'}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-mono text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]"
              >
                {step === 'EXECUTING' ? 'PROCESSING...' : 'AUTHORIZE_EXECUTION'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
