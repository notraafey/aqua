import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { NavTab } from '../../layout/Sidebar.js';

export interface DemoStageDef {
  number: number;
  label: string;
  name: string;
  actionSummary: string;
}

export const DEMO_STAGES: DemoStageDef[] = [
  { number: 0, label: '00', name: 'Clean Baseline', actionSummary: 'System Reset & Surveillance Mode' },
  { number: 1, label: '01', name: 'Baseline Surveillance', actionSummary: 'Normal Catchment Telemetry (DO ~8.2, NDCI <0.15)' },
  { number: 2, label: '02', name: 'Sentinel-2 Remote Alert', actionSummary: 'Stream Reaches Updated (NDCI 0.28 Anomaly)' },
  { number: 3, label: '03', name: 'Initial Evidence Assessment', actionSummary: 'Evidence Assessments (25% Score, NORMAL Band)' },
  { number: 4, label: '04', name: 'Corroboration Ingestion', actionSummary: 'In-Situ DO 2.6 mg/L, Heatwave 31.8°C, Citizen Scum' },
  { number: 5, label: '05', name: 'Evidence Fusion', actionSummary: 'Multi-Sensor Fusion (Score 25% → 91% PRIORITIZE)' },
  { number: 6, label: '06', name: 'Incident Classification', actionSummary: 'Algal Bloom Hazard Classified (HIGH Severity)' },
  { number: 7, label: '07', name: 'Response Recommendation', actionSummary: 'Aeration & Booms Generated (PENDING_REVIEW)' },
  { number: 8, label: '08', name: 'Human Decision Gate', actionSummary: 'Supervisor Authorization & FHIR Task Creation' },
  { number: 9, label: '09', name: 'Operational Task & FHIR', actionSummary: 'Task Dispatched to Inspector Alex Rivera' },
  { number: 10, label: '10', name: 'Field Operations & Geofence', actionSummary: 'Inspector On-Site (≤50m Geofence Validated)' },
  { number: 11, label: '11', name: 'Ground Truth Inspection', actionSummary: 'Sampling: Green-Brown Water & Dense Scum' },
  { number: 12, label: '12', name: 'Field Verification Completed', actionSummary: 'SHA-256 Hash Generated • Task COMPLETED' },
  { number: 13, label: '13', name: 'Supervised Outcome Confirmation', actionSummary: 'Outcome Formally Confirmed by Supervisor' },
  { number: 14, label: '14', name: 'FHIR Outbox & Cryptography', actionSummary: 'HMAC-SHA256 Signed FHIR Resources Queued' },
  { number: 15, label: '15', name: 'External Consumer Verification', actionSummary: 'Delivered & Acknowledged by Public Health Portal' },
  { number: 16, label: 'FINAL', name: 'System Health & Resilience', actionSummary: 'Lifecycle Complete' },
];

interface DemoControlBarProps {
  onNavigate?: (tab: NavTab, entityId?: string) => void;
  onRefreshData?: () => void;
  onResetState?: () => Promise<any> | void;
}

export const DemoControlBar: React.FC<DemoControlBarProps> = ({
  onNavigate,
  onRefreshData,
  onResetState,
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);

  // Sync state on reset event
  useEffect(() => {
    const handleResetEvent = () => {
      setCurrentStage(0);
      setActiveIncidentId(null);
      setError(null);
    };
    window.addEventListener('aquasentinel:reset-state', handleResetEvent);
    return () => window.removeEventListener('aquasentinel:reset-state', handleResetEvent);
  }, []);

  const handleReset = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (onResetState) {
        await onResetState();
      } else {
        await apiClient.resetCanonicalDemo();
        await onRefreshData?.();
      }
      setCurrentStage(0);
      setActiveIncidentId(null);
      onNavigate?.('water-network', '7a3b4c12-89de-4f56-9abc-1234567890ab');
    } catch (err: any) {
      setError(err?.message || 'Reset failed');
    } finally {
      setIsLoading(false);
    }
  }, [onResetState, onRefreshData, onNavigate]);

  const executeNext = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextStage = currentStage + 1;
      const targetReachId = '7a3b4c12-89de-4f56-9abc-1234567890ab';
      let incidentId = activeIncidentId;

      switch (nextStage) {
        case 1: // Stage 01: Baseline -> Water Network -> Almyros Stream Reach Alpha
          await apiClient.resetCanonicalDemo();
          await onRefreshData?.();
          onNavigate?.('water-network', targetReachId);
          break;

        case 2: // Stage 02: Sentinel-2 -> Water Network (Stream Reaches) updated with NDCI 0.28
          await apiClient.advanceCanonicalDemoStep(1);
          await onRefreshData?.();
          onNavigate?.('water-network', targetReachId);
          break;

        case 3: // Stage 03: Initial Assessment -> Evidence Assessments -> Quality & Uncertainty
          await onRefreshData?.();
          onNavigate?.('monitoring-evidence', targetReachId);
          break;

        case 4: // Stage 04: Corroboration -> Ingest in-situ, weather, citizen observations
          await apiClient.advanceCanonicalDemoStep(2);
          await onRefreshData?.();
          onNavigate?.('monitoring-evidence', targetReachId);
          break;

        case 5: // Stage 05: Fusion -> STAY ON Evidence Assessments (Score 25% -> 91%)
          await onRefreshData?.();
          onNavigate?.('monitoring-evidence', targetReachId);
          break;

        case 6: { // Stage 06: Classification -> Incident Queue -> Active Incident
          await onRefreshData?.();
          const status = await apiClient.getCanonicalDemoStatus();
          if (status?.incidentId) {
            incidentId = status.incidentId;
            setActiveIncidentId(status.incidentId);
          }
          onNavigate?.('incidents', incidentId || undefined);
          break;
        }

        case 7: // Stage 07: Response Engine -> Recommendation
          await onRefreshData?.();
          onNavigate?.('recommendations');
          break;

        case 8: // Stage 08: Human Decision -> STAY ON Response Engine -> Review & Approve
          await onRefreshData?.();
          onNavigate?.('recommendations');
          break;

        case 9: { // Stage 09: Operational Task -> Response Operations -> Tasks
          // Ensure recommendation is approved if presenter clicked Next directly
          try {
            await apiClient.approveCanonicalDemoRecommendation();
          } catch (_) {
            // Already approved by user in UI
          }
          await onRefreshData?.();
          const status = await apiClient.getCanonicalDemoStatus();
          onNavigate?.('tasks', status?.taskId || undefined);
          break;
        }

        case 10: { // Stage 10: Field Operations -> Field Operations in IN_PROGRESS
          await apiClient.advanceCanonicalDemoStep(5);
          await onRefreshData?.();
          const status = await apiClient.getCanonicalDemoStatus();
          onNavigate?.('field-ops', status?.taskId || undefined);
          break;
        }

        case 11: { // Stage 11: Ground Truth -> Field Operations / Verification drawer
          await onRefreshData?.();
          const status = await apiClient.getCanonicalDemoStatus();
          onNavigate?.('field-ops', status?.taskId || undefined);
          break;
        }

        case 12: { // Stage 12: Verification Submission -> Update Field Operations page (DO NOT jump to evidence)
          await apiClient.advanceCanonicalDemoStep(6);
          await onRefreshData?.();
          const status = await apiClient.getCanonicalDemoStatus();
          onNavigate?.('field-ops', status?.taskId || undefined);
          break;
        }

        case 13: { // Stage 13: Outcome -> Incidents -> Confirm Outcome
          await apiClient.advanceCanonicalDemoStep(7);
          await onRefreshData?.();
          const status = await apiClient.getCanonicalDemoStatus();
          onNavigate?.('incidents', status?.incidentId || incidentId || undefined);
          break;
        }

        case 14: // Stage 14: FHIR + Outbox -> Interoperability Hub
          await onRefreshData?.();
          onNavigate?.('interoperability');
          break;

        case 15: // Stage 15: External Consumer -> Interoperability Hub
          await apiClient.advanceCanonicalDemoStep(8);
          await onRefreshData?.();
          onNavigate?.('interoperability');
          break;

        case 16: // FINAL -> System Health / Overview
        default:
          await onRefreshData?.();
          onNavigate?.('system-health');
          break;
      }

      setCurrentStage(nextStage <= 16 ? nextStage : 16);
    } catch (err: any) {
      setError(err?.message || 'Failed to advance stage');
    } finally {
      setIsLoading(false);
    }
  }, [currentStage, activeIncidentId, onNavigate, onRefreshData]);

  const stage = DEMO_STAGES.find((s) => s.number === currentStage) || DEMO_STAGES[0];

  return (
    <div className="h-9 px-4 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between shrink-0 select-none shadow-xs z-10">
      {/* Left: Stage number, name & action summary */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px] font-bold border border-blue-500/30 shrink-0">
          {stage.number === 0 ? 'STAGE 00' : stage.number === 16 ? 'FINAL' : `STAGE ${String(stage.number).padStart(2, '0')}/15`}
        </span>
        <span className="text-xs font-bold text-slate-100 truncate">
          {stage.name}
        </span>
        <span className="text-slate-500 text-xs hidden sm:inline">•</span>
        <span className="text-[11px] text-slate-400 truncate hidden md:inline">
          {stage.actionSummary}
        </span>
        {error && (
          <span className="text-[11px] text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800 shrink-0 truncate">
            {error}
          </span>
        )}
      </div>

      {/* Right: RESET and NEXT buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
          title="Reset demo baseline"
        >
          <RotateCcw size={12} className={isLoading ? 'animate-spin text-slate-400' : 'text-slate-400'} />
          <span>RESET</span>
        </button>

        <button
          type="button"
          onClick={executeNext}
          disabled={isLoading || currentStage >= 16}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
          title="Execute stage action and advance to next screen"
        >
          {isLoading ? (
            <>
              <Loader2 size={12} className="animate-spin text-white" />
              <span>RUNNING...</span>
            </>
          ) : currentStage >= 16 ? (
            <>
              <CheckCircle2 size={12} className="text-emerald-300" />
              <span>COMPLETED</span>
            </>
          ) : (
            <>
              <span>NEXT</span>
              <ArrowRight size={13} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
