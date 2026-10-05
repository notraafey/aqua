/**
 * Deterministic Recommendation Engine
 * Conforms to Phase 4 PRD Sections 10, 11, 12, 13, 21, 26, 29.
 * 
 * Generates explainable, ranked recommendation packages with transparent scoring breakdowns
 * and strict hard safety gates.
 */

import {
  EvidenceAssessment,
  IncidentClassification,
  OperationalSeverity,
  StreamReach,
  CatalogueMeasure,
  Recommendation,
  RecommendationSuitabilityBreakdown,
  RecommendationRationale,
  ActionType,
  ResponsibleRole,
  ProvenanceRecord,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../value-objects.js';
import crypto from 'crypto';

export interface EvaluateRecommendationsInput {
  incidentId: string;
  assessment: EvidenceAssessment;
  classification: IncidentClassification;
  severity: OperationalSeverity;
  reach: StreamReach;
  catalogue: CatalogueMeasure[];
}

export class RecommendationEngine {
  /**
   * Evaluates recommendations with positional or object arguments.
   */
  public evaluateRecommendations(
    incidentIdOrInput: string | EvaluateRecommendationsInput,
    assessment?: EvidenceAssessment,
    classification?: IncidentClassification,
    severity?: OperationalSeverity,
    reach?: StreamReach,
    catalogue?: CatalogueMeasure[]
  ): Recommendation[] {
    if (typeof incidentIdOrInput === 'object') {
      return this.evaluate(incidentIdOrInput);
    }
    return this.evaluate({
      incidentId: incidentIdOrInput,
      assessment: assessment!,
      classification: classification!,
      severity: severity!,
      reach: reach!,
      catalogue: catalogue || [],
    });
  }

  /**
   * Generates ranked, gated, and explainable recommendations for an incident.
   */
  public evaluate(input: EvaluateRecommendationsInput): Recommendation[] {
    const { incidentId, assessment, classification, severity, reach, catalogue } = input;
    const recommendations: Recommendation[] = [];

    // Filter candidate measures against Hard Safety Gates
    const eligibleMeasures = catalogue.filter((measure) =>
      this.passesHardGates(measure, assessment, classification)
    );

    for (const measure of eligibleMeasures) {
      const scoreBreakdown = this.calculateSuitabilityScore(
        measure,
        assessment,
        classification,
        severity,
        reach
      );

      const totalSuitability = Math.min(
        100,
        Math.max(
          0,
          scoreBreakdown.evidenceCompatibility +
            scoreBreakdown.incidentCompatibility +
            scoreBreakdown.siteCompatibility +
            scoreBreakdown.temporalCompatibility +
            scoreBreakdown.verificationReadiness +
            scoreBreakdown.operationalFeasibility +
            scoreBreakdown.contraindicationPenalty
        )
      );

      // Only include measures that meet a minimal suitability threshold (>20)
      if (totalSuitability < 20) {
        continue;
      }

      const rationaleDetails = this.generateRationale(
        measure,
        assessment,
        classification,
        severity,
        reach
      );

      const combinedRationale = `${rationaleDetails.whyThis} ${rationaleDetails.whyNow}`;

      // Map catalogue measure type to ActionType
      const actionType = this.mapMeasureToActionType(measure);

      // Determine priority from severity and suitability
      const priority = this.determinePriority(severity.level, totalSuitability);

      // Generate deterministic idempotency signature
      const idempotencyKey = this.computeIdempotencyKey(
        incidentId,
        assessment.id,
        measure.measureId,
        assessment.confidenceBand
      );

      const provenance: ProvenanceRecord = {
        id: generateId(),
        entityId: measure.measureId,
        entityType: 'RECOMMENDATION',
        source: 'RECOMMENDATION_ENGINE',
        sourceIdentifier: measure.provenance.catalogueIdentifier,
        acquisitionTimestamp: nowUtc(),
        ingestionTimestamp: nowUtc(),
        processingTimestamp: nowUtc(),
        processingMethod: 'DETERMINISTIC_SUITABILITY_SCORING_V1',
        qualityStatus: 'VALIDATED',
      };

      recommendations.push({
        id: generateId(),
        incidentId,
        assessmentId: assessment.id,
        measureId: measure.measureId,
        actionType,
        title: measure.title,
        description: measure.description,
        rank: 1, // updated after sorting
        suitabilityScore: totalSuitability,
        scoreBreakdown,
        rationaleDetails,
        rationale: combinedRationale,
        sourceRule: measure.provenance.sourceSection || measure.sourceReference,
        supportingEvidenceIds: assessment.supportingEvidenceIds || [],
        contradictingEvidenceIds: assessment.contradictingEvidenceIds || [],
        missingPrerequisites: measure.prerequisites || [],
        contraindications: measure.contraindications || [],
        requiredVerification: measure.requiredVerification || [],
        responsibleRole: measure.responsibleRole,
        requiresApproval: true,
        humanApprovalRequired: true,
        status: 'PENDING_REVIEW',
        priority,
        idempotencyKey,
        provenance,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      });
    }

    // Sort descending by suitabilityScore
    recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    // Assign 1-indexed ranks
    recommendations.forEach((rec, idx) => {
      rec.rank = idx + 1;
    });

    return recommendations;
  }

  /**
   * Evaluates Hard Safety and Scientific Gates (PRD Section 12 & 29).
   */
  private passesHardGates(
    measure: CatalogueMeasure,
    assessment: EvidenceAssessment,
    classification: IncidentClassification
  ): boolean {
    const band = assessment.confidenceBand;

    // GATE 1: NORMAL Band Gate
    // If NORMAL, no physical intervention, advisory, or high-impact dispatch. Only passive monitoring.
    if (band === 'NORMAL') {
      return measure.measureType === 'MONITORING';
    }

    // GATE 2: VERIFY Band Gate
    // If VERIFY, prioritize verification, sensor telemetry checks, and citizen intake.
    // Interventions like public advisories, basin diversion, or physical NBS are barred until verified.
    if (band === 'VERIFY') {
      if (
        measure.measureType === 'PUBLIC_ADVISORY' ||
        measure.measureType === 'OPERATIONAL_DISPATCH'
      ) {
        return false;
      }
    }

    // GATE 3: Single Satellite Anomaly Gate (PRD Section 12)
    // A single satellite observation without ground or citizen corroboration must not trigger high-consequence actions
    const hasCorroboration =
      (assessment.independentSourceGroups || []).length > 1 ||
      (assessment.supportingEvidence || []).some(
        (e) => e.corroborationGroup === 'CITIZEN' || e.corroborationGroup === 'IN_SITU'
      );

    const isSatelliteOnly =
      (assessment.supportingEvidence || []).every(
        (e) => e.corroborationGroup === 'REMOTE_SENSING' || e.corroborationGroup === 'HISTORICAL_BASELINE'
      );

    if (isSatelliteOnly && !hasCorroboration) {
      if (
        measure.measureType === 'PUBLIC_ADVISORY' ||
        measure.measureId === 'OAH-M-REMED-09' ||
        measure.measureId === 'OAH-M-ESCALATE-10'
      ) {
        return false;
      }
    }

    // GATE 4: Minimum Evidence Band Gate from Catalogue Measure
    const bandHierarchy: Record<string, number> = {
      NORMAL: 1,
      VERIFY: 2,
      INVESTIGATE: 3,
      PRIORITIZE: 4,
    };

    const currentBandRank = bandHierarchy[band] || 1;
    const requiredBandRank = bandHierarchy[measure.minimumEvidenceBand] || 1;

    if (currentBandRank < requiredBandRank) {
      return false;
    }

    // GATE 5: Stormwater Event Safety Gate
    // If classified as possible stormwater runoff, do not prepare toxic bloom advisories
    if (
      classification.type === 'POSSIBLE_STORMWATER_EVENT' &&
      measure.measureType === 'PUBLIC_ADVISORY'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Deterministically calculates suitability score across 7 transparent dimensions.
   */
  private calculateSuitabilityScore(
    measure: CatalogueMeasure,
    assessment: EvidenceAssessment,
    classification: IncidentClassification,
    severity: OperationalSeverity,
    reach: StreamReach
  ): RecommendationSuitabilityBreakdown {
    // 1. Evidence Compatibility (0 - 25 pts)
    let evidenceCompatibility = 15;
    if (assessment.confidenceBand === measure.minimumEvidenceBand) {
      evidenceCompatibility = 22;
    } else if (assessment.score >= 80) {
      evidenceCompatibility = 25;
    } else if (assessment.score >= 60) {
      evidenceCompatibility = 20;
    } else if (assessment.score >= 40) {
      evidenceCompatibility = 15;
    } else {
      evidenceCompatibility = 8;
    }

    // 2. Incident Compatibility (0 - 25 pts)
    let incidentCompatibility = 0;
    if (measure.applicableIncidentTypes.includes(classification.type)) {
      incidentCompatibility = 22;
      // Bonus if measure's primary stressor matches indicators present
      const hasMatchingIndicator = measure.applicableIndicators.some((ind) =>
        (assessment.supportingEvidence || []).some((e) => e.indicator === ind)
      );
      if (hasMatchingIndicator) {
        incidentCompatibility += 3; // cap 25
      }
    } else {
      incidentCompatibility = 5;
    }

    // 3. Site Compatibility (0 - 15 pts)
    let siteCompatibility = 12;
    const reachName = (reach.name + ' ' + reach.region + ' ' + reach.city).toLowerCase();
    const isUrban = reachName.includes('volos') || reachName.includes('city') || reachName.includes('urban');

    if (measure.spatialRequirements?.urbanOnly && !isUrban) {
      siteCompatibility -= 8;
    } else if (measure.spatialRequirements?.ruralOnly && isUrban) {
      siteCompatibility -= 8;
    } else if (isUrban && measure.spatialRequirements?.urbanOnly) {
      siteCompatibility = 15;
    }

    // 4. Temporal Compatibility (0 - 10 pts)
    let temporalCompatibility = 8;
    if (severity.level === 'CRITICAL' || severity.level === 'HIGH') {
      // Urgent measures favored when severity is high
      if ((measure.temporalRequirements?.maxActionDelayHours ?? 24) <= 6) {
        temporalCompatibility = 10;
      }
    } else {
      temporalCompatibility = 7;
    }

    // 5. Verification Readiness (0 - 10 pts)
    let verificationReadiness = 7;
    if (measure.measureType === 'FIELD_INVESTIGATION' || measure.measureType === 'MONITORING') {
      // Investigatory steps are ready immediately
      verificationReadiness = 10;
    } else {
      // Consequential steps require verified ground evidence
      const hasGroundVerification = (assessment.supportingEvidence || []).some(
        (e) => e.corroborationGroup === 'CITIZEN' || e.corroborationGroup === 'IN_SITU'
      );
      verificationReadiness = hasGroundVerification ? 9 : 4;
    }

    // 6. Operational Feasibility (0 - 15 pts)
    let operationalFeasibility = 10;
    if (measure.implementationComplexity === 'LOW') {
      operationalFeasibility = 15;
    } else if (measure.implementationComplexity === 'MEDIUM') {
      operationalFeasibility = 11;
    } else {
      operationalFeasibility = 6;
    }

    // 7. Contraindication Penalty (0 to -30 pts)
    let contraindicationPenalty = 0;
    const hasStormContradiction = (assessment.contradictingEvidence || []).some(
      (e) => e.rule === 'STORM_RUNOFF_EXPLANATION'
    );
    if (hasStormContradiction && measure.measureType === 'PUBLIC_ADVISORY') {
      contraindicationPenalty = -25;
    }

    return {
      evidenceCompatibility,
      incidentCompatibility,
      siteCompatibility,
      temporalCompatibility,
      verificationReadiness,
      operationalFeasibility,
      contraindicationPenalty,
    };
  }

  /**
   * Generates the 4-part transparent rationale (PRD Section 21).
   */
  private generateRationale(
    measure: CatalogueMeasure,
    assessment: EvidenceAssessment,
    classification: IncidentClassification,
    severity: OperationalSeverity,
    reach: StreamReach
  ): RecommendationRationale {
    // 1. WHY THIS?
    const whyThis = `${measure.title} directly targets ${classification.type.replace(/_/g, ' ').toLowerCase()} in stream reach '${reach.name}' (${reach.city || 'urban corridor'}), aligning with OneAquaHealth operational guidelines for ${measure.measureType.replace(/_/g, ' ').toLowerCase()}.`;

    // 2. WHY NOW?
    const whyNow = `Evidence assessment score is ${assessment.score}/100 in the ${assessment.confidenceBand} band with operational severity evaluated as ${severity.level}. Immediate action is recommended within ${measure.temporalRequirements?.maxActionDelayHours ?? 24} hours.`;

    // 3. WHAT SUPPORTS IT?
    const whatSupportsIt: string[] = [];
    (assessment.supportingEvidence || []).forEach((e) => {
      const valStr = typeof e.value === 'number' ? e.value.toFixed(2) : String(e.value);
      whatSupportsIt.push(
        `${e.source.replace(/_/g, ' ')} observed anomalous ${e.indicator} (${valStr} ${e.unit}): ${e.reason || 'significant deviation'}`
      );
    });
    if (assessment.baselineDeviation?.isAnomalous) {
      whatSupportsIt.push(
        `Historical baseline deviation detected (${assessment.baselineDeviation.deviationMagnitude?.toFixed(2) ?? 'high'}x threshold)`
      );
    }
    if (whatSupportsIt.length === 0) {
      whatSupportsIt.push('Multi-spectral satellite signal detected above reach screening threshold.');
    }

    // 4. WHAT WEAKENS IT?
    const whatWeakensIt: string[] = [];
    (assessment.contradictingEvidence || []).forEach((e) => {
      whatWeakensIt.push(`${e.indicator}: ${e.reason || 'mitigating factor identified'}`);
    });

    // 5. WHAT IS MISSING?
    const whatIsMissing: string[] = [];
    if (assessment.missingEvidence && assessment.missingEvidence.length > 0) {
      assessment.missingEvidence.forEach((m) => whatIsMissing.push(m));
    }
    if (measure.prerequisites && measure.prerequisites.length > 0) {
      measure.prerequisites.forEach((p) => {
        if (!whatIsMissing.includes(p)) {
          whatIsMissing.push(`Operational prerequisite: ${p}`);
        }
      });
    }
    if (whatIsMissing.length === 0) {
      whatIsMissing.push('All core multi-sensor inputs currently available.');
    }

    return {
      whyThis,
      whyNow,
      whatSupportsIt,
      whatWeakensIt,
      whatIsMissing,
    };
  }

  /**
   * Maps measure to ActionType.
   */
  private mapMeasureToActionType(measure: CatalogueMeasure): ActionType {
    if (measure.measureId === 'OAH-M-VERIFY-01') return 'FIELD_VERIFY';
    if (measure.measureId === 'OAH-M-SAMPLE-02') return 'COLLECT_WATER_SAMPLE';
    if (measure.measureId === 'OAH-M-SENSOR-03') return 'REVIEW_SENSOR_DATA';
    if (measure.measureId === 'OAH-M-CITIZEN-04') return 'REQUEST_CITIZEN_VALIDATION';
    if (measure.measureId === 'OAH-M-SOURCE-05') return 'INSPECT_UPSTREAM_SOURCE';
    if (measure.measureId === 'OAH-M-MONITOR-06') return 'MONITOR_REACH';
    if (measure.measureId === 'OAH-M-ADVISORY-07') return 'ISSUE_INTERNAL_ADVISORY_DRAFT';
    if (measure.measureId === 'OAH-M-NBS-08') return 'REVIEW_NATURE_BASED_SOLUTION';
    if (measure.measureId === 'OAH-M-REMED-09') return 'PREPARE_REMEDIATION_PLAN';
    if (measure.measureId === 'OAH-M-ESCALATE-10') return 'ESCALATE_TO_AUTHORITY';
    return 'FIELD_VERIFY';
  }

  private determinePriority(severity: string, suitability: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    if (severity === 'CRITICAL' && suitability >= 70) return 'URGENT';
    if (severity === 'HIGH' || suitability >= 75) return 'HIGH';
    if (severity === 'MODERATE' || suitability >= 50) return 'MEDIUM';
    return 'LOW';
  }

  private computeIdempotencyKey(
    incidentId: string,
    assessmentId: string,
    measureId: string,
    confidenceBand: string
  ): string {
    const raw = `${incidentId}:${assessmentId}:${measureId}:${confidenceBand}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }
}

export const recommendationEngine = new RecommendationEngine();
