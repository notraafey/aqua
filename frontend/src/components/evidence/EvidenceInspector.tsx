import React, { useState } from 'react';
import {
  Satellite,
  CloudRain,
  Users,
  Radio,
  History,
  HelpCircle,
  TrendingDown,
  Layers,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { EvidenceAssessment, EvidenceItem } from '@aquasentinel/shared';
import { Badge } from '../common/Badge.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { ProvenanceModal } from '../provenance/ProvenanceModal.js';

interface EvidenceInspectorProps {
  assessment?: EvidenceAssessment | null;
  evidenceItems?: EvidenceItem[];
  streamReachName?: string;
  onOpenRecommendation?: () => void;
}

export const EvidenceInspector: React.FC<EvidenceInspectorProps> = ({
  assessment,
  evidenceItems = [],
  streamReachName,
  onOpenRecommendation,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'SATELLITE' | 'WEATHER' | 'CITIZEN' | 'IN_SITU' | 'BASELINE'>('ALL');
  const [selectedProvenance, setSelectedProvenance] = useState<any | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    breakdown: true,
    contradictions: true,
    missing: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Merge direct evidence items and assessment evidence items
  const allItems: EvidenceItem[] = [...evidenceItems];
  if (assessment) {
    if (assessment.supportingEvidence) {
      for (const item of assessment.supportingEvidence) {
        if (!allItems.some((e) => e.id === item.id || (e.observationId && e.observationId === item.observationId))) {
          allItems.push(item);
        }
      }
    }
    if (assessment.contradictingEvidence) {
      for (const item of assessment.contradictingEvidence) {
        if (!allItems.some((e) => e.id === item.id || (e.observationId && e.observationId === item.observationId))) {
          allItems.push(item);
        }
      }
    }
  }

  const filteredItems = allItems.filter((item) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'SATELLITE') return item.source === 'SATELLITE_SENTINEL2';
    if (activeTab === 'WEATHER') return item.source === 'WEATHER_STATION';
    if (activeTab === 'CITIZEN') return item.source === 'CITIZEN_REPORT';
    if (activeTab === 'IN_SITU') return item.source === 'IN_SITU_SENSOR';
    if (activeTab === 'BASELINE') return item.source === 'HISTORICAL_BASELINE';
    return true;
  });

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'SATELLITE_SENTINEL2':
        return <Satellite size={14} className="text-cyan-600" />;
      case 'WEATHER_STATION':
        return <CloudRain size={14} className="text-blue-600" />;
      case 'CITIZEN_REPORT':
        return <Users size={14} className="text-emerald-600" />;
      case 'IN_SITU_SENSOR':
        return <Radio size={14} className="text-purple-600" />;
      case 'HISTORICAL_BASELINE':
        return <History size={14} className="text-amber-600" />;
      default:
        return <Layers size={14} className="text-slate-500" />;
    }
  };

  const score = assessment?.score ?? 0;
  const band = assessment?.confidenceBand ?? 'NORMAL';
  const breakdown = assessment?.scoreBreakdown;

  const bandVariant =
    band === 'PRIORITIZE'
      ? 'rose'
      : band === 'INVESTIGATE'
      ? 'amber'
      : band === 'VERIFY'
      ? 'cyan'
      : 'slate';

  return (
    <div className="space-y-6">
      {/* Top Banner: Score & Confidence Band */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Evidence Fusion Assessment
            </span>
            <Badge variant={bandVariant as any} size="sm">
              {band}
            </Badge>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {streamReachName || 'Monitored Reach Anomaly Assessment'}
          </h3>
          <p className="text-xs text-slate-500 max-w-xl">
            {assessment?.rationale?.summary ||
              'Multi-source corroboration fusing Sentinel-2 L2A observations, local weather telemetry, and citizen science reports.'}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-50/80 border border-slate-200/90 px-5 py-3.5 rounded-xl">
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Evidence Confidence</span>
            <p className="text-xs text-slate-400 font-mono">0 – 100 bounded scale</p>
          </div>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-3xl font-extrabold text-blue-600">{score}</span>
            <span className="text-sm text-slate-400 font-bold">/100</span>
          </div>
        </div>
      </div>

      {/* Score Breakdown Section */}
      {breakdown && (
        <Card className="overflow-hidden bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <div
            onClick={() => toggleSection('breakdown')}
            className="flex items-center justify-between cursor-pointer p-4 border-b border-slate-100 bg-slate-50/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.breakdown ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Evidence Fusion Score Contribution Breakdown
              </h4>
            </div>
            <span className="text-xs font-mono text-blue-600 font-semibold">
              Final: {score} pts
            </span>
          </div>

          {expandedSections.breakdown && (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-medium">Satellite Anomaly</span>
                <span className="text-sm font-mono font-bold text-emerald-600">
                  +{breakdown.anomalyContribution} pts
                </span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-medium">Corroboration Match</span>
                <span className="text-sm font-mono font-bold text-emerald-600">
                  +{breakdown.corroborationContribution} pts
                </span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-medium">Baseline Deviation</span>
                <span className="text-sm font-mono font-bold text-emerald-600">
                  +{breakdown.baselineContribution} pts
                </span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-medium">Spatial Match</span>
                <span className="text-sm font-mono font-bold text-emerald-600">
                  +{breakdown.spatialContribution} pts
                </span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-medium">Temporal Match</span>
                <span className="text-sm font-mono font-bold text-emerald-600">
                  +{breakdown.temporalContribution} pts
                </span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-medium">Context Consistency</span>
                <span className="text-sm font-mono font-bold text-emerald-600">
                  +{breakdown.contextContribution} pts
                </span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-medium">Quality Penalty</span>
                <span className="text-sm font-mono font-bold text-rose-600">
                  -{breakdown.qualityPenalty} pts
                </span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-medium">Contradiction Penalty</span>
                <span className="text-sm font-mono font-bold text-rose-600">
                  -{breakdown.contradictionPenalty} pts
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Contradictory & Missing Evidence Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contradictory Signal Display */}
        <Card className="border-amber-200 bg-amber-50/40 rounded-2xl shadow-xs">
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-700">
              <TrendingDown size={16} />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Contradicting Signal Analysis
              </h4>
            </div>

            {assessment?.contradictingEvidence && assessment.contradictingEvidence.length > 0 ? (
              <div className="space-y-2 pt-1">
                {assessment.contradictingEvidence.map((c, idx) => (
                  <div key={idx} className="bg-white border border-amber-200/80 rounded-xl p-3 text-xs space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{c.source.replace(/_/g, ' ')}</span>
                      <span className="text-rose-600 font-mono text-[11px] font-bold">Contradicting</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {assessment.rationale?.whatWeakens ||
                        'Recent meteorological or optical conditions explain part of the observed anomaly, mitigating uncorroborated alert elevation.'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2">
                No contradicting environmental signals detected in this analysis window.
              </div>
            )}
          </div>
        </Card>

        {/* Missing Evidence Display */}
        <Card className="border-blue-200 bg-blue-50/40 rounded-2xl shadow-xs">
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700">
                <HelpCircle size={16} />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Missing Evidence & Verification Gaps
                </h4>
              </div>
              {onOpenRecommendation && (
                <Button variant="outline" size="sm" onClick={onOpenRecommendation}>
                  View Action →
                </Button>
              )}
            </div>

            {assessment?.missingEvidence && assessment.missingEvidence.length > 0 ? (
              <div className="space-y-2 pt-1">
                {assessment.missingEvidence.map((m, idx) => (
                  <div key={idx} className="bg-white border border-blue-200/80 rounded-xl p-3 text-xs space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{m.replace(/_/g, ' ')}</span>
                      <Badge variant="amber" size="sm">Required</Badge>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {assessment.rationale?.whatIsMissing ||
                        'Remote optical or citizen signal requires in-situ probe verification or field sampling before hazardous escalation.'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2">
                All expected indicator sources corroborated for this reach.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Multi-Source Evidence Item Inspector */}
      <Card className="overflow-hidden bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Corroborated Multi-Source Evidence Items
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Inspecting {filteredItems.length} evidence items tagged with spatial and temporal matching metrics.
            </p>
          </div>

          {/* Source Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
            {(['ALL', 'SATELLITE', 'WEATHER', 'CITIZEN', 'IN_SITU', 'BASELINE'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  activeTab === tab
                    ? 'bg-white text-blue-600 border border-slate-200 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Evidence List */}
        <div className="divide-y divide-slate-100">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No evidence items matching active source category.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-slate-50/60 transition space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-100/80 border border-slate-200/80">
                      {getSourceIcon(item.source)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {item.source.replace(/_/g, ' ')}
                        </span>
                        <Badge
                          variant={
                            item.contribution === 'SUPPORTING'
                              ? 'emerald'
                              : item.contribution === 'CONTRADICTING'
                              ? 'rose'
                              : 'slate'
                          }
                          size="sm"
                        >
                          {item.contribution}
                        </Badge>
                        <Badge variant="cyan" size="sm">
                          {item.relevance} Relevance
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        Obs ID: {item.observationId} • Recorded: {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.provenance && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedProvenance(item.provenance)}
                      >
                        <ExternalLink size={12} className="mr-1 inline text-slate-500" />
                        Provenance
                      </Button>
                    )}
                  </div>
                </div>

                {/* Spatial / Temporal matching details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono pt-1">
                  <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Spatial Distance</span>
                    <span className="text-slate-800 font-semibold">{item.spatialMatch?.distanceMeters ?? 0}m to reach</span>
                  </div>
                  <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Temporal Delta</span>
                    <span className="text-slate-800 font-semibold">{item.temporalMatch?.deltaMinutes ?? 0} min delta</span>
                  </div>
                  <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Quality Score</span>
                    <span className="text-emerald-600 font-semibold">
                      {Math.round((item.qualityScore || 1) * 100)}%
                    </span>
                  </div>
                  <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Spatial Match</span>
                    <span className="text-blue-600 font-semibold">
                      {item.spatialMatch?.isMatch ? 'CORRELATED' : 'UNMATCHED'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Provenance Inspection Modal */}
      {selectedProvenance && (
        <ProvenanceModal
          isOpen={Boolean(selectedProvenance)}
          onClose={() => setSelectedProvenance(null)}
          provenance={selectedProvenance}
        />
      )}
    </div>
  );
};
