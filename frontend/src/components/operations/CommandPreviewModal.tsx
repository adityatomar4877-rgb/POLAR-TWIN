import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { ShieldAlert, Zap, AlertTriangle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { previewCommand, executeCommand } from '../../api/operations';
import type { CommandRequest } from '../../api/types';
import InteractiveHoverButton from '../motion/InteractiveHoverButton';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stationId: number | string;
  request: CommandRequest | null;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/* ── Animation Variants ── */
const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 24, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -12,
    filter: 'blur(4px)',
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const contentVariants: Variants = {
  enter: { opacity: 0, y: 12, scale: 0.98 },
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: { duration: 0.2 },
  },
};

/* ── GSAP Number Counter Hook ── */
function useCountUp(target: number, duration = 0.8) {
  const ref = useRef<HTMLSpanElement>(null);
  const currentRef = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    const proxy = { val: currentRef.current };
    const tween = gsap.to(proxy, {
      val: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          const v = proxy.val;
          ref.current.textContent = `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
        }
      },
      onComplete: () => { currentRef.current = target; },
    });
    return () => { tween.kill(); };
  }, [target, duration]);

  return ref;
}

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
      // Enhanced confetti burst with timing
      setTimeout(() => {
        void confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.65 },
          colors: ['#22d3ee', '#10b981', '#38bdf8', '#f1f5f9'],
          disableForReducedMotion: true,
          gravity: 0.8,
          ticks: 200,
        });
      }, 200);
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

  // Compute energyDelta early so the hook order is stable across renders.
  // This must be called unconditionally (Rules of Hooks).
  const _energyDelta =
    num(preview?.impact?.energy_delta_kw) ??
    num(preview?.impact?.generation_change_kw) ??
    num(preview?.impact?.consumption_reduction_kw) ??
    num(preview?.impact?.energy_balance_change_kw) ??
    0;
  const energyCountRef = useCountUp(_energyDelta, 1);

  if (!request) return null;

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
  const energyDelta = _energyDelta;
  const batteryDelta = num(preview?.impact?.battery_drop_percent);
  const riskLevel = preview?.impact?.risk_level || (isSafe ? 'LOW' : 'HIGH');

  /* Before/after projected state readouts */
  const curBal = num(preview?.current_state?.energy_balance) ?? num(preview?.current_state?.energy_balance_kw);
  const projBal = num(preview?.projected_state?.energy_balance) ?? num(preview?.projected_state?.projected_energy_balance_kw) ?? num(preview?.projected_state?.energy_balance_kw);
  const curBat = num(preview?.current_state?.battery_percentage);
  const projBat = num(preview?.projected_state?.battery_percentage);
  const hasProjection = [curBal, projBal, curBat, projBat].some((v) => v != null);

  const targetLabel = (() => {
    if (request.target_id != null) return `#${request.target_id}`;
    if (request.parameters?.load_group) return `[${request.parameters.load_group}]`;
    if (request.target_type === 'LOAD_GROUP') return '[NON_CRITICAL]';
    return '[STATION]';
  })();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.25 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={handleClose}
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.3 }}
          />

          {/* Modal */}
          <motion.div
            className="glass-panel-strong relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -8, 8, -4, 0] }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                </motion.div>
                <h2 className="font-mono text-base font-bold tracking-widest text-slate-800">
                  COMMAND_AUTHORIZATION_REQUIRED
                </h2>
              </div>
              <motion.button
                onClick={handleClose}
                className="text-slate-400 transition-colors hover:text-slate-600 cursor-pointer"
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <XCircle className="h-5 w-5" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="custom-scrollbar flex flex-col gap-5 overflow-y-auto p-6">
              <motion.div
                className="flex flex-col gap-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
              >
                <div className="font-mono text-xs tracking-wider text-slate-500">REQUESTED_ACTION</div>
                <div className="text-xl font-bold text-cyan-600">{request.command_type}</div>
                <div className="font-mono text-sm text-slate-500">
                  TARGET: {request.target_type || 'EQUIPMENT'} {targetLabel}
                </div>
                {request.reason && (
                  <div className="mt-1 font-mono text-xs italic text-slate-400">REASON: "{request.reason}"</div>
                )}
              </motion.div>

              {/* Step-based content with crossfade */}
              <AnimatePresence mode="wait">
                {step === 'PREVIEW' && (
                  <motion.div
                    key="preview"
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {isPreviewing ? (
                      <div className="flex flex-col items-center justify-center gap-4 py-12">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        >
                          <Zap className="h-8 w-8 text-amber-500" />
                        </motion.div>
                        <span className="font-mono text-sm tracking-widest text-slate-500">
                          SIMULATING_SYSTEM_IMPACT...
                        </span>
                        {/* Progress bar */}
                        <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: '80%' }}
                            transition={{ duration: 2, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    ) : error ? (
                      <motion.div
                        className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      >
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <div className="font-mono text-sm">
                          {(error as any)?.response?.data?.message ||
                            'Command preview rejected by remote safety interlocks.'}
                        </div>
                      </motion.div>
                    ) : preview ? (
                      <div className="flex flex-col gap-4">
                        {/* Impact cards */}
                        <div className="grid grid-cols-2 gap-3">
                          <motion.div
                            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                          >
                            <div className="mb-1 font-mono text-xs text-slate-500">IMPACT: ENERGY_DELTA</div>
                            <div
                              className={`font-mono text-2xl font-bold ${
                                energyDelta >= 0 ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              <span ref={energyCountRef}>
                                {energyDelta > 0 ? '+' : ''}
                                {energyDelta.toFixed(1)}
                              </span>
                              {' '}kW
                            </div>
                          </motion.div>
                          <motion.div
                            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                          >
                            <div className="mb-1 font-mono text-xs text-slate-500">RISK_LEVEL</div>
                            <motion.div
                              className={`font-mono text-2xl font-bold ${
                                riskLevel === 'HIGH' || riskLevel === 'CRITICAL'
                                  ? 'text-red-500'
                                  : riskLevel === 'MEDIUM'
                                    ? 'text-amber-500'
                                    : 'text-emerald-600'
                              }`}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.25 }}
                            >
                              {riskLevel}
                            </motion.div>
                          </motion.div>
                        </div>

                        {/* Before → After projection */}
                        {hasProjection && (
                          <motion.div
                            className="rounded-lg border border-cyan-200 bg-cyan-50 p-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <div className="mb-3 flex items-center gap-2 font-mono text-xs font-bold tracking-widest text-cyan-700">
                              PROJECTED_STATE_TRANSITION
                              <motion.div
                                animate={{ x: [0, 4, 0] }}
                                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </motion.div>
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
                          </motion.div>
                        )}

                        {preview.warnings && preview.warnings.length > 0 && (
                          <motion.div
                            className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.25 }}
                          >
                            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-600">
                              <AlertTriangle className="h-4 w-4" />
                              SYSTEM_WARNINGS
                            </div>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                              {preview.warnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </motion.div>
                        )}

                        {preview.recommendations && preview.recommendations.length > 0 && (
                          <motion.div
                            className="rounded-lg border border-cyan-200 bg-cyan-50 p-4"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                          >
                            <div className="mb-2 flex items-center gap-2 font-mono text-sm font-bold text-cyan-700">
                              RECOMMENDATIONS
                            </div>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-cyan-700">
                              {preview.recommendations.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </motion.div>
                        )}

                        {!preview.safe && (
                          <motion.div
                            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.35 }}
                          >
                            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                            <div>
                              <div className="text-sm font-bold text-red-600">SAFETY_INTERLOCK_ENGAGED</div>
                              <div className="mt-1 text-sm text-red-700/80">
                                This command violates hard safety constraints (e.g. sole online generator shutdown).
                                Supervisor override confirmation required.
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    ) : null}
                  </motion.div>
                )}

                {step === 'EXECUTING' && (
                  <motion.div
                    key="executing"
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="flex flex-col items-center justify-center gap-4 py-12"
                  >
                    {/* Animated spinner ring */}
                    <div className="relative h-16 w-16">
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-slate-200 border-t-cyan-500"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      <motion.div
                        className="absolute inset-1 rounded-full border-2 border-transparent border-b-blue-400 opacity-60"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      />
                    </div>
                    <span className="font-mono text-sm tracking-widest text-slate-500">EXECUTING_COMMAND...</span>
                    <motion.div
                      className="w-32 h-0.5 bg-slate-200 rounded-full overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ width: '60%' }}
                      />
                    </motion.div>
                  </motion.div>
                )}

                {step === 'RESULT' && (
                  <motion.div
                    key="result"
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="flex flex-col items-center justify-center gap-4 py-8"
                  >
                    {execMutation.isError ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      >
                        <XCircle className="h-16 w-16 text-red-500" />
                      </motion.div>
                    ) : (
                      /* Animated success checkmark */
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                        className="relative"
                      >
                        <motion.div
                          className="absolute inset-0 rounded-full bg-emerald-100"
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1.3, 1] }}
                          transition={{ duration: 0.6, times: [0, 0.6, 1] }}
                        />
                        <CheckCircle className="relative h-16 w-16 text-emerald-500" />
                      </motion.div>
                    )}
                    <motion.span
                      className={`font-mono text-lg font-bold tracking-widest ${
                        execMutation.isError ? 'text-red-600' : 'text-emerald-600'
                      }`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      {execMutation.isError ? 'EXECUTION_FAILED' : 'EXECUTION_SUCCESSFUL'}
                    </motion.span>
                    <motion.p
                      className="max-w-md text-center font-mono text-sm text-slate-600"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      {executionMessage}
                    </motion.p>
                    {!execMutation.isError && (
                      <motion.p
                        className="font-mono text-[10px] tracking-widest text-slate-400"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        OPERATION RECORDED TO AUDIT TRAIL · DIGITAL TWIN UPDATING VIA LIVE LINK
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Actions */}
            <motion.div
              className="flex justify-end gap-3 border-t border-slate-200 bg-white/80 px-6 py-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              {step === 'RESULT' ? (
                <motion.button
                  onClick={handleClose}
                  className="rounded-md bg-slate-100 px-6 py-2 font-mono text-sm text-slate-700 transition-colors hover:bg-slate-200 cursor-pointer"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  CLOSE
                </motion.button>
              ) : (
                <>
                  <motion.button
                    onClick={handleClose}
                    disabled={step === 'EXECUTING'}
                    className="px-4 py-2 font-mono text-sm text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    CANCEL
                  </motion.button>
                  <InteractiveHoverButton
                    onClick={handleAuthorize}
                    disabled={!preview || step === 'EXECUTING'}
                    loading={step === 'EXECUTING'}
                    variant="cyan"
                    text={step === 'EXECUTING' ? 'PROCESSING...' : 'AUTHORIZE_EXECUTION'}
                    className="px-6 py-2 shadow-[0_2px_14px_rgba(6,182,212,0.35)]"
                  />
                </>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPreviewModal;
