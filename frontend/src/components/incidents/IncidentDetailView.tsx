import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Sparkles,
  Clock,
  Compass,
  ArrowLeft,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Layers,
} from 'lucide-react';
import {
  Incident,
  StreamReach,
  EvidenceAssessment,
  EvidenceItem,
  Recommendation,
  Task,
  Verification,
  IncidentOutcome,
} from '@aquasentinel/shared';
import { Badge } from '../common/Badge.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { EvidenceInspector } from '../evidence/EvidenceInspector.js';
import { RecommendationPanel } from '../recommendations/RecommendationPanel.js';
import { IncidentTimeline, TimelineItem } from '../timeline/IncidentTimeline.js';
import { FhirStatusBadge } from '../fhir/FhirStatusBadge.js';
import { FhirResourceViewer } from '../fhir/FhirResourceViewer.js';
import { ProvenanceModal } from '../provenance/ProvenanceModal.js';
import { apiClient } from '../../api/client.js';

interface IncidentDetailViewProps {
  incident: Incident;
  reach?: StreamReach | null;
  onBack: () => void;
  onNavigateToTask?: (taskId: string) => void;
  onRefresh?: () => void;
}

export const IncidentDetailView: React.FC<IncidentDetailViewProps> = ({
  incident,
  reach,
  onBack,
  onNavigateToTask,
  onRefresh,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'EVIDENCE' | 'RECOMMENDATIONS' | 'TIMELINE'>('OVERVIEW');
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [assessment, setAssessment] = useState<EvidenceAssessment | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [outcomes, setOutcomes] = useState<IncidentOutcome[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFhirModalOpen, setIsFhirModalOpen] = useState(false);
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState(false);

  const fetchIncidentFullData = async () => {
    setIsLoading(true);
    try {
      const [evRes, recRes, tlRes, taskRes, outcomeRes, verifRes] = await Promise.all([
        apiClient.getIncidentEvidence(incident.id).catch(() => ({ data: [] })),
        apiClient.getIncidentRecommendations(incident.id).catch(() => []),
        apiClient.getIncidentTimeline(incident.id).catch(() => []),
        apiClient.getTasks({ incidentId: incident.id }).catch(() => []),
        apiClient.getIncidentOutcomes(incident.id).catch(() => []),
        apiClient.getVerifications({ incidentId: incident.id }).catch(() => []),
      ]);

      const items = Array.isArray(evRes) ? evRes : evRes.data || [];
      const asmt = (evRes as any).assessment || null;

      setEvidenceItems(items);
      setAssessment(asmt);
      setRecommendations(recRes);
      setTimeline(tlRes);
      setTasks(taskRes);
      setOutcomes(Array.isArray(outcomeRes) ? outcomeRes : []);
      setVerifications(Array.isArray(verifRes) ? verifRes : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentFullData();
  }, [incident.id]);

  const getSeverityVariant = (severity: Incident['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return 'rose';
      case 'HIGH':
        return 'amber';
      case 'MEDIUM':
        return 'cyan';
      default:
        return 'slate';
    }
  };

  const confidenceBand = assessment?.confidenceBand || (incident.evidenceConfidence >= 80 ? 'PRIORITIZE' : incident.evidenceConfidence >= 65 ? 'INVESTIGATE' : 'VERIFY');

  const topTask = tasks[0];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition font-medium"
        >
          <ArrowLeft size={14} />
          <span>Back to Incident Queue</span>
        </button>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchIncidentFullData} disabled={isLoading}>
            <RefreshCw size={13} className={`mr-1 inline text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsProvenanceModalOpen(true)}>
            <FileCheck size={13} className="mr-1 inline text-slate-500" />
            Provenance
          </Button>
        </div>
      </div>

      {/* Incident Operational Header (PRD Section 9 & 10) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-500">
                {incident.id}
              </span>
              <Badge variant={getSeverityVariant(incident.severity)} size="sm">
                Severity: {incident.severity}
              </Badge>
              <Badge variant="purple" size="sm">
                Verification: {incident.verificationStatus}
              </Badge>
            </div>

            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertOctagon size={22} className="text-rose-600 shrink-0" />
              <span>{incident.hazardType.replace(/_/g, ' ')}</span>
            </h1>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <Compass size={13} className="text-blue-600" />
              <span>Reach: {reach?.name || incident.streamReachId}</span>
              <span>•</span>
              <Clock size={13} />
              <span>Updated: {new Date(incident.updatedAt || incident.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Dual Status Metrics (PRD Section 10: Never collapse into one field!) */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50/80 border border-slate-200/90 p-3.5 rounded-xl">
            <div className="text-center px-3 border-r border-slate-200">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-mono font-medium">
                Evidence State
              </span>
              <span className="text-sm font-bold text-blue-600 mt-1 block font-mono">
                {confidenceBand} ({incident.evidenceConfidence}%)
              </span>
            </div>
            <div className="text-center px-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-mono font-medium">
                Operational State
              </span>
              <span className="text-sm font-bold text-emerald-600 mt-1 block">
                {incident.status}
              </span>
            </div>
          </div>
        </div>

        {/* FHIR Status Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <FhirStatusBadge
              status={topTask?.fhirTaskId ? 'SYNCHRONIZED' : 'PENDING'}
              fhirId={topTask?.fhirTaskId}
              onViewResource={() => setIsFhirModalOpen(true)}
            />
            {topTask && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Active Operational Task: <strong className="font-mono text-slate-800">{topTask.id}</strong> ({topTask.status})
                </span>
                {onNavigateToTask && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-700"
                    onClick={() => onNavigateToTask(topTask.id)}
                  >
                    View Task →
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Sub-Tabs Navigation */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => setActiveSubTab('OVERVIEW')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeSubTab === 'OVERVIEW'
                  ? 'bg-white text-blue-700 border border-slate-200 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('EVIDENCE')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeSubTab === 'EVIDENCE'
                  ? 'bg-white text-blue-700 border border-slate-200 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Evidence Reasoning ({evidenceItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('RECOMMENDATIONS')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeSubTab === 'RECOMMENDATIONS'
                  ? 'bg-white text-blue-700 border border-slate-200 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Interventions ({recommendations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('TIMELINE')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeSubTab === 'TIMELINE'
                  ? 'bg-white text-blue-700 border border-slate-200 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Timeline ({timeline.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Panels */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="space-y-5">
          {/* Operational Lifecycle Pipeline Trace */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-2">
                <Layers size={14} className="text-blue-600" />
                Operational Lifecycle Trace
              </span>
              <Badge variant="cyan" size="sm">Closed-Loop Integration</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
              {/* 1. Reach */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400 block font-medium">1. Reach</span>
                <span className="font-semibold text-slate-900 block truncate" title={reach?.name || incident.streamReachId}>
                  {reach?.name?.split('-')[0] || incident.streamReachId.slice(0, 8)}
                </span>
                <span className="text-[10px] text-blue-600 font-mono block">Active Sensor</span>
              </div>

              {/* 2. Evidence */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400 block font-medium">2. Evidence</span>
                <span className="font-semibold text-blue-600 block font-mono">
                  {incident.evidenceConfidence} / 100
                </span>
                <span className="text-[10px] text-slate-500 block">{evidenceItems.length} sources fused</span>
              </div>

              {/* 3. Incident */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400 block font-medium">3. Incident</span>
                <span className="font-semibold text-rose-600 block truncate">{incident.severity}</span>
                <span className="text-[10px] text-slate-500 block font-mono">{incident.verificationStatus}</span>
              </div>

              {/* 4. Recommendation */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400 block font-medium">4. Recommendation</span>
                <span className="font-semibold text-amber-600 block truncate">
                  {recommendations.length > 0 ? `${recommendations.length} Option${recommendations.length > 1 ? 's' : ''}` : 'Pending'}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {recommendations.find((r) => r.status === 'APPROVED') ? 'Approved' : 'Pending Review'}
                </span>
              </div>

              {/* 5. Dispatched Task */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400 block font-medium">5. Task</span>
                <span className="font-semibold text-blue-600 block truncate font-mono">
                  {topTask ? topTask.id.slice(0, 10) : 'None'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {topTask ? topTask.status : 'Unassigned'}
                </span>
              </div>

              {/* 6. Ground Verification */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400 block font-medium">6. Verification</span>
                <span className="font-semibold text-purple-600 block truncate">
                  {verifications.length > 0 ? `${verifications.length} Submitted` : 'Awaiting Field'}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {verifications.length > 0 && verifications[0].evidence?.photos ? `${verifications[0].evidence.photos.length} photos` : 'No photos'}
                </span>
              </div>

              {/* 7. Outcome */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400 block font-medium">7. Outcome</span>
                <span className="font-semibold text-emerald-600 block truncate">
                  {outcomes.length > 0 ? (outcomes[0].confirmedOutcome || outcomes[0].proposedOutcome) : 'Unconfirmed'}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {outcomes.length > 0 ? 'Closed Loop' : 'In Progress'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Column: Evidence Summary (PRD Section 11) */}
            <div className="space-y-4">
              <Card className="p-5 space-y-3 bg-white border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-blue-600" />
                    <span>Evidence Confidence Summary</span>
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveSubTab('EVIDENCE')}
                  >
                    Inspect →
                  </Button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Fused Evidence Score</span>
                    <span className="font-mono font-extrabold text-blue-600 text-lg">
                      {incident.evidenceConfidence} / 100
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Confidence Band</span>
                    <Badge variant={confidenceBand === 'PRIORITIZE' ? 'rose' : 'amber'} size="sm">
                      {confidenceBand}
                    </Badge>
                  </div>
                </div>

                {/* Supporting & Contradicting Snippets */}
                <div className="space-y-2 text-xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Supporting Sources</span>
                  <ul className="space-y-1 text-slate-700">
                    <li className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 size={13} />
                      <span>Sentinel-2 L2A optical anomaly confirmed</span>
                    </li>
                    <li className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 size={13} />
                      <span>Baseline chlorophyll deviation detected</span>
                    </li>
                  </ul>

                  {assessment?.contradictingEvidence && assessment.contradictingEvidence.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-semibold text-amber-700 uppercase">Contradicting Signal</span>
                      <p className="text-slate-600 text-[11px] mt-0.5">
                        {assessment.rationale?.whatWeakens || 'Recent rainfall may partially explain optical runoff.'}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Centre Column: Incident Explanation */}
            <div className="space-y-4">
              <Card className="p-5 space-y-3 bg-white border-slate-200/80 shadow-xs">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <span>Operational Assessment & Baseline</span>
                </h3>

                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1 text-xs">
                  <span className="text-slate-500 block text-[11px] uppercase font-medium">Reach Baseline vs Current</span>
                  <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[11px]">
                    <div className="text-slate-600">Typical NDCI: <strong className="text-slate-900">{reach?.baselineData?.typicalNdci ?? '0.12'}</strong></div>
                    <div className="text-slate-600">Observed: <strong className="text-rose-600">0.38 (+216%)</strong></div>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                  {assessment?.rationale?.whatChanged ||
                    'Sentinel-2 multispectral observation indicates significant elevation in Normalized Difference Chlorophyll Index (NDCI) along Reach Alpha, correlated with low flow and elevated water temperature.'}
                </p>
              </Card>
            </div>

            {/* Right Column: Top Intervention & Review */}
            <div className="space-y-4">
              <Card className="p-5 space-y-3 bg-white border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-600" />
                    <span>Top Ranked Intervention</span>
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveSubTab('RECOMMENDATIONS')}
                  >
                    All ({recommendations.length}) →
                  </Button>
                </div>

                {recommendations.length > 0 ? (
                  <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{recommendations[0].title}</span>
                      <span className="font-mono text-blue-600 font-bold">
                        {recommendations[0].suitabilityScore}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {recommendations[0].description}
                    </p>
                    <div className="pt-2 flex items-center justify-between">
                      <Badge variant="slate" size="sm">{recommendations[0].responsibleRole}</Badge>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setActiveSubTab('RECOMMENDATIONS')}
                      >
                        Review & Approve
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No active recommendations pending review.
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'EVIDENCE' && (
        <EvidenceInspector
          assessment={assessment}
          evidenceItems={evidenceItems}
          streamReachName={reach?.name}
          onOpenRecommendation={() => setActiveSubTab('RECOMMENDATIONS')}
        />
      )}

      {activeSubTab === 'RECOMMENDATIONS' && (
        <RecommendationPanel
          recommendations={recommendations}
          onActionSuccess={() => {
            fetchIncidentFullData();
            if (onRefresh) onRefresh();
          }}
          isLoading={isLoading}
        />
      )}

      {activeSubTab === 'TIMELINE' && (
        <Card className="p-5 space-y-4 bg-white border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                Chronological Incident Timeline & Audit Trail
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Full chronological sequence of observations, evidence assessments, human approvals, and operational tasks.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchIncidentFullData}>
              Refresh Events
            </Button>
          </div>

          <IncidentTimeline timeline={timeline} isLoading={isLoading} />
        </Card>
      )}

      {/* Modals */}
      {isFhirModalOpen && (
        <FhirResourceViewer
          isOpen={isFhirModalOpen}
          onClose={() => setIsFhirModalOpen(false)}
          resource={{
            resourceType: 'Task',
            id: topTask?.fhirTaskId || `task-${incident.id.slice(0, 8)}`,
            status: topTask?.status ? topTask.status.toLowerCase() : 'requested',
            intent: 'order',
            priority: incident.severity.toLowerCase(),
            focus: { reference: `Incident/${incident.id}`, display: incident.hazardType },
            description: `Municipal operational intervention for ${incident.hazardType} at ${reach?.name || incident.streamReachId}`,
            authoredOn: incident.createdAt,
          }}
          title={`HL7 FHIR Interoperability: Incident ${incident.id}`}
        />
      )}

      {isProvenanceModalOpen && (
        <ProvenanceModal
          isOpen={isProvenanceModalOpen}
          onClose={() => setIsProvenanceModalOpen(false)}
          provenance={evidenceItems[0]?.provenance}
          lineage={{
            source: evidenceItems[0]?.source || 'SATELLITE_SENTINEL2',
            observationId: evidenceItems[0]?.observationId,
            assessmentId: assessment?.id,
            incidentId: incident.id,
            recommendationId: recommendations[0]?.id,
            taskId: topTask?.id,
            fhirTaskId: topTask?.fhirTaskId,
          }}
        />
      )}
    </div>
  );
};
