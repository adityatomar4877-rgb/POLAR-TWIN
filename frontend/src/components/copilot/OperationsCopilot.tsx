import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BrainCircuit,
  PlayCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  Sliders,
  ShieldAlert,
  Zap,
  Wind,
  Wrench,
  Fuel,
  RefreshCw,
  Bot,
  User,
  Info,
} from 'lucide-react';
import { useStation } from '../../context/StationContext';
import { getStationRecommendations, executeRecommendation } from '../../api/stations';
import {
  askCopilotChat,
  assessStationRisk,
  getStationDiagnostic,
  getCopilotStatus,
} from '../../api/copilot';
import type {
  OperationalRecommendation,
  ChatMessage,
  RiskAssessmentResponse,
  DiagnosticResponse,
} from '../../api/types';

interface Props {
  compact?: boolean;
}

export default function OperationsCopilot({ compact = false }: Props) {
  const { selectedStationId } = useStation();
  const qc = useQueryClient();

  // Local state for interactive chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [activeQueryKey, setActiveQueryKey] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customProvider, setCustomProvider] = useState<string>('');
  const [customModel, setCustomModel] = useState<string>('');

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Query: Copilot Provider & Engine Status
  const { data: copilotStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['copilot-status'],
    queryFn: getCopilotStatus,
    refetchInterval: 30000,
  });

  // Query: Real LLM Live Diagnostic
  const {
    data: diagnosticData,
    isLoading: isDiagLoading,
    refetch: refetchDiagnostic,
  } = useQuery<DiagnosticResponse>({
    queryKey: ['copilot-diagnostic', selectedStationId, customProvider, customModel],
    queryFn: () => getStationDiagnostic(selectedStationId, customProvider, customModel),
    refetchInterval: 25000,
  });

  // Query: Real LLM Risk Assessment
  const {
    data: riskAssessment,
    refetch: refetchRisk,
  } = useQuery<RiskAssessmentResponse>({
    queryKey: ['copilot-risk', selectedStationId, customProvider, customModel],
    queryFn: () => assessStationRisk(selectedStationId, customProvider, customModel),
    refetchInterval: 30000,
  });

  // Query: Operational Recommendations
  const { data: recommendations, isLoading: isRecsLoading } = useQuery<OperationalRecommendation[]>({
    queryKey: ['recommendations', selectedStationId],
    queryFn: () => getStationRecommendations(selectedStationId),
    refetchInterval: 20000,
  });

  // Mutation: Execute Recommendation
  const executeRec = useMutation({
    mutationFn: (recId: number) => executeRecommendation(recId, selectedStationId),
    onSuccess: (_data, recId) => {
      qc.setQueryData<OperationalRecommendation[] | undefined>(
        ['recommendations', selectedStationId],
        (old) => old?.map((r) => (r.id === recId ? { ...r, status: 'EXECUTED' } : r))
      );
      qc.invalidateQueries({ queryKey: ['equipment', selectedStationId] });
      qc.invalidateQueries({ queryKey: ['dashboard', selectedStationId] });
      qc.invalidateQueries({ queryKey: ['alerts', selectedStationId] });
      qc.invalidateQueries({ queryKey: ['operations-history', selectedStationId] });
      qc.invalidateQueries({ queryKey: ['copilot-diagnostic', selectedStationId] });
      qc.invalidateQueries({ queryKey: ['copilot-risk', selectedStationId] });
    },
  });

  // Mutation: Chat with Copilot
  const chatMutation = useMutation({
    mutationFn: (userMsg: string) => {
      return askCopilotChat(
        selectedStationId,
        userMsg,
        messages,
        customProvider || undefined,
        customModel || undefined
      );
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error reaching LLM Copilot (${err?.message || 'Connection timeout'}). Please verify Ollama is running or check provider settings.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
  });

  const handleSendPrompt = (promptText?: string) => {
    const text = (promptText || inputPrompt).trim();
    if (!text || chatMutation.isPending) return;

    // Add user message to log
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      },
    ]);
    setInputPrompt('');
    chatMutation.mutate(text);
  };

  const handleQuickInquiry = (key: string, queryPrompt: string) => {
    setActiveQueryKey(key);
    handleSendPrompt(queryPrompt);
  };

  const activeProviderName =
    customProvider || copilotStatus?.active_provider || 'ollama';
  const activeModelName =
    customModel ||
    copilotStatus?.configured_model ||
    (activeProviderName === 'ollama' ? 'llama3.2' : 'gpt-4o-mini');

  const activeRecs = (recommendations ?? []).filter((r) => r.status === 'ACTIVE');

  // Overall risk color classes
  const riskScore = riskAssessment?.overall_score ?? 15;
  const riskLevel = riskAssessment?.risk_level ?? 'NOMINAL';
  const riskColor =
    riskScore >= 70
      ? 'text-red-600 bg-red-50 border-red-200'
      : riskScore >= 45
        ? 'text-amber-600 bg-amber-50 border-amber-200'
        : riskScore >= 25
          ? 'text-blue-600 bg-blue-50 border-blue-200'
          : 'text-emerald-600 bg-emerald-50 border-emerald-200';

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Header Bar with Provider & Model Status */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 border border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white shadow-xs">
            <BrainCircuit size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-xs font-bold tracking-[0.3em] text-slate-800">
                POLARIS AI COPILOT
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-mono text-[9px] font-bold text-violet-700">
                <Sparkles size={10} /> LLM REASONING
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Station multi-modal telemetry synthesis & autonomous risk evaluation
            </p>
          </div>
        </div>

        {/* Engine status pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 font-mono text-[10px]">
            <span
              className={clsx(
                'h-2 w-2 rounded-full',
                copilotStatus?.ollama_available || copilotStatus?.openai_available
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-cyan-500'
              )}
            />
            <span className="font-bold uppercase text-slate-700">
              {activeProviderName}
            </span>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-violet-600">{activeModelName}</span>
          </div>

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-colors shadow-2xs"
            title="Configure LLM Provider & Ollama Model"
          >
            <Sliders size={14} />
          </button>
        </div>
      </div>

      {/* 2. Live Diagnostic & Subsystems Status Panel */}
      <div className="glass-panel flex flex-col rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.35em] text-slate-500">
              LIVE TELEMETRY DIAGNOSTIC
            </span>
            {isDiagLoading && (
              <Loader2 size={12} className="animate-spin text-violet-600" />
            )}
          </div>
          <button
            onClick={() => {
              refetchDiagnostic();
              refetchRisk();
            }}
            className="flex items-center gap-1 font-mono text-[10px] text-slate-500 hover:text-violet-600 transition-colors"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        <p className="text-sm leading-relaxed text-slate-800 font-medium">
          {diagnosticData?.diagnostic_summary ||
            'All subsystems operating within nominal safety envelope. Live telemetry stream synchronized.'}
        </p>

        {/* Subsystems pills */}
        {diagnosticData?.subsystems_status && (
          <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {Object.entries(diagnosticData.subsystems_status).map(([sys, stat]) => (
              <span
                key={sys}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[9px] font-bold tracking-wider',
                  stat === 'CRITICAL'
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : stat === 'DEGRADED' || stat === 'WARNING'
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                )}
              >
                <span
                  className={clsx(
                    'h-1.5 w-1.5 rounded-full',
                    stat === 'CRITICAL'
                      ? 'bg-red-500'
                      : stat === 'DEGRADED' || stat === 'WARNING'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  )}
                />
                {sys}: {stat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. Deep Station Risk Assessment Matrix */}
      <div className="glass-panel flex flex-col rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-500" />
            <span className="font-mono text-[10px] font-bold tracking-[0.35em] text-slate-500">
              STATION RISK MATRIX
            </span>
          </div>
          <div className={clsx('flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold border', riskColor)}>
            <span>COMPOSITE RISK: {riskLevel}</span>
            <span className="font-extrabold font-mono">({riskScore.toFixed(0)}/100)</span>
          </div>
        </div>

        {/* 4 Risk Domain Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Energy Risk */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between text-slate-700 mb-1">
              <span className="flex items-center gap-1 font-mono text-[10px] font-bold">
                <Zap size={12} className="text-amber-500" /> Microgrid Power
              </span>
              <span className="font-mono text-[10px] font-bold text-slate-900">
                {riskAssessment?.energy_risk?.score.toFixed(0) ?? 10}/100
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden my-1.5">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${riskAssessment?.energy_risk?.score ?? 10}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
              {riskAssessment?.energy_risk?.key_factors?.[0] || 'Power generation exceeds consumption.'}
            </p>
          </div>

          {/* Weather Risk */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between text-slate-700 mb-1">
              <span className="flex items-center gap-1 font-mono text-[10px] font-bold">
                <Wind size={12} className="text-cyan-500" /> Atmosphere & EVA
              </span>
              <span className="font-mono text-[10px] font-bold text-slate-900">
                {riskAssessment?.weather_risk?.score.toFixed(0) ?? 10}/100
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden my-1.5">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${riskAssessment?.weather_risk?.score ?? 10}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
              {riskAssessment?.weather_risk?.key_factors?.[0] || 'Wind chill within nominal operating limit.'}
            </p>
          </div>

          {/* Equipment Risk */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between text-slate-700 mb-1">
              <span className="flex items-center gap-1 font-mono text-[10px] font-bold">
                <Wrench size={12} className="text-violet-500" /> Subsystems Health
              </span>
              <span className="font-mono text-[10px] font-bold text-slate-900">
                {riskAssessment?.equipment_risk?.score.toFixed(0) ?? 10}/100
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden my-1.5">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${riskAssessment?.equipment_risk?.score ?? 10}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
              {riskAssessment?.equipment_risk?.key_factors?.[0] || 'Primary generators & HVAC nominal.'}
            </p>
          </div>

          {/* Logistics Risk */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between text-slate-700 mb-1">
              <span className="flex items-center gap-1 font-mono text-[10px] font-bold">
                <Fuel size={12} className="text-emerald-500" /> Logistics & Fuel
              </span>
              <span className="font-mono text-[10px] font-bold text-slate-900">
                {riskAssessment?.logistics_risk?.score.toFixed(0) ?? 10}/100
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden my-1.5">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${riskAssessment?.logistics_risk?.score ?? 10}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
              {riskAssessment?.logistics_risk?.key_factors?.[0] || 'Fuel reserves exceed 45 days autonomy.'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Quick Inquiries & Interactive Chat Console */}
      <div className="glass-panel flex flex-col rounded-xl border border-slate-200 overflow-hidden">
        {/* Quick Inquiries Header & Buttons */}
        <div className="border-b border-slate-200 bg-slate-50/70 p-3">
          <p className="font-mono text-[9px] font-bold tracking-[0.35em] text-slate-500 mb-2">
            OPERATOR QUICK INQUIRIES
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              {
                key: 'RISK',
                label: 'ASSESS STATION RISK',
                prompt: 'Assess overall station operational risk, vulnerabilities, and safety envelope.',
              },
              {
                key: 'ENERGY',
                label: 'ANALYZE ENERGY DEFICIT',
                prompt: 'Analyze current microgrid generation, consumption deficit, and battery hours remaining.',
              },
              {
                key: 'OUTDOOR',
                label: 'EVALUATE OUTDOOR SAFETY',
                prompt: 'Evaluate outdoor EVA safety, wind chill, blizzard probability, and maximum safe exposure duration.',
              },
              {
                key: 'LOGISTICS',
                label: 'FUEL & AUTONOMY AUDIT',
                prompt: 'Audit station diesel fuel burn rate, days of autonomy remaining, and resupply requirements.',
              },
            ].map((q) => (
              <button
                key={q.key}
                onClick={() => handleQuickInquiry(q.key, q.prompt)}
                disabled={chatMutation.isPending}
                className={clsx(
                  'rounded-full border px-3 py-1.5 font-mono text-[9px] tracking-widest transition-all cursor-pointer font-bold',
                  activeQueryKey === q.key
                    ? 'border-violet-400 bg-violet-600 text-white shadow-xs'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700 shadow-2xs'
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Stream */}
        <div
          ref={chatScrollRef}
          className="flex flex-col gap-3 p-4 max-h-80 min-h-[160px] overflow-y-auto custom-scrollbar bg-white/40"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
              <Bot size={28} className="mb-2 text-violet-400 opacity-80" />
              <p className="text-xs font-semibold text-slate-600">
                Polaris AI Copilot Ready
              </p>
              <p className="text-[11px] max-w-sm mt-1">
                Ask any question about station health, power generation, weather constraints, or trigger quick inquiries above.
              </p>
            </div>
          )}

          {messages.map((m, idx) => (
            <div
              key={idx}
              className={clsx(
                'flex flex-col max-w-[90%] rounded-xl p-3.5 text-xs leading-relaxed transition-all shadow-2xs',
                m.role === 'user'
                  ? 'self-end bg-violet-600 text-white font-medium ml-8'
                  : 'self-start bg-slate-50 border border-slate-200 text-slate-800 mr-8'
              )}
            >
              <div className="flex items-center gap-1.5 font-mono text-[9px] opacity-75 mb-1">
                {m.role === 'user' ? (
                  <>
                    <User size={11} /> <span>OPERATOR</span>
                  </>
                ) : (
                  <>
                    <Bot size={11} className="text-violet-600" />
                    <span className="font-bold text-violet-700">POLARIS COPILOT</span>
                  </>
                )}
              </div>
              <div className="whitespace-pre-wrap font-sans text-xs">
                {m.content}
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="self-start flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-3.5 py-2.5 font-mono text-[11px] text-slate-600">
              <Loader2 size={13} className="animate-spin text-violet-600" />
              <span>Synthesizing live telemetry with {activeModelName}...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="flex items-center gap-2 border-t border-slate-200 bg-white p-2.5"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask Polaris anything about power balance, EVA safety, fuel autonomy, maintenance..."
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || chatMutation.isPending}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-4 py-2 font-mono text-xs font-bold text-white transition-all shadow-xs cursor-pointer',
              !inputPrompt.trim() || chatMutation.isPending
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-700 active:scale-98'
            )}
          >
            <Send size={13} /> Send
          </button>
        </form>
      </div>

      {/* 5. Autonomous Actionable Recommendations Feed */}
      {!compact && (
        <div className="glass-panel flex flex-col rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <span className="font-mono text-[10px] font-bold tracking-[0.35em] text-slate-500">
              OPERATIONAL RECOMMENDATIONS ({activeRecs.length})
            </span>
            {isRecsLoading && (
              <Loader2 size={12} className="animate-spin text-slate-400" />
            )}
          </div>

          {activeRecs.length === 0 && !isRecsLoading && (
            <div className="py-6 text-center font-mono text-[11px] text-slate-500">
              NO ACTIVE INTERVENTIONS REQUIRED — ALL ENVELOPES NOMINAL
            </div>
          )}

          <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
            {activeRecs.map((rec) => {
              const executing =
                executeRec.isPending && executeRec.variables === rec.id;
              const executed = rec.status === 'EXECUTED';

              return (
                <div
                  key={`${rec.id}-${rec.created_at}`}
                  className={clsx(
                    'rounded-lg border p-3 transition-colors shadow-2xs',
                    rec.severity === 'CRITICAL'
                      ? 'border-red-300 bg-red-50/60'
                      : rec.severity === 'WARNING'
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-slate-200 bg-slate-50'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] font-bold tracking-[0.25em] text-slate-500">
                      {rec.category}
                    </span>
                    <span
                      className={clsx(
                        'rounded px-1.5 py-0.5 font-mono text-[8px] font-extrabold tracking-widest',
                        rec.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-700'
                          : rec.severity === 'WARNING'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-cyan-100 text-cyan-700'
                      )}
                    >
                      {rec.severity}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm font-bold text-slate-900">{rec.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{rec.explanation}</p>

                  <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-200/50">
                    <p className="flex-1 font-mono text-[10px] text-cyan-700 font-semibold truncate">
                      ▸ {rec.suggested_action}
                    </p>

                    {executed ? (
                      <span className="flex items-center gap-1 font-mono text-[9px] font-bold tracking-widest text-emerald-600">
                        <CheckCircle2 size={12} /> EXECUTED
                      </span>
                    ) : executing ? (
                      <span className="flex items-center gap-1 font-mono text-[9px] font-bold tracking-widest text-violet-600">
                        <Loader2 size={12} className="animate-spin" /> EXECUTING
                      </span>
                    ) : (
                      <button
                        onClick={() => executeRec.mutate(rec.id)}
                        disabled={!rec.target_command_type}
                        className={clsx(
                          'flex items-center gap-1 rounded-md px-3 py-1 font-mono text-[9px] font-bold tracking-widest transition-all cursor-pointer shadow-2xs',
                          rec.target_command_type
                            ? 'bg-violet-600 hover:bg-violet-700 text-white active:scale-98'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        )}
                      >
                        <PlayCircle size={12} /> EXECUTE
                      </button>
                    )}
                  </div>

                  {executeRec.isError && executeRec.variables === rec.id && (
                    <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-red-600 font-bold">
                      <AlertTriangle size={11} /> EXECUTION REJECTED BY SAFETY INTERLOCK
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Settings Modal for LLM Provider / Ollama Model */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-violet-600" />
                <h4 className="font-bold text-sm text-slate-800">
                  Configure LLM Copilot Engine
                </h4>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-slate-600 mb-1">
                  LLM Provider
                </label>
                <select
                  value={customProvider || copilotStatus?.active_provider || 'ollama'}
                  onChange={(e) => setCustomProvider(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-violet-500 focus:outline-none"
                >
                  <option value="ollama">Ollama (Local / Self-Hosted)</option>
                  <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                  <option value="gemini">Google Gemini (1.5 Flash / Pro)</option>
                  <option value="groq">Groq (Ultra-Fast Llama 3.1)</option>
                  <option value="auto">Auto-Detect Best Available</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Model Selection / Ollama Tag
                </label>
                {copilotStatus?.ollama_models && copilotStatus.ollama_models.length > 0 ? (
                  <select
                    value={customModel || copilotStatus.configured_model}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-violet-500 focus:outline-none mb-1.5"
                  >
                    {copilotStatus.ollama_models.map((m) => (
                      <option key={m} value={m}>
                        {m} (Installed Locally)
                      </option>
                    ))}
                    <option value="custom">-- Type Custom Tag --</option>
                  </select>
                ) : null}

                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="e.g. llama3.2, mistral, deepseek-r1, gpt-4o-mini"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                <p className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Info size={12} className="text-violet-600" /> Ollama Connection
                </p>
                <p>
                  Ollama Base URL:{' '}
                  <code className="font-mono text-[10px] text-violet-700 bg-violet-50 px-1 py-0.5 rounded">
                    {copilotStatus?.ollama_base_url || 'http://localhost:11434'}
                  </code>
                </p>
                <p className="mt-1">
                  Ollama Status:{' '}
                  <span
                    className={clsx(
                      'font-bold',
                      copilotStatus?.ollama_available
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    )}
                  >
                    {copilotStatus?.ollama_available
                      ? 'Connected & Ready'
                      : 'Not Detected (Deterministic Fallback Active)'}
                  </span>
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    refetchStatus();
                    setShowConfigModal(false);
                  }}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 transition-colors shadow-xs"
                >
                  Save & Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
