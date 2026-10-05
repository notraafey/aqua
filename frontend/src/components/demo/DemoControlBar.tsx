import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Radio,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  FastForward,
  Play,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ClipboardCheck,
  Globe,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { NavTab } from '../../layout/Sidebar.js';

export interface DemoStatusData {
  currentStage: number;
  stageName: string;
  stageDescription: string;
  reachId: string;
  reachName: string;
  incidentId: string | null;
  recommendationId: string | null;
  taskId: string | null;
  verificationId: string | null;
  outcomeId: string | null;
  confidenceScore: number | null;
  confidenceBand: string | null;
  hazardType: string | null;
  incidentStatus: string | null;
  recommendationStatus: string | null;
  taskStatus: string | null;
  outcomeStatus: string | null;
  outboxPendingCount: number;
  outboxDeliveredCount: number;
  lastAction: string;
  lastActionTimestamp: string;
  nextRecommendedAction: string;
  narrativeHint: string;
  stepsCompleted: string[];
}

interface DemoControlBarProps {
  onNavigate?: (tab: NavTab, entityId?: string) => void;
  onRefreshData?: () => void;
  onResetState?: () => Promise<any> | void;
}

const STAGE_LABELS = [
  '0. Baseline',
  '1. Sentinel-2 Alert',
  '2. Corroboration',
  '3. Decision Gate',
  '4. Dispatch Task',
  '5. Field Deployed',
  '6. Ground Truth',
  '7. Outcome Confirmed',
  '8. FHIR Outbox',
];

export const DemoControlBar: React.FC<DemoControlBarProps> = ({
  onNavigate,
  onRefreshData,
  onResetState,
}) => {
  const [status, setStatus] = useState<DemoStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showPresenterNotes, setShowPresenterNotes] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.getCanonicalDemoStatus();
      if (res) {
        setStatus(res);
      }
    } catch (err: any) {
      console.warn('Could not fetch demonstration status:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 4000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  // Listen for reset events triggered from any UI location
  useEffect(() => {
    const handleResetEvent = (e: any) => {
      if (e?.detail) {
        setStatus(e.detail);
      } else {
        fetchStatus();
      }
    };
    window.addEventListener('aquasentinel:reset-state', handleResetEvent);
    return () => window.removeEventListener('aquasentinel:reset-state', handleResetEvent);
  }, [fetchStatus]);

  const handleAdvanceStep = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await apiClient.advanceCanonicalDemoStep();
      if (res) setStatus(res);
      onRefreshData?.();

      // Contextual auto-navigation matching the 5-minute video demo script
      if (res.currentStage === 1) {
        // Stage 01/02: Sentinel-2 signal arrives (stay on reach/evidence)
        onNavigate?.('water-network');
      } else if (res.currentStage === 2) {
        // Stage 03: Evidence Assessments -> Quality & Uncertainty (25% score)
        onNavigate?.('monitoring-evidence');
      } else if (res.currentStage === 3) {
        // Stage 06/07: Incident Queue -> Active Incident & Recommendations
        onNavigate?.('incidents', res.incidentId || undefined);
      } else if (res.currentStage === 4) {
        // Stage 09: Response Operations -> Tasks (REQUESTED + FHIR)
        onNavigate?.('response-operations');
      } else if (res.currentStage === 5) {
        // Stage 10: Field Operations (Inspector on-site with Geofence)
        onNavigate?.('response-operations');
      } else if (res.currentStage === 6) {
        // Stage 12: Evidence Assessments (Closed Loop: score pushes to 100%)
        onNavigate?.('monitoring-evidence');
      } else if (res.currentStage === 7) {
        // Stage 13: Incident -> Confirm Outcome
        onNavigate?.('incidents', res.incidentId || undefined);
      } else if (res.currentStage === 8) {
        // Stage 14/15: Interoperability Hub (Outbox + HMAC + Consumer Ack)
        onNavigate?.('interoperability');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to advance demonstration stage');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunToGate = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await apiClient.runCanonicalDemoToGate();
      if (res) setStatus(res);
      onRefreshData?.();
      onNavigate?.('incidents', res.incidentId || undefined);
    } catch (err: any) {
      setActionError(err.message || 'Failed to run scenario to decision gate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      let res: any = null;
      if (onResetState) {
        res = await onResetState();
      } else {
        res = await apiClient.resetCanonicalDemo();
        onRefreshData?.();
      }
      if (res && res.stageName) {
        setStatus(res);
      } else {
        const fresh = await apiClient.getCanonicalDemoStatus();
        if (fresh) {
          setStatus(fresh);
        } else {
          setStatus({
            currentStage: 0,
            stageName: '01: Baseline Surveillance',
            stageDescription: 'Catchment in normal baseline monitoring. Historical DO ~8.2 mg/L, chlorophyll proxy < 0.15. Zero active incidents; no reason to intervene.',
            reachId: '7a3b4c12-89de-4f56-9abc-1234567890ab',
            reachName: 'Almyros Stream - Reach Alpha',
            incidentId: null,
            recommendationId: null,
            taskId: null,
            verificationId: null,
            outcomeId: null,
            confidenceScore: null,
            confidenceBand: null,
            hazardType: null,
            incidentStatus: null,
            recommendationStatus: null,
            taskStatus: null,
            outcomeStatus: null,
            outboxPendingCount: 0,
            outboxDeliveredCount: 0,
            lastAction: 'Reset baseline surveillance state',
            lastActionTimestamp: new Date().toISOString(),
            nextRecommendedAction: 'Ingest Sentinel-2 MSI satellite observation (NDCI 0.28)',
            narrativeHint: '“We’re looking at a monitored stream reach in the Volos catchment. At baseline, the system sees normal conditions: historical dissolved oxygen is around 8.2 mg/L, and the chlorophyll proxy remains below 0.15. So there is no reason to intervene.”',
            stepsCompleted: ['Stage 0: Clean baseline initialized for Almyros Stream - Reach Alpha.'],
          });
        }
      }
      onNavigate?.('water-network');
    } catch (err: any) {
      setActionError(err.message || 'Failed to reset demonstration baseline');
    } finally {
      setIsLoading(false);
    }
  };

  const currentStage = status?.currentStage ?? 0;

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-100 shadow-sm transition-all shrink-0 select-none">
      {/* Top Banner Bar */}
      <div className="px-4 py-1.5 flex items-center justify-between gap-3 text-xs">
        {/* Left: Mission Identity & Stage Indicator */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-950/80 border border-blue-500/30 text-blue-400 text-[11px] font-semibold">
            <Radio size={13} className="animate-pulse text-blue-400" />
            <span>INCIDENT CONTROLLER</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="font-semibold text-slate-200">Volos Catchment:</span>
            <span className="text-slate-400">{status?.reachName || 'Almyros Stream - Reach Alpha'}</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Current Stage:</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
              Stage {currentStage}: {status?.stageName || 'Surveillance Baseline'}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Buttons & Expand Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Fast Forward to Gate button (visible in stages 0, 1, 2) */}
          {currentStage < 3 && (
            <button
              onClick={handleRunToGate}
              disabled={isLoading}
              title="Fast-forward multi-source sensor convergence directly to the Human Review checkpoint"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <FastForward size={13} className="text-amber-400" />
              <span className="hidden sm:inline">Run to Decision Gate</span>
            </button>
          )}

          {/* Primary Advance / Reset Button */}
          <button
            onClick={currentStage >= 8 ? handleReset : handleAdvanceStep}
            disabled={isLoading}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-md ${
              currentStage >= 8
                ? 'bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-400/60 shadow-emerald-950/40 cursor-pointer animate-pulse'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing Pipeline...</span>
              </>
            ) : currentStage >= 8 ? (
              <>
                <RotateCcw size={13} className="text-white" />
                <span>Reset State (Restart Demo)</span>
              </>
            ) : (
              <>
                <Play size={13} className="fill-white" />
                <span>
                  {currentStage === 0
                    ? '1. Ingest Sentinel-2 Signal'
                    : currentStage === 1
                    ? '2. Ingest Ground Corroboration'
                    : currentStage === 2
                    ? '3. Fuse Multi-Sensor Evidence'
                    : currentStage === 3
                    ? '4. Review & Authorize Response'
                    : currentStage === 4
                    ? '5. Deploy Field Crew'
                    : currentStage === 5
                    ? '6. Submit Field Verification'
                    : currentStage === 6
                    ? '7. Confirm Incident Outcome'
                    : '8. Deliver Interoperability Webhook'}
                </span>
                <ChevronRight size={13} />
              </>
            )}
          </button>

          {/* Reset State button */}
          <button
            onClick={handleReset}
            disabled={isLoading}
            title="Reset catchment state to baseline surveillance (Stage 0)"
            className="px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 border border-slate-700 hover:border-rose-700/60 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RotateCcw size={13} className={`text-rose-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reset State</span>
          </button>

          {/* Toggle Presenter Notes */}
          <button
            onClick={() => setShowPresenterNotes(!showPresenterNotes)}
            title="Toggle presenter talking points and live narration guide"
            className={`px-2.5 py-1 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
              showPresenterNotes
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <Sparkles size={13} className={showPresenterNotes ? 'text-amber-400' : ''} />
            <span className="hidden md:inline">Presenter Guide</span>
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded Stage Progress Strip & Telemetry */}
      {isExpanded && (
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/60 space-y-3">
          {/* 8-Stage Visual Pipeline Bar */}
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
            {STAGE_LABELS.map((label, idx) => {
              const isPast = currentStage > idx;
              const isCurrent = currentStage === idx;
              return (
                <div
                  key={label}
                  className={`px-2 py-1.5 rounded-md border text-[11px] font-medium flex items-center justify-between transition-all ${
                    isCurrent
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                      : isPast
                      ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500'
                  }`}
                >
                  <span className="truncate">{label}</span>
                  {isPast ? (
                    <CheckCircle2 size={11} className="text-emerald-400 shrink-0 ml-1" />
                  ) : isCurrent ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping shrink-0 ml-1" />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Live Telemetry Badges & Quick Navigation Links */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
            {/* Live Operational Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {status?.incidentId && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-slate-300">
                  <ShieldAlert size={12} className="text-rose-400" />
                  <span>Incident:</span>
                  <span className="font-mono font-bold text-slate-100">{status.incidentId.slice(0, 8)}</span>
                  {status.hazardType && (
                    <span className="px-1.5 py-0.2 rounded bg-rose-900/60 text-rose-300 text-[10px] font-semibold">
                      {status.hazardType}
                    </span>
                  )}
                </div>
              )}

              {status?.confidenceScore !== null && status?.confidenceScore !== undefined && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-slate-300">
                  <Layers size={12} className="text-blue-400" />
                  <span>Confidence:</span>
                  <span
                    className={`font-bold font-mono ${
                      status.confidenceScore >= 80
                        ? 'text-rose-400'
                        : status.confidenceScore >= 60
                        ? 'text-amber-400'
                        : 'text-blue-400'
                    }`}
                  >
                    {status.confidenceScore}%
                  </span>
                  {status.confidenceBand && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-700 text-slate-200 text-[10px] font-semibold">
                      {status.confidenceBand}
                    </span>
                  )}
                </div>
              )}

              {status?.taskStatus && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-slate-300">
                  <ClipboardCheck size={12} className="text-purple-400" />
                  <span>Field Task:</span>
                  <span className="font-semibold text-purple-300">{status.taskStatus}</span>
                  {status.verificationId && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px]">
                      GEOFENCE VERIFIED
                    </span>
                  )}
                </div>
              )}

              {status?.outboxDeliveredCount !== undefined && status.outboxDeliveredCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                  <Globe size={12} className="text-emerald-400" />
                  <span>FHIR Interop:</span>
                  <span className="font-semibold text-emerald-200">
                    {status.outboxDeliveredCount} Delivered (HMAC-SHA256)
                  </span>
                </div>
              )}
            </div>

            {/* Quick Deep-Link Shortcuts for Evaluators */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="hidden sm:inline">Inspect:</span>
              <button
                onClick={() => onNavigate?.('water-network')}
                className="hover:text-blue-400 underline flex items-center gap-0.5"
              >
                Reach Map <ExternalLink size={10} />
              </button>
              <span>·</span>
              <button
                onClick={() => onNavigate?.('monitoring-evidence')}
                className="hover:text-blue-400 underline flex items-center gap-0.5"
              >
                Evidence Fusion <ExternalLink size={10} />
              </button>
              <span>·</span>
              <button
                onClick={() => onNavigate?.('incidents')}
                className="hover:text-blue-400 underline flex items-center gap-0.5"
              >
                Incidents <ExternalLink size={10} />
              </button>
              <span>·</span>
              <button
                onClick={() => onNavigate?.('response-operations')}
                className="hover:text-blue-400 underline flex items-center gap-0.5"
              >
                Response Tasks <ExternalLink size={10} />
              </button>
              <span>·</span>
              <button
                onClick={() => onNavigate?.('interoperability')}
                className="hover:text-blue-400 underline flex items-center gap-0.5"
              >
                FHIR Outbox <ExternalLink size={10} />
              </button>
              <span>·</span>
              <button
                onClick={() => onNavigate?.('system-health')}
                className="hover:text-blue-400 underline flex items-center gap-0.5"
              >
                System Health <ExternalLink size={10} />
              </button>
            </div>
          </div>

          {/* Action Error Notice */}
          {actionError && (
            <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Presenter Talking Points & Narration Guide */}
          {showPresenterNotes && (
            <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-600/30 text-amber-200 text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Sparkles size={13} />
                <span>Executive Presenter Talking Points (Stage {currentStage}):</span>
              </div>
              <p className="text-slate-300 leading-relaxed pl-5 font-normal">
                {status?.narrativeHint ||
                  'Demonstrate the real-time operational response workflow as an environmental officer managing the Volos municipal catchment basin.'}
              </p>
              <div className="pl-5 text-[11px] text-slate-400 flex items-center gap-3 pt-1">
                <span>
                  <strong className="text-slate-300">Next Action:</strong> {status?.nextRecommendedAction}
                </span>
                <span>·</span>
                <span>
                  <strong className="text-slate-300">Last Engine Event:</strong> {status?.lastAction}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
