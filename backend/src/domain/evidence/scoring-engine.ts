/**
 * Evidence Scoring Engine for AquaSentinel
 * Calculates bounded 0-100 Evidence Confidence Score, determines operational confidence bands,
 * and generates transparent, explainable machine-readable rationale.
 * Conforms to Main PRD Section 20 and Phase 3 PRD Sections 19, 20, 21, 23, 27, 28, 29, 30, 56.
 */

import {
  Observation,
  ObservationSource,
  StreamReach,
  EvidenceItem,
  EvidenceAssessment,
  EvidenceConfidenceBand,
  ScoreBreakdown,
  AssessmentRationale,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../value-objects.js';
import { createProvenanceRecord } from '../provenance.js';
import { defaultEvidenceConfig, EvidenceFusionConfig } from './config.js';
import { spatialCorrelator } from './spatial-correlator.js';
import { temporalCorrelator } from './temporal-correlator.js';
import { baselineService, BaselineComparisonResult } from './baseline-service.js';
import { qualityCorrelator } from './quality-correlator.js';
import { corroborationAnalyzer, CorroborationAnalysisResult } from './corroboration-analyzer.js';
import { contradictionDetector, ContradictionDetectionResult } from './contradiction-detector.js';
import { missingEvidenceAnalyzer, MissingEvidenceResult } from './missing-evidence-analyzer.js';

export interface ScoringInput {
  streamReach: StreamReach;
  triggerObservation?: Observation;
  candidateObservations: Observation[];
  historicalObservations?: Observation[];
  assessmentId?: string;
  candidateId?: string;
  customConfig?: Partial<EvidenceFusionConfig>;
}

export class ScoringEngine {
  private config: EvidenceFusionConfig;

  constructor(config: EvidenceFusionConfig = defaultEvidenceConfig) {
    this.config = config;
  }

  /**
   * Evaluates candidate environmental observations and produces a complete, explainable Evidence Assessment.
   */
  public evaluate(input: ScoringInput): EvidenceAssessment {
    const assessmentId = input.assessmentId ?? generateId();
    const now = nowUtc();
    const reach = input.streamReach;
    const history = input.historicalObservations ?? [];

    // Identify primary anomaly (or latest high-signal observation)
    const satelliteObservations = input.candidateObservations.filter((o) => o.source === 'SATELLITE_SENTINEL2');
    const highestSignalSatellite = satelliteObservations.sort(
      (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
    )[0];

    const primaryAnomaly =
      (input.triggerObservation?.source === 'SATELLITE_SENTINEL2' ? input.triggerObservation : undefined) ??
      highestSignalSatellite ??
      input.triggerObservation ??
      input.candidateObservations[0];

    const supportingItems: EvidenceItem[] = [];
    const contradictingItems: EvidenceItem[] = [];

    // Step 1: Baseline comparison for primary anomaly
    let baselineResult: BaselineComparisonResult = {
      status: 'UNAVAILABLE',
      isAnomaly: false,
      anomalyStrength: 0,
      reason: 'No baseline data available',
    };

    if (primaryAnomaly) {
      baselineResult = baselineService.evaluate(primaryAnomaly, history, reach);
    }

    // Step 2: Correlate each candidate observation spatially and temporally
    const correlatedForScoring: { observation: Observation; baseScore: number }[] = [];
    const referenceTimestamp = primaryAnomaly?.timestamp ?? now;

    const appliedQualityRules = new Map<string, number>();
    let maxSpatialContribution = 0;
    let maxTemporalContribution = 0;

    for (const obs of input.candidateObservations) {
      const spatial = spatialCorrelator.correlateToReach(obs, reach);
      const temporal = temporalCorrelator.correlate(obs, referenceTimestamp);
      const quality = qualityCorrelator.assess(obs);

      for (const p of quality.penalties) {
        if (!appliedQualityRules.has(p.rule) || appliedQualityRules.get(p.rule)! < p.points) {
          appliedQualityRules.set(p.rule, p.points);
        }
      }

      // Calculate spatial and temporal score contributions (bounded)
      const spatialScore = spatial.relevance === 'HIGH' ? 5 : spatial.relevance === 'MEDIUM' ? 3 : 1;
      const temporalScore = temporal.relevance === 'HIGH' ? 5 : temporal.relevance === 'MEDIUM' ? 3 : 1;

      if (spatial.isMatch && spatialScore > maxSpatialContribution) maxSpatialContribution = spatialScore;
      if (temporal.isMatch && temporalScore > maxTemporalContribution) maxTemporalContribution = temporalScore;

      // Base score per observation depending on source and indicator
      let obsBaseScore = 0;
      let contributionType: 'SUPPORTING' | 'CONTRADICTING' | 'NEUTRAL' = 'NEUTRAL';
      let rule = 'CORRELATED_OBSERVATION';
      let reason = '';

      if (!spatial.isMatch) {
        contributionType = 'CONTRADICTING';
        rule = 'SPATIAL_MISMATCH';
        reason = `Observation location is outside correlation boundary (${spatial.distanceMeters}m from reach).`;
        obsBaseScore = -5;
      } else if (!temporal.isMatch) {
        contributionType = 'CONTRADICTING';
        rule = 'TEMPORAL_MISMATCH';
        reason = `Observation occurred outside relevant time window (${temporal.deltaMinutes} min delta).`;
        obsBaseScore = -5;
      } else {
        if (obs.source === 'SATELLITE_SENTINEL2') {
          // Check if this is a normal reading that contradicts an anomaly
          if (obs.indicator === 'NDCI' && typeof obs.value === 'number' && obs.value < 0.10) {
            contributionType = 'CONTRADICTING';
            rule = 'CONFLICTING_NORMAL_NDCI';
            reason = `Concurrent satellite observation recorded normal chlorophyll levels (NDCI: ${obs.value}), conflicting with the anomaly interpretation.`;
            obsBaseScore = -this.config.penalties.conflictingNormalReading;
          } else {
            contributionType = 'SUPPORTING';
            const anomalyScore = baselineResult.isAnomaly ? 16 : 10;
            obsBaseScore = anomalyScore * quality.effectiveQuality;
            rule = 'SATELLITE_REMOTE_SENSING_ANOMALY';
            reason = `Sentinel-2 MSI recorded elevated spectral index (value: ${obs.value}). ${baselineResult.reason}`;
          }
        } else if (obs.source === 'CITIZEN_REPORT') {
          contributionType = 'SUPPORTING';
          obsBaseScore = 8 * quality.effectiveQuality;
          rule = 'CITIZEN_COMMUNITY_CORROBORATION';
          reason = `Citizen report indicates visible surface anomaly (${obs.indicator}) within stream reach buffer.`;
        } else if (obs.source === 'WEATHER_STATION') {
          contributionType = 'SUPPORTING';
          obsBaseScore = 4 * quality.effectiveQuality;
          rule = 'METEOROLOGICAL_CONTEXT';
          reason = `Meteorological context provides atmospheric condition tracking (${obs.indicator}: ${obs.value}).`;
        } else if (obs.source === 'IN_SITU_SENSOR') {
          if (obs.indicator === 'DISSOLVED_OXYGEN' && typeof obs.value === 'number' && obs.value >= 7.5) {
            contributionType = 'CONTRADICTING';
            rule = 'HEALTHY_DISSOLVED_OXYGEN';
            reason = `In-situ dissolved oxygen measurement (${obs.value} mg/L) is healthy, contradicting bloom hypoxia.`;
            obsBaseScore = -15;
          } else {
            contributionType = 'SUPPORTING';
            obsBaseScore = 20 * quality.effectiveQuality;
            rule = 'IN_SITU_TELEMETRY';
            reason = `Direct in-situ probe measurement validates local reach parameters (${obs.indicator}: ${obs.value}).`;
          }
        } else if (obs.source === 'FIELD_INSPECTION') {
          const status = String(obs.metadata?.status || obs.value);
          if (status === 'NOT_CONFIRMED' || obs.value === 'CLEAR' || obs.value === 'NORMAL') {
            contributionType = 'CONTRADICTING';
            obsBaseScore = -25;
            rule = 'FIELD_GROUND_TRUTH_CONTRADICTION';
            reason = `Field inspection observed clean conditions: ${obs.indicator} (${obs.value}). Contradicts remote sensing alert.`;
          } else if (status === 'UNCERTAIN' || status === 'REQUIRES_FOLLOW_UP') {
            contributionType = 'NEUTRAL';
            obsBaseScore = 0;
            rule = 'FIELD_GROUND_TRUTH_INCONCLUSIVE';
            reason = `Field verification was inconclusive: ${obs.indicator} (${obs.value}). Additional verification required.`;
          } else {
            contributionType = 'SUPPORTING';
            obsBaseScore = 25 * quality.effectiveQuality;
            rule = 'FIELD_GROUND_TRUTH_CORROBORATION';
            reason = `Field inspection confirmed physical ground truth: ${obs.indicator} (${obs.value}).`;
          }
        }
      }

      const itemId = generateId();
      const provenance = createProvenanceRecord({
        entityId: itemId,
        entityType: 'EVIDENCE_ITEM',
        source: obs.source,
        sourceIdentifier: obs.id,
        acquisitionTimestamp: obs.timestamp,
        processingMethod: 'EVIDENCE_FUSION_SCORER_V1',
        qualityStatus: obs.quality,
      });

      const evidenceItem: EvidenceItem = {
        id: itemId,
        assessmentId,
        incidentId: input.candidateId ?? null,
        source: obs.source,
        observationId: obs.id,
        indicator: obs.indicator,
        value: obs.value,
        unit: obs.unit,
        timestamp: obs.timestamp,
        corroborationGroup: corroborationAnalyzer.getCorroborationGroup(obs.source, String(obs.indicator)),
        relevance: spatial.relevance,
        spatialMatch: { isMatch: spatial.isMatch, distanceMeters: spatial.distanceMeters },
        temporalMatch: { isMatch: temporal.isMatch, deltaMinutes: temporal.deltaMinutes },
        qualityScore: Math.round(quality.effectiveQuality * 100) / 100,
        qualityFlags: [...spatial.flags, ...temporal.flags, ...quality.qualityFlags],
        contribution: contributionType,
        scoreDelta: Math.round(obsBaseScore),
        reason,
        rule,
        provenance,
        createdAt: now,
      };

      if (contributionType === 'SUPPORTING') {
        supportingItems.push(evidenceItem);
        correlatedForScoring.push({ observation: obs, baseScore: obsBaseScore });
      } else if (contributionType === 'CONTRADICTING') {
        contradictingItems.push(evidenceItem);
      }
    }

    // Step 3: Corroboration Analysis (source-group caps & multi-source bonuses)
    const corroboration: CorroborationAnalysisResult = corroborationAnalyzer.analyze(correlatedForScoring);

    // Step 4: Contradiction Detection
    const contradiction: ContradictionDetectionResult = contradictionDetector.detect({
      primaryAnomaly,
      observations: input.candidateObservations,
      reach,
      activeGroups: corroboration.independentGroups,
    });

    // Populate contradictingItems with any contradictions surfaced by contradictionDetector
    for (const c of contradiction.contradictions) {
      if (!contradictingItems.some((item) => item.rule === c.rule && (item.observationId === c.observationId || !c.observationId))) {
        const itemId = generateId();
        const provenance = createProvenanceRecord({
          entityId: itemId,
          entityType: 'EVIDENCE_ITEM',
          source: (c.source as ObservationSource) || 'SATELLITE_SENTINEL2',
          sourceIdentifier: c.observationId || 'contradiction-detector',
          acquisitionTimestamp: now,
          processingMethod: 'CONTRADICTION_DETECTOR_V1',
          qualityStatus: 'VALIDATED',
        });
        contradictingItems.push({
          id: itemId,
          assessmentId,
          incidentId: input.candidateId ?? null,
          source: (c.source as ObservationSource) || 'SATELLITE_SENTINEL2',
          observationId: c.observationId || '',
          indicator: 'CONTRADICTION_FLAG',
          value: c.penalty,
          unit: 'penalty_pts',
          timestamp: now,
          corroborationGroup: 'REMOTE_SENSING',
          relevance: 'HIGH',
          spatialMatch: { isMatch: true, distanceMeters: 0 },
          temporalMatch: { isMatch: true, deltaMinutes: 0 },
          qualityScore: 1.0,
          qualityFlags: [c.rule],
          contribution: 'CONTRADICTING',
          scoreDelta: -c.penalty,
          reason: c.reason,
          rule: c.rule,
          provenance,
          createdAt: now,
        });
      }
    }

    // Step 5: Missing Evidence Analysis
    const hasCloudInterference = input.candidateObservations.some(
      (o) =>
        o.source === 'SATELLITE_SENTINEL2' &&
        typeof o.metadata?.cloudCoverFraction === 'number' &&
        (o.metadata.cloudCoverFraction as number) > 0.15
    );

    const missingResult: MissingEvidenceResult = missingEvidenceAnalyzer.analyze({
      activeGroups: corroboration.independentGroups,
      baselineStatus: baselineResult.status,
      hasCloudInterference,
      hasFieldVerification: false,
    });

    // Step 6: Compute Components of Evidence Score
    // A. Anomaly strength (from primary signal)
    const anomalyContribution = primaryAnomaly
      ? Math.round((baselineResult.isAnomaly ? 18 : 10) * (baselineResult.anomalyStrength || 0.5))
      : 0;

    // B. Baseline deviation contribution
    const baselineContribution =
      baselineResult.status === 'AVAILABLE'
        ? Math.round(Math.min(10, Math.max(0, (baselineResult.deviation?.deviation ?? 0) * 30)))
        : 0;

    // C. Corroboration contribution (multi-source bonus + independent groups)
    const corroborationContribution = corroboration.effectiveCorroborationPoints;

    // D. Spatial & Temporal relevance contributions
    const spatialContribution = maxSpatialContribution;
    const temporalContribution = maxTemporalContribution;

    // E. Contextual contribution (weather supporting algal or runoff)
    const contextContribution = corroboration.groupContributions.WEATHER.effectivePoints;

    // F. Quality & Contradiction penalties
    const totalQualityPenalty = Array.from(appliedQualityRules.values()).reduce((sum, pts) => sum + pts, 0);
    const qualityPenalty = Math.min(30, totalQualityPenalty);
    const contradictionPenalty = Math.min(40, contradiction.totalPenalty);

    // Bounded calculation: 0 <= score <= 100
    const rawScore =
      anomalyContribution +
      baselineContribution +
      corroborationContribution +
      spatialContribution +
      temporalContribution -
      qualityPenalty -
      contradictionPenalty;

    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Map to operational confidence band
    const confidenceBand = this.resolveConfidenceBand(score);

    const scoreBreakdown: ScoreBreakdown = {
      anomalyContribution,
      baselineContribution,
      corroborationContribution,
      spatialContribution,
      temporalContribution,
      contextContribution,
      qualityPenalty,
      contradictionPenalty,
    };

    // Step 7: Build Structured Explainability Rationale
    const rationale = this.buildRationale({
      reach,
      score,
      confidenceBand,
      primaryAnomaly,
      baselineResult,
      corroboration,
      contradiction,
      missingResult,
      qualityPenalty,
    });

    return {
      id: assessmentId,
      streamReachId: reach.id,
      candidateId: input.candidateId ?? null,
      score,
      confidenceBand,
      scoringVersion: this.config.scoringVersion,
      baselineStatus: baselineResult.status,
      baselineDeviation: baselineResult.deviation,
      scoreBreakdown,
      independentSourceGroups: corroboration.independentGroups,
      supportingEvidenceIds: supportingItems.map((s) => s.id),
      contradictingEvidenceIds: contradictingItems.map((c) => c.id),
      supportingEvidence: supportingItems,
      contradictingEvidence: contradictingItems,
      missingEvidence: missingResult.missingItems,
      rationale,
      createdAt: now,
      updatedAt: now,
    };
  }

  public resolveConfidenceBand(score: number): EvidenceConfidenceBand {
    const { NORMAL, VERIFY, INVESTIGATE, PRIORITIZE } = this.config.confidenceBands;
    if (score >= PRIORITIZE.min) return 'PRIORITIZE';
    if (score >= INVESTIGATE.min) return 'INVESTIGATE';
    if (score >= VERIFY.min) return 'VERIFY';
    return 'NORMAL';
  }

  private buildRationale(params: {
    reach: StreamReach;
    score: number;
    confidenceBand: EvidenceConfidenceBand;
    primaryAnomaly?: Observation;
    baselineResult: BaselineComparisonResult;
    corroboration: CorroborationAnalysisResult;
    contradiction: ContradictionDetectionResult;
    missingResult: MissingEvidenceResult;
    qualityPenalty: number;
  }): AssessmentRationale {
    const { reach, score, confidenceBand, primaryAnomaly, baselineResult, corroboration, contradiction, missingResult, qualityPenalty } = params;

    let whatChanged = 'No abnormal environmental shift detected.';
    if (primaryAnomaly) {
      whatChanged = `${primaryAnomaly.source} detected indicator '${primaryAnomaly.indicator}' at ${primaryAnomaly.value} ${primaryAnomaly.unit}. ${baselineResult.reason}`;
    }

    const whatCorroborates = corroboration.explanation;

    let whatWeakens = 'No weakening or contradictory evidence detected.';
    if (contradiction.hasContradictions || qualityPenalty > 0) {
      const parts: string[] = [];
      if (qualityPenalty > 0) {
        parts.push(`Quality penalties applied (-${qualityPenalty} pts).`);
      }
      if (contradiction.hasContradictions) {
        parts.push(contradiction.summary);
      }
      whatWeakens = parts.join(' ');
    }

    const whatIsMissing =
      missingResult.missingItems.length > 0
        ? `Missing evidence gaps: ${missingResult.missingItems.join(' ')}`
        : 'No major evidence gaps identified.';

    const guardrailAdvice =
      confidenceBand === 'PRIORITIZE'
        ? 'High-confidence suspected environmental anomaly — field verification required.'
        : confidenceBand === 'INVESTIGATE'
        ? 'Corroborated environmental signal — targeted inspection recommended.'
        : confidenceBand === 'VERIFY'
        ? 'Potential anomaly with limited corroboration — monitor reach and request ground verification.'
        : 'Normal conditions or insufficient evidence — routine surveillance maintained.';

    const summary = `Evidence Confidence Score: ${score}/100 [Band: ${confidenceBand}] for ${reach.name} (${reach.city}). ${guardrailAdvice}`;

    return {
      summary,
      whatChanged,
      whatCorroborates,
      whatWeakens,
      whatIsMissing,
    };
  }
}

export const scoringEngine = new ScoringEngine();
