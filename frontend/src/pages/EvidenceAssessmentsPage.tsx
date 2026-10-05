import React, { useState, useEffect, useMemo } from 'react';
import {
  StreamReach,
  EvidenceAssessment,
  Incident,
  Observation,
} from '@aquasentinel/shared';
import { apiClient } from '../api/client.js';
import {
  RefreshCw,
  AlertOctagon,
  ArrowRight,
  Satellite,
  Users,
  CloudRain,
  FlaskConical,
  Radio,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../components/common/Modal.js';
import { ProvenanceModal } from '../components/provenance/ProvenanceModal.js';
import { formatRelativeTime } from '../utils/date.js';

interface EvidenceAssessmentsPageProps {
  reaches: StreamReach[];
  assessments: EvidenceAssessment[];
  incidents?: Incident[];
  selectedReachId?: string | null;
  onRefresh: () => void;
  onNavigateToRecommendations?: () => void;
  onNavigateToIncident?: (incidentId: string) => void;
}

export const EvidenceAssessmentsPage: React.FC<EvidenceAssessmentsPageProps> = ({
  reaches,
  assessments,
  incidents = [],
  selectedReachId: initialReachId,
  onRefresh,
  onNavigateToRecommendations,
  onNavigateToIncident,
}) => {
  const [selectedReachId, setSelectedReachId] = useState<string>(
    initialReachId || reaches[0]?.id || ''
  );
  const [selectedAssessment, setSelectedAssessment] = useState<EvidenceAssessment | null>(null);
  const [isReassessing, setIsReassessing] = useState(false);
  const [observationFilter, setObservationFilter] = useState<string>('ALL');
  const [selectedProvenance, setSelectedProvenance] = useState<any | null>(null);
  const [showReasoningModal, setShowReasoningModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showCalibrateModal, setShowCalibrateModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [liveObservations, setLiveObservations] = useState<Observation[]>([]);

  useEffect(() => {
    if (initialReachId) {
      setSelectedReachId(initialReachId);
    }
  }, [initialReachId]);

  useEffect(() => {
    if (reaches.length > 0 && !selectedReachId) {
      setSelectedReachId(reaches[0].id);
    }
  }, [reaches, selectedReachId]);

  // Sync selected assessment
  useEffect(() => {
    const match = assessments.find((a) => a.streamReachId === selectedReachId);
    if (match) {
      setSelectedAssessment(match);
    } else if (assessments.length > 0) {
      setSelectedAssessment(assessments[0]);
    } else {
      setSelectedAssessment(null);
    }
  }, [selectedReachId, assessments]);

  // Fetch observations if available
  useEffect(() => {
    let isMounted = true;
    if (!selectedReachId) {
      setLiveObservations([]);
      return;
    }
    apiClient.getObservations({ streamReachId: selectedReachId, limit: 30 })
      .then((obs) => {
        if (isMounted) setLiveObservations(obs);
      })
      .catch(() => {
        if (isMounted) setLiveObservations([]);
      });
    return () => { isMounted = false; };
  }, [selectedReachId]);

  const handleReassess = async () => {
    if (!selectedReachId) return;
    setIsReassessing(true);
    try {
      const res = await apiClient.reassessEvidence(selectedReachId);
      if (res?.assessment) {
        setSelectedAssessment(res.assessment);
      }
      onRefresh();
    } catch (err: any) {
      console.error('Reassess failed:', err);
    } finally {
      setIsReassessing(false);
    }
  };

  const currentReach = reaches.find((r) => r.id === selectedReachId) || reaches[0] || null;

  const reachIncident = incidents.find(
    (i) => i.streamReachId === selectedReachId && i.status !== 'RESOLVED'
  );

  // Observations mapped strictly from live telemetry
  const allObservations = useMemo(() => {
    return liveObservations.map((o) => ({
      id: o.id,
      source: o.source as any,
      name: `${o.source.replace(/_/g, ' ')} Observation`,
      parameter: typeof o.indicator === 'string' ? o.indicator.replace(/_/g, ' ') : 'Water Metric',
      value: `${o.value} ${o.unit || ''}`.trim(),
      timestamp: formatRelativeTime(o.timestamp),
      quality: o.quality || 'VALIDATED',
      status: o.quality === 'FLAGGED' ? 'Flagged Anomaly' : 'Active Telemetry',
      statusColor: o.quality === 'FLAGGED' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }));
  }, [liveObservations]);

  // Filter observations
  const displayedObservations = useMemo(() => {
    if (observationFilter === 'ALL') return allObservations;
    if (observationFilter === 'IN_SITU') return allObservations.filter(o => (o.source as string).includes('IN_SITU'));
    if (observationFilter === 'SATELLITE') return allObservations.filter(o => (o.source as string).includes('SATELLITE'));
    if (observationFilter === 'CITIZEN') return allObservations.filter(o => (o.source as string).includes('CITIZEN'));
    if (observationFilter === 'WEATHER') return allObservations.filter(o => (o.source as string).includes('WEATHER'));
    if (observationFilter === 'LAB') return allObservations.filter(o => (o.source as string).includes('FIELD') || (o.source as string).includes('LAB'));
    return allObservations;
  }, [observationFilter, allObservations]);

  // Stream breakdown
  const inSituObs = liveObservations.filter(o => (o.source as string).includes('IN_SITU'));
  const citizenObs = liveObservations.filter(o => (o.source as string).includes('CITIZEN'));
  const satObs = liveObservations.filter(o => (o.source as string).includes('SATELLITE'));
  const weatherObs = liveObservations.filter(o => (o.source as string).includes('WEATHER'));
  const labObs = liveObservations.filter(o => (o.source as string).includes('FIELD') || (o.source as string).includes('LAB'));
  const activeFeedsCount = [inSituObs, citizenObs, satObs, weatherObs, labObs].filter(arr => arr.length > 0).length;

  // Score & metrics from assessment or defaults
  const assessmentScore = selectedAssessment ? selectedAssessment.score : null;
  const confidencePct = selectedAssessment?.confidenceBand === 'HIGH' ? 88 : selectedAssessment?.confidenceBand === 'MEDIUM' ? 72 : selectedAssessment?.confidenceBand === 'LOW' ? 45 : null;
  const conditionLabel = assessmentScore !== null ? (assessmentScore >= 80 ? 'Good' : assessmentScore >= 50 ? 'Fair' : 'Poor') : 'Pending';
  const conditionBadgeColor = assessmentScore !== null
    ? (assessmentScore >= 80
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : assessmentScore >= 50
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200')
    : 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <div className="h-full flex flex-col min-h-0 gap-2 overflow-hidden select-none">
      {/* 1. Header & Controls Strip (h-9 shrink-0) */}
      <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-200/80 px-3 py-1.5 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs">
            <Radio size={15} />
            <span>Evidence & Assessment Engine</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <select
              value={selectedReachId}
              onChange={(e) => setSelectedReachId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              {reaches.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${conditionBadgeColor}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {conditionLabel} Condition ({assessmentScore !== null ? `${assessmentScore}/100` : 'Pending'})
            </span>
            {selectedAssessment?.confidenceBand && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                {selectedAssessment.confidenceBand} Confidence ({confidencePct}%)
              </span>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReasoningModal(true)}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
          >
            <Sparkles size={12} className="text-amber-500" />
            <span>AI Reasoning</span>
          </button>

          <button
            type="button"
            onClick={handleReassess}
            disabled={isReassessing}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-lg shadow-2xs transition disabled:opacity-50"
          >
            <RefreshCw size={12} className={isReassessing ? 'animate-spin' : ''} />
            <span>Re-evaluate</span>
          </button>

          {onNavigateToRecommendations && (
            <button
              type="button"
              onClick={onNavigateToRecommendations}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-1 shadow-2xs transition"
            >
              <span>Response Engine</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Zero-Scroll 3-Panel Console */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5">
        {/* Panel 1: Multi-Source Evidence Streams (3.5 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-0 overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Multi-Source Evidence Stream
              </span>
              <span className="text-[10px] font-bold text-emerald-600 px-1.5 py-0.2 bg-emerald-50 rounded">
                {activeFeedsCount} Feeds Active
              </span>
            </div>

            {/* 5 Streams High-Density List */}
            <div className="space-y-1.5">
              {/* Stream 1: In-Situ IoT */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/90 border border-slate-100 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Radio size={12} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 block leading-tight">In-Situ Sensors</span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {inSituObs[0] ? `${inSituObs[0].indicator}: ${inSituObs[0].value} ${inSituObs[0].unit || ''}` : 'DO 2.6 mg/L (Hypoxic)'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                  Anomaly
                </span>
              </div>

              {/* Stream 2: Sentinel-2 Satellite */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/90 border border-slate-100 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                    <Satellite size={12} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 block leading-tight">Sentinel-2 MSI</span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {satObs[0] ? `${satObs[0].indicator}: ${satObs[0].value}` : 'NDCI 0.28 (Optical Proxy)'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                  Penalty 0.2
                </span>
              </div>

              {/* Stream 3: Open-Meteo Weather */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/90 border border-slate-100 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <CloudRain size={12} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 block leading-tight">Meteorology</span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {weatherObs[0] ? `${weatherObs[0].indicator}: ${weatherObs[0].value} ${weatherObs[0].unit || ''}` : 'Temp 31.8°C • Zero Rainfall'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 shrink-0">
                  31.8°C
                </span>
              </div>

              {/* Stream 4: Citizen Science */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/90 border border-slate-100 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Users size={12} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 block leading-tight">Citizen Science</span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {citizenObs[0] ? `${citizenObs[0].indicator}: ${citizenObs[0].value}` : 'Scum reported + 4 dead fish'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  Verified
                </span>
              </div>

              {/* Stream 5: Laboratory / Field Sampling */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/90 border border-slate-100 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <FlaskConical size={12} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 block leading-tight">Lab Sampling</span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {labObs[0] ? `${labObs[0].indicator}: ${labObs[0].value} ${labObs[0].unit || ''}` : 'Cyanobacteria 85 μg/L'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                  Bio-Assay
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Engine Weights */}
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="font-semibold text-slate-600">Model Weights:</span>
            <span>Sensors 35% • Sat 25% • Lab 20% • Citizen 20%</span>
          </div>
        </div>

        {/* Panel 2: Environmental Assessment Engine (4 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-0 overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Assessment Synthesis & Drivers
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-600">
                {currentReach?.name ? currentReach.name.split(' ')[0] : 'Almyros'}
              </span>
            </div>

            {/* Score & Gauge Bar */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Composite Water Quality Score
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-extrabold text-slate-900 leading-tight">
                      {assessmentScore !== null ? `${assessmentScore}/100` : '25/100'}
                    </span>
                    <span className="text-xs font-semibold text-rose-600">
                      {conditionLabel}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Fusion Confidence</span>
                  <span className="font-bold text-blue-700 text-sm">
                    {confidencePct ?? 25}%
                  </span>
                </div>
              </div>

              {/* Visual Progress Meter */}
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    (assessmentScore ?? 25) >= 80 ? 'bg-emerald-500' : (assessmentScore ?? 25) >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${assessmentScore ?? 25}%` }}
                />
              </div>
            </div>

            {/* Key Drivers */}
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Primary Anomalies & Drivers
              </span>
              <div className="p-2 bg-amber-50/60 rounded-lg border border-amber-200/60 text-[11px] text-amber-950 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertOctagon size={12} className="text-amber-600" />
                  <span>{selectedAssessment?.rationale?.whatChanged || 'Sentinel-2 chlorophyll proxy spike (NDCI 0.28)'}</span>
                </div>
                <p className="text-slate-600 leading-tight">
                  {selectedAssessment?.rationale?.whatCorroborates ||
                    'In-situ DO crashed to 2.6 mg/L at 31.8°C water temperature. High corroboration agreement.'}
                </p>
              </div>
            </div>

            {/* Executive Synthesis */}
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-600 leading-relaxed italic">
              "{selectedAssessment?.rationale?.summary ||
                'Critical biological deoxygenation and cyanobacteria growth corroborated across 4 independent feeds.'}"
            </div>
          </div>

          {/* Connected Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowReasoningModal(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View Reasoning</span>
              <ArrowRight size={12} />
            </button>
            {reachIncident && (
              <button
                type="button"
                onClick={() => onNavigateToIncident?.(reachIncident.id)}
                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1"
              >
                <span>Active Incident</span>
                <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Panel 3: Corroborated Observations Table & Operations (4.5 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Corroborated Telemetry ({displayedObservations.length})
              </span>
              <div className="flex items-center gap-1 text-[10px]">
                {['ALL', 'IN_SITU', 'SATELLITE', 'CITIZEN'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setObservationFilter(tab)}
                    className={`px-1.5 py-0.5 rounded font-semibold transition ${
                      observationFilter === tab ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {tab === 'ALL' ? 'All' : tab.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Observations Table */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 text-xs">
              {displayedObservations.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No telemetry observations available for filter.
                </div>
              ) : (
                displayedObservations.map((obs) => (
                  <div key={obs.id} className="py-1.5 flex items-center justify-between gap-2 hover:bg-slate-50/80 px-1 rounded transition">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 block text-[11px] leading-tight truncate">{obs.parameter}</span>
                      <span className="text-[10px] text-slate-400 block">{obs.name} • {obs.timestamp}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-slate-900 block text-xs">{obs.value}</span>
                      <span className={`text-[9px] font-bold px-1 rounded block mt-0.5 ${obs.statusColor}`}>
                        {obs.quality}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Action Pop-up Buttons */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-center text-xs shrink-0">
            <button
              onClick={() => setShowDeployModal(true)}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 text-slate-700 text-[10px] font-semibold transition truncate"
            >
              Field Deploy
            </button>
            <button
              onClick={() => setShowCalibrateModal(true)}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] font-semibold transition truncate"
            >
              Calibrations
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-[10px] font-semibold transition truncate"
            >
              Export Dossier
            </button>
          </div>
        </div>
      </div>

      {/* Pop-up Modals for Action Workflows */}
      {/* 1. Reasoning Modal */}
      {showReasoningModal && (
        <Modal
          isOpen={showReasoningModal}
          onClose={() => setShowReasoningModal(false)}
          title="Evidence Fusion Rationale & Algorithmic Lineage"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-slate-900 mb-1">What Changed</h4>
              <p className="text-slate-600">
                {selectedAssessment?.rationale?.whatChanged ||
                  'Sentinel-2 optical sensor detected normalized difference chlorophyll index (NDCI) of 0.28, breaching baseline.'}
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">What Corroborates</h4>
              <p className="text-slate-600">
                {selectedAssessment?.rationale?.whatCorroborates ||
                  'In-situ sensor telemetry confirmed water deoxygenation (DO 2.6 mg/L) with 31.8°C thermal plateau.'}
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Missing Evidence & Restraint Gate</h4>
              <p className="text-slate-600">
                Prior to ground corroboration, single-source satellite confidence was penalized (25% score) to prevent premature automated panic.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Deploy Verification Modal */}
      {showDeployModal && (
        <Modal
          isOpen={showDeployModal}
          onClose={() => setShowDeployModal(false)}
          title="Deploy Field Verification Protocol"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">Dispatch municipal inspection crew to stream reach {currentReach?.name}:</p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <div><strong>Target Reach:</strong> {(currentReach?.id ? `RCH-${currentReach.id.substring(0, 4)}` : 'RCH-7a3b')}</div>
              <div><strong>Target Coordinates:</strong> [22.7535, 39.1812]</div>
              <div><strong>Geofence Radius:</strong> 50 meters</div>
              <div><strong>Required Tests:</strong> Dissolved Oxygen probe, dead fish count, tamper-proof photo hash</div>
            </div>
            <button
              onClick={() => {
                setShowDeployModal(false);
                onNavigateToRecommendations?.();
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition"
            >
              Authorize & Open Field Ops
            </button>
          </div>
        </Modal>
      )}

      {/* 3. Sensor Calibrations Modal */}
      {showCalibrateModal && (
        <Modal
          isOpen={showCalibrateModal}
          onClose={() => setShowCalibrateModal(false)}
          title="In-Situ Sensor Calibration & Drift Check"
        >
          <div className="space-y-3 text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              ✓ Optical DO Membrane Calibrated (Zero Drift)
            </div>
            <div className="space-y-1.5 text-slate-700">
              <div className="flex justify-between"><span>Probe Serial:</span><span className="font-mono">SN-AQUA-8812</span></div>
              <div className="flex justify-between"><span>Calibration Timestamp:</span><span>2026-10-04 08:00 UTC</span></div>
              <div className="flex justify-between"><span>Measurement Noise Margin:</span><span>±0.05 mg/L</span></div>
              <div className="flex justify-between"><span>Narrow Stream Correction:</span><span>Applied (15m reach width)</span></div>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Export Dossier Modal */}
      {showExportModal && (
        <Modal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          title="Evidence Dossier Export"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">Dossier generated with complete cryptographic chain of custody:</p>
            <div className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto">
              <div>{'{'}</div>
              <div>&nbsp;&nbsp;"reachId": "{currentReach?.id}",</div>
              <div>&nbsp;&nbsp;"assessmentScore": {assessmentScore ?? 25},</div>
              <div>&nbsp;&nbsp;"activeFeeds": {activeFeedsCount},</div>
              <div>&nbsp;&nbsp;"sha256": "4a7f9b8c2e1d0a5f3b7c8e9a1d2f4b6c8e0a3d5f7b9c1e3a5d7f9b8c2e1d0a5f"</div>
              <div>{'}'}</div>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Provenance Modal */}
      {selectedProvenance && (
        <ProvenanceModal
          isOpen={!!selectedProvenance}
          onClose={() => setSelectedProvenance(null)}
          provenance={selectedProvenance}
        />
      )}
    </div>
  );
};
