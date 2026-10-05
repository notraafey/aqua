import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  User,
} from 'lucide-react';
import { Recommendation, Task } from '@aquasentinel/shared';
import { Badge } from '../common/Badge.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { HumanReviewModal } from './HumanReviewModal.js';

interface RecommendationPanelProps {
  recommendations: Recommendation[];
  onActionSuccess?: (task?: Task) => void;
  isLoading?: boolean;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  recommendations,
  onActionSuccess,
  isLoading = false,
}) => {
  const [selectedRecForReview, setSelectedRecForReview] = useState<Recommendation | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(
    recommendations[0]?.id || null
  );

  const toggleExpand = (id: string) => {
    setExpandedId((curr) => (curr === id ? null : id));
  };

  const getStatusVariant = (status: Recommendation['status']) => {
    switch (status) {
      case 'APPROVED':
      case 'EXECUTED':
      case 'VERIFIED':
        return 'emerald';
      case 'REJECTED':
        return 'rose';
      case 'PENDING_REVIEW':
      case 'PROPOSED':
        return 'amber';
      default:
        return 'cyan';
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs">
        <div className="h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Evaluating ranked catalogue interventions...
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card className="text-center py-12">
        <Sparkles size={24} className="text-slate-500 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-200">No Candidate Recommendations</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Environmental evidence has not met anomaly thresholds or active interventions have already been resolved.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            Ranked Candidate Interventions ({recommendations.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked deterministically using OneAquaHealth 7-dimension suitability scoring.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => {
          const isExpanded = expandedId === rec.id;
          const isPending = rec.status === 'PENDING_REVIEW';
          const breakdown = rec.scoreBreakdown;
          const rationale = rec.rationaleDetails;

          return (
            <Card
              key={rec.id}
              className={`transition rounded-2xl border shadow-xs bg-white ${
                rec.rank === 1
                  ? 'border-blue-300 ring-2 ring-blue-500/10'
                  : 'border-slate-200/80'
              }`}
            >
              {/* Header Card Bar */}
              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                      Rank #{rec.rank}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{rec.title}</h4>
                    <Badge variant={getStatusVariant(rec.status) as any} size="sm">
                      {rec.status.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="slate" size="sm">
                      <User size={11} className="mr-1 inline text-slate-500" />
                      {rec.responsibleRole}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{rec.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Suitability Score Metric */}
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-medium">
                      Suitability
                    </span>
                    <div className="font-mono font-extrabold text-blue-600 text-lg">
                      {rec.suitabilityScore}
                      <span className="text-xs text-slate-400 font-normal">/100</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {isPending ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedRecForReview(rec)}
                    >
                      Review Action
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedRecForReview(rec)}
                    >
                      View Review
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleExpand(rec.id)}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                    title={isExpanded ? 'Collapse rationale' : 'Expand 4-question rationale'}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
              </div>

              {/* Expandable 4-Question Rationale & 7-Dimension Breakdown */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/60 text-xs">
                  {/* 4-Question Rationale Grid */}
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono">
                      Explainable 4-Question Operational Rationale
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Q1: Why this measure */}
                      <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl space-y-1 shadow-2xs">
                        <span className="text-blue-700 font-semibold block text-[11px]">
                          1. Why this measure?
                        </span>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {rationale?.whyThis || rec.rationale}
                        </p>
                      </div>

                      {/* Q2: Why now */}
                      <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl space-y-1 shadow-2xs">
                        <span className="text-amber-700 font-semibold block text-[11px]">
                          2. Why now?
                        </span>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {rationale?.whyNow || 'Anomaly detected requiring rapid containment or verification.'}
                        </p>
                      </div>

                      {/* Q3: What supports it */}
                      <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl space-y-1 shadow-2xs">
                        <span className="text-emerald-700 font-semibold block text-[11px]">
                          3. What supports it?
                        </span>
                        <ul className="list-disc list-inside text-slate-600 text-[11px] space-y-0.5">
                          {rationale?.whatSupportsIt && rationale.whatSupportsIt.length > 0 ? (
                            rationale.whatSupportsIt.map((item, idx) => <li key={idx}>{item}</li>)
                          ) : (
                            <li>Validated multi-source evidence indicators match hazard profile.</li>
                          )}
                        </ul>
                      </div>

                      {/* Q4: What is missing / prerequisites */}
                      <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl space-y-1 shadow-2xs">
                        <span className="text-purple-700 font-semibold block text-[11px]">
                          4. Missing prerequisites / verifications?
                        </span>
                        <ul className="list-disc list-inside text-slate-600 text-[11px] space-y-0.5">
                          {rationale?.whatIsMissing && rationale.whatIsMissing.length > 0 ? (
                            rationale.whatIsMissing.map((item, idx) => <li key={idx}>{item}</li>)
                          ) : (
                            <li>Standard supervisory sign-off required prior to field deployment.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* 7-Dimension Suitability Breakdown */}
                  {breakdown && (
                    <div className="pt-2 border-t border-slate-200/80 space-y-2">
                      <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono">
                        7-Dimension Suitability Breakdown
                      </h5>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-slate-500 block text-[10px] font-medium">Evidence Match</span>
                          <span className="text-emerald-600 font-mono font-bold">
                            {breakdown.evidenceCompatibility}/25
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-slate-500 block text-[10px] font-medium">Incident Match</span>
                          <span className="text-emerald-600 font-mono font-bold">
                            {breakdown.incidentCompatibility}/20
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-slate-500 block text-[10px] font-medium">Site Compatibility</span>
                          <span className="text-emerald-600 font-mono font-bold">
                            {breakdown.siteCompatibility}/15
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-slate-500 block text-[10px] font-medium">Temporal Match</span>
                          <span className="text-emerald-600 font-mono font-bold">
                            {breakdown.temporalCompatibility}/15
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-slate-500 block text-[10px] font-medium">Verification Readiness</span>
                          <span className="text-emerald-600 font-mono font-bold">
                            {breakdown.verificationReadiness}/15
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-slate-500 block text-[10px] font-medium">Operational Feasibility</span>
                          <span className="text-emerald-600 font-mono font-bold">
                            {breakdown.operationalFeasibility}/10
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-slate-500 block text-[10px] font-medium">Contraindication Penalty</span>
                          <span className="text-rose-600 font-mono font-bold">
                            -{breakdown.contraindicationPenalty}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-slate-500 block text-[10px] font-medium">Catalogue Code</span>
                          <span className="text-blue-600 font-mono font-bold truncate block">
                            {rec.measureId}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Task reference if generated */}
                  {rec.generatedTaskId && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-emerald-800 font-medium">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span>Operational Task Dispatched: <code className="font-mono text-emerald-950 font-bold">{rec.generatedTaskId}</code></span>
                      </div>
                      <Badge variant="emerald" size="sm">Task Active</Badge>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Human Review Modal */}
      {selectedRecForReview && (
        <HumanReviewModal
          isOpen={Boolean(selectedRecForReview)}
          onClose={() => setSelectedRecForReview(null)}
          recommendation={selectedRecForReview}
          onSuccess={(task) => {
            if (onActionSuccess) onActionSuccess(task);
          }}
        />
      )}
    </div>
  );
};
