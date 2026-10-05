import React, { useState, useEffect } from 'react';
import {
  Recommendation,
  ResponsibleRole,
  CatalogueMeasure,
  Incident,
  StreamReach,
} from '@aquasentinel/shared';
import { apiClient } from '../api/client.js';
import { Modal } from '../components/common/Modal.js';
import { formatRelativeTime } from '../utils/date.js';
import {
  CheckCircle2,
  FileCode,
  ShieldAlert,
  AlertTriangle,
  Radio,
  ExternalLink,
  ChevronDown,
  Check,
  Clock,
  Layers,
} from 'lucide-react';

interface RecommendationsPageProps {
  onRefresh: () => void;
  onNavigateToIncident?: (incidentId: string) => void;
  onNavigateToMap?: () => void;
  onNavigateToTask?: (taskId: string) => void;
}

export const RecommendationsPage: React.FC<RecommendationsPageProps> = ({
  onRefresh,
  onNavigateToIncident,
  onNavigateToMap: _onNavigateToMap,
  onNavigateToTask: _onNavigateToTask,
}) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [, setMeasures] = useState<CatalogueMeasure[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reaches, setReaches] = useState<StreamReach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);

  // Review Form State
  const [reviewerName] = useState('Jordan Diaz (Senior Analyst)');
  const [reviewerRole, setReviewerRole] = useState<ResponsibleRole>('WATER_QUALITY_ANALYST');
  const [assignedTeam, setAssignedTeam] = useState('Field Ops Crew Alpha');
  const [priorityLevel, setPriorityLevel] = useState<'URGENT' | 'HIGH' | 'MEDIUM'>('URGENT');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Modals
  const [inspectFhirRec, setInspectFhirRec] = useState<Recommendation | null>(null);
  const [fhirDraftJson, setFhirDraftJson] = useState<string | null>(null);
  const [isLoadingFhir, setIsLoadingFhir] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recs, catMeasures, incList, reachList] = await Promise.all([
        apiClient.getRecommendations().catch(() => []),
        apiClient.getCatalogueMeasures().catch(() => []),
        apiClient.getIncidents().catch(() => []),
        apiClient.getStreamReaches().catch(() => []),
      ]);
      setRecommendations(recs);
      setMeasures(catMeasures);
      setIncidents(incList);
      setReaches(reachList);
      if (recs.length > 0 && !selectedRecId) {
        setSelectedRecId(recs[0].id);
      }
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allRecommendations = recommendations;
  const activeRec = allRecommendations.find((r) => r.id === selectedRecId) || allRecommendations[0] || null;
  const relatedIncident = activeRec ? incidents.find((i) => i.id === activeRec.incidentId) : null;
  const relatedReach = relatedIncident ? reaches.find((r) => r.id === relatedIncident.streamReachId) : null;

  // Execution Handlers
  const handleApprove = async () => {
    if (!activeRec) return;
    setIsSubmittingReview(true);
    setActionFeedback(null);
    try {
      await apiClient.approveRecommendation(activeRec.id, {
        actor: reviewerName,
        notes: dispatchNotes ? `${dispatchNotes} (Assigned to: ${assignedTeam})` : `Assigned to: ${assignedTeam}`,
      });
      setActionFeedback('Recommendation approved! Field task created.');
      await loadData();
      onRefresh();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleRequestMoreEvidence = async () => {
    if (!activeRec) return;
    setIsSubmittingReview(true);
    try {
      await apiClient.requestMoreEvidence(activeRec.id, {
        actor: reviewerName,
        notes: dispatchNotes || 'Requesting secondary drone hyperspectral pass.',
      });
      alert('Request for additional evidence submitted.');
      await loadData();
      onRefresh();
    } catch (err: any) {
      alert(`Request failed: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleReject = async () => {
    if (!activeRec) return;
    if (!rejectReason.trim()) {
      alert('Rejection reason is required for compliance audit trails.');
      return;
    }
    setIsSubmittingReview(true);
    try {
      await apiClient.rejectRecommendation(activeRec.id, {
        actor: reviewerName,
        reason: rejectReason,
      });
      setShowRejectModal(false);
      setRejectReason('');
      await loadData();
      onRefresh();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };



  const handleInspectFhir = async () => {
    if (!activeRec) return;
    setInspectFhirRec(activeRec);
    setIsLoadingFhir(true);
    try {
      const detail = await apiClient.getRecommendation(activeRec.id);
      setFhirDraftJson(
        JSON.stringify(
          detail.fhirTaskDraft || {
            resourceType: 'CarePlan',
            id: activeRec.id,
            status: 'draft',
            intent: 'order',
            title: activeRec.title,
            description: activeRec.description,
            priority: activeRec.priority.toLowerCase(),
            created: activeRec.createdAt,
            author: { display: reviewerName },
            note: [{ text: activeRec.rationale }],
          },
          null,
          2
        )
      );
    } catch {
      setFhirDraftJson(
        JSON.stringify(
          {
            resourceType: 'CarePlan',
            id: activeRec.id,
            status: 'draft',
            intent: 'order',
            title: activeRec.title,
            description: activeRec.description,
            priority: activeRec.priority.toLowerCase(),
            created: activeRec.createdAt,
            author: { display: reviewerName },
            note: [{ text: activeRec.rationale }],
          },
          null,
          2
        )
      );
    } finally {
      setIsLoadingFhir(false);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 gap-2 overflow-hidden text-slate-800">
      {/* 1. TOP HEADER STRIP */}
      <div className="shrink-0 h-11 bg-white border border-slate-200/90 rounded-xl px-3 py-1 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-600 shrink-0">
            <ShieldAlert size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
                Response Policy Engine
              </h1>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                ISO 22320 / HL7 FHIR
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate hidden sm:block">
              Automated policy directives, Bayesian decision arbitration, and municipal intervention triage.
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {actionFeedback && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium rounded-lg">
              <Check size={11} />
              <span>{actionFeedback}</span>
            </div>
          )}

          {relatedIncident && (
            <button
              type="button"
              onClick={() => onNavigateToIncident?.(relatedIncident.id)}
              className="hidden lg:flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition"
            >
              <span>Incident: {relatedIncident.id}</span>
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold text-[9px]">
                {relatedIncident.status}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleInspectFhir}
            className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-2xs transition"
          >
            <FileCode size={12} />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {!activeRec ? (
        <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 p-8 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
            <CheckCircle2 size={20} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Pending Policy Recommendations</h3>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-0.5">
            All automated policy directives have been reviewed, or no current incidents require remediation proposals.
          </p>
        </div>
      ) : (
        /* 2. ZERO-SCROLL 2-COLUMN SPLIT CONSOLE */
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5">
          {/* LEFT COLUMN: 8 COLS (ACTIVE REC HERO + SPLIT EVIDENCE / QUEUE) */}
          <div className="col-span-8 flex flex-col min-h-0 gap-2 overflow-hidden">
            {/* CARD 1: ACTIVE RECOMMENDATION HERO (Compact Banner) */}
            <div className="shrink-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    {activeRec.status === 'PENDING_REVIEW' ? 'Review Required' : activeRec.status}
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 truncate">
                    {activeRec.title}
                  </h2>
                  <span className="text-[10px] font-mono text-slate-400">
                    {activeRec.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-md">
                    Match: {activeRec.suitabilityScore}/100
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {activeRec.description}
              </p>

              {/* Quick Metrics 4-Pill Strip */}
              <div className="grid grid-cols-4 gap-2 pt-0.5">
                <div className="p-2 bg-slate-50/80 rounded-lg border border-slate-100 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Response Window
                  </span>
                  <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                    <Clock size={11} className="text-blue-600" />
                    {activeRec.priority === 'URGENT' ? '< 1 hour' : activeRec.priority === 'HIGH' ? '< 3 hours' : '< 12 hours'}
                  </span>
                </div>

                <div className="p-2 bg-slate-50/80 rounded-lg border border-slate-100 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Priority Directive
                  </span>
                  <span className="text-xs font-bold text-rose-600 mt-0.5 flex items-center gap-1">
                    <AlertTriangle size={11} className="text-rose-500" />
                    {activeRec.priority}
                  </span>
                </div>

                <div className="p-2 bg-slate-50/80 rounded-lg border border-slate-100 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Target Reach
                  </span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                    {relatedReach ? relatedReach.name : (relatedIncident?.streamReachId || 'Reach-004')}
                  </span>
                </div>

                <div className="p-2 bg-slate-50/80 rounded-lg border border-slate-100 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Policy Standard
                  </span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 font-mono truncate">
                    {activeRec.sourceRule || activeRec.measureId || 'EU WFD 2000/60/EC'}
                  </span>
                </div>
              </div>
            </div>

            {/* LOWER SPLIT: LEFT (EVIDENCE & IMPACT) / RIGHT (QUEUE) */}
            <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
              {/* Evidence Signals & Impact Analysis (7 cols) */}
              <div className="col-span-7 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs overflow-hidden">
                <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Radio size={13} className="text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900">
                      Why this recommendation?
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEvidenceModal(true)}
                    className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold transition"
                  >
                    View All Signals
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-2 pr-1">
                  {/* Multi-source Evidence Signals */}
                  {activeRec.rationaleDetails?.whatSupportsIt && activeRec.rationaleDetails.whatSupportsIt.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeRec.rationaleDetails.whatSupportsIt.slice(0, 3).map((reason, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-700 leading-snug">
                          <span className="font-bold text-blue-700 block mb-0.5">Signal #{idx + 1}</span>
                          {reason}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600 leading-relaxed">
                      {activeRec.rationale || 'Bayesian evidence evaluation corroborates multi-source sensor and satellite anomaly.'}
                    </div>
                  )}

                  {/* Impact Analysis Banner */}
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200/70 rounded-lg text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                      <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                      <span>Operational Impact Forecast</span>
                    </div>
                    <p className="text-amber-800 text-[10px] leading-relaxed">
                      {activeRec.rationaleDetails?.whyNow || activeRec.rationaleDetails?.whyThis || activeRec.rationale || 'Immediate containment prevents downstream contaminant migration.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendation Queue (5 cols) */}
              <div className="col-span-5 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs overflow-hidden">
                <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Layers size={13} className="text-slate-600" />
                    <h3 className="text-xs font-bold text-slate-900">
                      Recommendation Queue
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {allRecommendations.length}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 py-2 pr-1">
                  {allRecommendations.map((r) => {
                    const isCurrent = r.id === activeRec.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRecId(r.id)}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition flex items-center justify-between ${
                          isCurrent
                            ? 'border-blue-500 bg-blue-50/30'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {r.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {r.priority} · {r.id.slice(0, 6)}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 shrink-0">
                          {r.suitabilityScore}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: 4 COLS (HUMAN REVIEW CHECKPOINT & APPROVAL) */}
          <div className="col-span-4 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs overflow-hidden justify-between">
            <div className="shrink-0 space-y-2.5">
              <div className="pb-2 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900">
                    Human Review Checkpoint
                  </h3>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    ISO 22320
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Required municipal authorization & team assignment
                </p>
              </div>

              {/* Reviewer Role & Team Assignment */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-600 block">
                    Reviewer Role
                  </label>
                  <div className="relative">
                    <select
                      value={reviewerRole}
                      onChange={(e) => setReviewerRole(e.target.value as any)}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-semibold rounded-lg pl-2 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="WATER_QUALITY_ANALYST">Water Quality Analyst</option>
                      <option value="SENIOR_ENVIRONMENTAL_OFFICER">Senior Env Officer</option>
                      <option value="INCIDENT_COMMANDER">Incident Commander</option>
                      <option value="FIELD_OPERATIONS_LEAD">Field Ops Lead</option>
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-600 block">
                    Assigned Team
                  </label>
                  <div className="relative">
                    <select
                      value={assignedTeam}
                      onChange={(e) => setAssignedTeam(e.target.value)}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-semibold rounded-lg pl-2 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="Field Ops Crew Alpha">Field Ops Crew Alpha</option>
                      <option value="Rapid Response Unit 2">Rapid Response Unit 2</option>
                      <option value="Environmental Protection Team">Env Protection Team</option>
                      <option value="Municipal Utilities Guard">Utilities Guard</option>
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Priority Toggle */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold text-slate-600 block">
                  Priority Directive
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['URGENT', 'HIGH', 'MEDIUM'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriorityLevel(p)}
                      className={`py-1 rounded-md text-[10px] font-bold transition text-center ${
                        priorityLevel === p
                          ? p === 'URGENT'
                            ? 'bg-rose-600 text-white'
                            : p === 'HIGH'
                            ? 'bg-amber-600 text-white'
                            : 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dispatch Instructions */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold text-slate-600 block">
                  Dispatch Instructions & Notes
                </label>
                <textarea
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="Enter dispatch directives, sample preservation requirements, PPE instructions..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-14"
                />
              </div>
            </div>

            {/* Bottom Actions & Traceability */}
            <div className="shrink-0 space-y-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmittingReview || isLoading}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs disabled:opacity-50"
              >
                <Check size={13} />
                <span>Approve and create field task -&gt;</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleRequestMoreEvidence}
                  disabled={isSubmittingReview || isLoading}
                  className="py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold text-center transition"
                >
                  Request changes
                </button>

                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={isSubmittingReview || isLoading}
                  className="py-1.5 px-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-semibold text-center transition"
                >
                  Reject
                </button>
              </div>

              {/* Decision Traceability Box */}
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-1 text-[10px] text-slate-500">
                <div className="flex justify-between">
                  <span>Model Engine:</span>
                  <span className="font-mono text-slate-700 font-semibold truncate max-w-[140px]">
                    {activeRec.provenance?.processingMethod || 'Bayesian Decision Model'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Generated:</span>
                  <span className="font-mono text-slate-700">{formatRelativeTime(activeRec.createdAt)}</span>
                </div>

                <button
                  type="button"
                  onClick={handleInspectFhir}
                  className="w-full pt-1 border-t border-slate-200 text-blue-600 hover:text-blue-700 font-semibold flex items-center justify-center gap-1 text-[10px] transition"
                >
                  <span>Inspect FHIR CarePlan / ISO Record</span>
                  <ExternalLink size={10} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Reject Modal */}
      {showRejectModal && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Reject Recommendation"
        >
          <div className="space-y-3 text-xs text-slate-700">
            <p>
              Rejection will archive this recommendation. Please specify the justification for the immutable municipal audit record.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., False positive confirmed by upstream dam operator flush..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition bg-white text-slate-800 placeholder:text-slate-400"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmittingReview}
                className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition text-xs disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}



      {/* MODAL 3: FHIR CarePlan / ISO Record Modal */}
      {inspectFhirRec && (
        <Modal
          isOpen={!!inspectFhirRec}
          onClose={() => setInspectFhirRec(null)}
          title="HL7 FHIR CarePlan / ISO 14001 Audit Record"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Interoperable JSON representation formatted in compliance with HL7 FHIR Task / CarePlan standards:
            </p>
            {isLoadingFhir ? (
              <div className="p-8 text-center text-slate-400">Loading FHIR representation...</div>
            ) : (
              <pre className="p-3.5 bg-slate-900 text-cyan-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-80 border border-slate-800 shadow-inner">
                {fhirDraftJson}
              </pre>
            )}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setInspectFhirRec(null)}
                className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-xs"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: Full Evidence Signals Modal */}
      {showEvidenceModal && (
        <Modal
          isOpen={showEvidenceModal}
          onClose={() => setShowEvidenceModal(false)}
          title="Comprehensive Causal Signals & Telemetry Evidence"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Corroborated evidence vectors synthesized by the Bayesian Inference Engine:
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {activeRec.rationaleDetails?.whatSupportsIt?.map((reason, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs mb-1">
                    <Radio size={13} />
                    <span>Evidence Stream #{idx + 1}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-xs">{reason}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowEvidenceModal(false)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition text-xs"
              >
                Close Signals
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
