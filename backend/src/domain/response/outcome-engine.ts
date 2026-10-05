/**
 * AquaSentinel Phase 8 - Operational Outcome Engine
 * PRD Sections 29, 30, 31, 32, 33, 34, 37
 */

import {
  Incident,
  Verification,
  EvidenceAssessment,
  IncidentOutcome,
  OperationalOutcomeType,
  EvidenceItem,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../value-objects.js';

export interface OutcomeEvaluationInput {
  incident: Incident;
  verification?: Verification | null;
  assessment: EvidenceAssessment;
}

export class OutcomeEngine {
  public static readonly RULE_VERSION = 'OUTCOME_RULE_V1';

  /**
   * Evaluates post-verification evidence assessment and field verification records
   * to propose a structured, explainable operational outcome.
   */
  public static evaluate(input: OutcomeEvaluationInput): IncidentOutcome {
    const { incident, verification, assessment } = input;
    const now = nowUtc();

    let proposedOutcome: OperationalOutcomeType = 'UNCERTAIN';
    let reason = '';
    const supportingEvidence: EvidenceItem[] = assessment.supportingEvidence || [];

    const fieldStatus = verification?.status;
    const confidenceScore = assessment.score;

    // Check for explicit contradiction from field ground truth
    const hasFieldContradiction =
      fieldStatus === 'NOT_CONFIRMED' ||
      assessment.contradictingEvidence?.some(
        (e) => e.rule === 'FIELD_GROUND_TRUTH_CONTRADICTION'
      );

    // Check for severe ecological hazard requiring escalation
    const hasSevereEscalationSignal =
      verification?.observations?.deadFish &&
      (typeof verification.observations.deadFish === 'number'
        ? verification.observations.deadFish > 5
        : true);

    if (hasSevereEscalationSignal && confidenceScore >= 60) {
      proposedOutcome = 'ESCALATE';
      reason = `Field inspection observed significant acute ecological damage (e.g. fish mortality / toxic plume). Escalation to CRITICAL severity required.`;
    } else if (fieldStatus === 'CONFIRMED' || (fieldStatus === 'PARTIALLY_CONFIRMED' && confidenceScore >= 70)) {
      proposedOutcome = 'CONFIRMED';
      reason = `Field verification confirmed physical ground presence of environmental anomaly (${
        verification?.observations?.waterColour || 'visible algae/foam'
      }). Combined evidence confidence evaluated at ${confidenceScore}%.`;
    } else if (fieldStatus === 'NOT_CONFIRMED' || hasFieldContradiction) {
      proposedOutcome = 'NOT_CONFIRMED';
      reason = `Field inspection did not corroborate remote optical anomaly (observed clean surface/water). Incident classified as false positive / uncorroborated anomaly. Original sensor data preserved for historical baselining.`;
    } else if (fieldStatus === 'UNCERTAIN' || fieldStatus === 'REQUIRES_FOLLOW_UP' || assessment.confidenceBand === 'LOW') {
      proposedOutcome = 'ADDITIONAL_VERIFICATION_REQUIRED';
      reason = `Field evidence is ambiguous or inconclusive (confidence ${confidenceScore}% in ${assessment.confidenceBand} band). Secondary sampling or transect investigation recommended.`;
    } else if (confidenceScore < 40) {
      proposedOutcome = 'UNCERTAIN';
      reason = `Low overall evidence confidence (${confidenceScore}%). Field observations insufficient to corroborate hazard.`;
    } else {
      proposedOutcome = 'CONFIRMED';
      reason = `Sufficient multi-source corroboration achieved with field support (confidence: ${confidenceScore}%).`;
    }

    return {
      id: generateId(),
      incidentId: incident.id,
      verificationId: verification?.id,
      proposedOutcome,
      reason,
      supportingEvidence,
      confidence: confidenceScore,
      determinedAt: now,
      determinedBy: 'system:outcome_engine_v1',
      ruleVersion: this.RULE_VERSION,
    };
  }
}
