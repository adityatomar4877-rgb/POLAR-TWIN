import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { ShieldAlert, Zap, AlertTriangle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { previewCommand, executeCommand } from '../../api/operations';
import type { CommandRequest } from '../../api/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stationId: number | string;
  request: CommandRequest | null;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export const CommandPreviewModal = ({ isOpen, onClose, stationId, request }: Props) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'PREVIEW' | 'EXECUTING' | 'RESULT'>('PREVIEW');
  const [executionMessage, setExecutionMessage] = useState<string>('');
  const [lastRequest, setLastRequest] = useState<CommandRequest | null>(request);

  // Adjust state during render when a new command request arrives
  if (request !== lastRequest) {
    setLastRequest(request);
    setStep('PREVIEW');
    setExecutionMessage('');
  }

  const { data: preview, isLoading: isPreviewing, error } = useQuery({
    queryKey: ['preview', stationId, request],
    queryFn: () =>
      request
        ? previewCommand(stationId, {
            command_type: request.command_type,
            target_id: request.target_id,
            parameters: request.parameters,
          })
        : Promise.reject(new Error('No request')),
    enabled: isOpen && !!request && step === 'PREVIEW',
    retry: false,
  });

  const execMutation = useMutation({
    mutationFn: () => {
      if (!request) return Promise.reject(new Error('No request'));
      return executeCommand(stationId, {
        ...request,
        confirmed: true,
      });
    },
    onSuccess: (data) => {
      setStep('RESULT');
      setExecutionMessage(data.message || 'Command executed successfully.');
      // Critical command execution success feedback
      void confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#22d3ee', '#10b981', '#38bdf8', '#f1f5f9'],
        disableForReducedMotion: true,
      });
      ['equipment', 'dashboard', 'alerts', 'operations-history', 'recommendations', 'loads'].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key, stationId] })
      );
    },
    onError: (err: any) => {
      setExecutionMessage(
        err?.response?.data?.message || err?.response?.data?.detail || 'Execution failed due to safety interlock violation.'
      );
      setStep('RESULT');
    },
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
  const energyDelta =
    num(preview?.impact?.energy_delta_kw) ?? num(preview?.impact?.generation_change_kw) ?? 0;
  const batteryDelta = num(preview?.impact?.battery_drop_percent);
  const riskLevel = preview?.impact?.risk_level || (isSafe ? 'LOW' : 'HIGH');

  /* Before/after projected state readouts */
  const curBal = num(preview?.current_state?.energy_balance);
  const projBal = num(preview?.projected_state?.energy_balance);
  const curBat = num(preview?.current_state?.battery_percentage);
  const projBat = num(preview?.projected_state?.battery_percentage);
  const hasProjection = [curBal, projBal, curBat, projBat].some((v) => v != null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="glass-panel-strong flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <h2 className="font-mono text-base font-bold tracking-widest text-slate-800">
              COMMAND_AUTHORIZATION_REQUIRED
            </h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 transition-colors hover:text-slate-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="custom-scrollbar flex flex-col gap-5 overflow-y-auto p-6">
          <div className="flex flex-col gap-1">
            <div className="font-mono text-xs tracking-wider text-slate-500">REQUESTED_ACTION</div>
            <div className="text-xl font-bold text-cyan-600">{request.command_type}</div>
            <div className="font-mono text-sm text-slate-500">
              TARGET: {request.target_type || 'EQUIPMENT'} #{request.target_id ?? 'N/A'}
            </div>
            {request.reason && (
              <div className="mt-1 font-mono text-xs italic text-slate-400">REASON: “{request.reason}”</div>
            )}
          </div>

          {step === 'PREVIEW' && (
            <>
              {isPreviewing ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Zap className="h-8 w-8 animate-pulse text-amber-500" />
                  <span className="font-mono text-sm tracking-widest text-slate-500">
                    SIMULATING_SYSTEM_IMPACT...
                  </span>
                </div>
              ) : error ? (
                <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div className="font-mono text-sm">
                    {(error as any)?.response?.data?.message ||
                      'Command preview rejected by remote safety interlocks.'}
                  </div>
                </div>
              ) : preview ? (
                <div className="flex flex-col gap-4">
                  {/* Impact cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-1 font-mono text-xs text-slate-500">IMPACT: ENERGY_DELTA</div>
                      <div
                        className={`font-mono text-2xl font-bold ${
                          energyDelta >= 0 ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {energyDelta > 0 ? '+' : ''}
                        {energyDelta} kW
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-1 font-mono text-xs text-slate-500">RISK_LEVEL</div>
                      <div
                        className={`font-mono text-2xl font-bold ${
                          riskLevel === 'HIGH' || riskLevel === 'CRITICAL'
                            ? 'text-red-500'
                            : riskLevel === 'MEDIUM'
                              ? 'text-amber-500'
                              : 'text-emerald-600'
                        }`}
                      >
                        {riskLevel}
                      </div>
                    </div>
                  </div>

                  {/* Before → After projection */}
                  {hasProjection && (
                    <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
                      <div className="mb-3 flex items-center gap-2 font-mono text-xs font-bold tracking-widest text-cyan-700">
                        PROJECTED_STATE_TRANSITION <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 font-mono text-sm">
                        <div className="space-y-1.5">
                          <p className="text-[10px] tracking-[0.3em] text-slate-500">CURRENT STATE</p>
                          <p className="text-slate-600">
                            BALANCE:{' '}
                            <span className={curBal != null && curBal < 0 ? 'text-red-600' : 'text-emerald-600'}>
                              {curBal != null ? `${curBal.toFixed(1)} kW` : '—'}
                            </span>
                          </p>
                          <p className="text-slate-600">
                            BATTERY:{' '}
                            <span className="font-semibold text-slate-800">
                              {curBat != null ? `${curBat.toFixed(1)}%` : '—'}
                            </span>
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[10px] tracking-[0.3em] text-cyan-600">PROJECTED STATE</p>
                          <p className="text-slate-700">
                            BALANCE:{' '}
                            <span
                              className={
                                projBal != null && projBal >= (curBal ?? 0) ? 'text-emerald-600' : 'text-amber-600'
                              }
                            >
                              {projBal != null ? `${projBal.toFixed(1)} kW` : '—'}
                            </span>
                          </p>
                          <p className="text-slate-700">
                            BATTERY:{' '}
                            <span className="font-semibold text-slate-800">
                              {projBat != null ? `${projBat.toFixed(1)}%` : '—'}
                            </span>
                          </p>
                        </div>
                      </div>
                      {batteryDelta != null && batteryDelta !== 0 && (
                        <p className="mt-2 font-mono text-xs text-slate-500">
                          BATTERY IMPACT:{' '}
                          <span className={batteryDelta > 0 ? 'text-emerald-600' : 'text-amber-600'}>
                            {batteryDelta > 0 ? '+' : ''}
                            {batteryDelta.toFixed(2)} %
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {preview.warnings && preview.warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        SYSTEM_WARNINGS
                      </div>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                        {preview.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {preview.recommendations && preview.recommendations.length > 0 && (
                    <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
                      <div className="mb-2 flex items-center gap-2 font-mono text-sm font-bold text-cyan-700">
                        RECOMMENDATIONS
                      </div>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-cyan-700">
                        {preview.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!preview.safe && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                      <div>
                        <div className="text-sm font-bold text-red-600">SAFETY_INTERLOCK_ENGAGED</div>
                        <div className="mt-1 text-sm text-red-700/80">
                          This command violates hard safety constraints (e.g. sole online generator shutdown).
                          Supervisor override confirmation required.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}

          {step === 'EXECUTING' && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
              <span className="font-mono text-sm tracking-widest text-slate-500">EXECUTING_COMMAND...</span>
            </div>
          )}

          {step === 'RESULT' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              {execMutation.isError ? (
                <XCircle className="h-16 w-16 text-red-500" />
              ) : (
                <CheckCircle className="h-16 w-16 text-emerald-500" />
              )}
              <span
                className={`font-mono text-lg font-bold tracking-widest ${
                  execMutation.isError ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {execMutation.isError ? 'EXECUTION_FAILED' : 'EXECUTION_SUCCESSFUL'}
              </span>
              <p className="max-w-md text-center font-mono text-sm text-slate-600">{executionMessage}</p>
              {!execMutation.isError && (
                <p className="font-mono text-[10px] tracking-widest text-slate-400">
                  OPERATION RECORDED TO AUDIT TRAIL · DIGITAL TWIN UPDATING VIA LIVE LINK
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-white/80 px-6 py-4">
          {step === 'RESULT' ? (
            <button
              onClick={handleClose}
              className="rounded-md bg-slate-100 px-6 py-2 font-mono text-sm text-slate-700 transition-colors hover:bg-slate-200"
            >
              CLOSE
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={step === 'EXECUTING'}
                className="px-4 py-2 font-mono text-sm text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={handleAuthorize}
                disabled={!preview || step === 'EXECUTING'}
                className="flex items-center gap-2 rounded-md bg-cyan-600 px-6 py-2 font-mono text-sm text-white shadow-[0_2px_12px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
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

export default CommandPreviewModal;
