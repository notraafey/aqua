/**
 * Operational Severity Calculator
 * Conforms to Phase 4 PRD Section 7.
 * 
 * Computes consequential operational severity separate from evidence confidence.
 * While evidence confidence answers "How certain are we?", operational severity
 * answers "How severe would the impact be if confirmed?".
 */

import {
  EvidenceAssessment,
  IncidentClassification,
  StreamReach,
  OperationalSeverity,
  OperationalSeverityLevel,
  SeverityFactor,
} from '@aquasentinel/shared';
import { nowUtc } from '../value-objects.js';

export interface CalculateSeverityOptions {
  assessment: EvidenceAssessment;
  classification: IncidentClassification;
  reach: StreamReach;
}

export class SeverityCalculator {
  /**
   * Computes deterministic operational severity score and level.
   */
  public calculate(
    optionsOrAssessment: CalculateSeverityOptions | EvidenceAssessment,
    classificationArg?: IncidentClassification,
    reachArg?: StreamReach
  ): OperationalSeverity {
    let assessment: EvidenceAssessment;
    let classification: IncidentClassification;
    let reach: StreamReach;

    if ('score' in optionsOrAssessment && classificationArg && reachArg) {
      assessment = optionsOrAssessment as EvidenceAssessment;
      classification = classificationArg;
      reach = reachArg;
    } else {
      const opts = optionsOrAssessment as CalculateSeverityOptions;
      assessment = opts.assessment;
      classification = opts.classification;
      reach = opts.reach;
    }

    const factors: SeverityFactor[] = [];

    // Factor 1: Evidence Confidence Base (Weight: 25%)
    // High evidence strength increases operational urgency
    const confidenceScore = Math.min(100, Math.max(0, assessment.score));
    factors.push({
      factor: 'EVIDENCE_CONFIDENCE',
      weight: 0.25,
      score: confidenceScore,
      description: `Underlying evidence assessment score is ${assessment.score}/100 (${assessment.confidenceBand})`,
    });

    // Factor 2: Acute Hazard / Contaminant Nature (Weight: 30%)
    // Cyanobloom with cyanotoxins or raw sewage has highest public health consequence
    let hazardScore = 30;
    if (classification.type === 'POSSIBLE_CYANOBLOOM') {
      hazardScore = 88;
      if (
        (classification.confidence ?? 0) >= 0.9 ||
        (classification.stressorEvidence &&
          classification.stressorEvidence.some(
            (s: string) => s.toLowerCase().includes('toxin') || s.toLowerCase().includes('hypoxia')
          ))
      ) {
        hazardScore = 92;
      }
    } else if (classification.type === 'POSSIBLE_SEWAGE_CONTAMINATION') {
      hazardScore = 85;
    } else if (classification.type === 'POSSIBLE_INDUSTRIAL_DISCHARGE') {
      hazardScore = 80;
    } else if (classification.type === 'POSSIBLE_EUTROPHICATION') {
      hazardScore = 55;
    } else if (classification.type === 'POSSIBLE_STORMWATER_EVENT') {
      hazardScore = 25;
    }
    factors.push({
      factor: 'HAZARD_SEVERITY',
      weight: 0.3,
      score: hazardScore,
      description: `Potential hazard profile '${classification.type}' consequence rating: ${hazardScore}/100`,
    });

    // Factor 3: Human / Recreational Exposure Potential (Weight: 25%)
    // Urban reaches with public access, pedestrian promenades, or city centers
    let exposureScore = 40;
    const reachText = (
      (reach.id || '') +
      ' ' +
      (reach.name || '') +
      ' ' +
      (reach.region || '') +
      ' ' +
      (reach.city || '')
    ).toLowerCase();
    const isUrban =
      reachText.includes('urban') ||
      reachText.includes('downtown') ||
      reachText.includes('volos') ||
      reachText.includes('city') ||
      reachText.includes('alpha') ||
      reachText.includes('heraklion');
    if (isUrban) {
      exposureScore = classification.type === 'POSSIBLE_STORMWATER_EVENT' ? 45 : 80;
    }
    factors.push({
      factor: 'HUMAN_EXPOSURE_POTENTIAL',
      weight: 0.25,
      score: exposureScore,
      description: isUrban
        ? `Reach is situated in urban corridor (${reach.city || 'Urban area'}) with direct public exposure pathways`
        : 'Reach is situated in rural/low-density setting with limited direct public contact',
    });

    // Factor 4: Citizen Report Presence (Weight: 10%)
    // Active citizen sightings indicate visible impacts affecting the public
    const hasCitizen = (assessment.supportingEvidence || []).some(
      (e) => e.corroborationGroup === 'CITIZEN' || e.indicator === 'WATER_COLOR'
    );
    const citizenScore = hasCitizen ? 90 : 20;
    factors.push({
      factor: 'PUBLIC_VISIBILITY',
      weight: 0.1,
      score: citizenScore,
      description: hasCitizen
        ? 'Direct citizen eyewitness reports confirm public visibility and concern'
        : 'No direct citizen eyewitness reports recorded',
    });

    // Factor 5: Ecological Sensitivity & Spatial Extent (Weight: 10%)
    // Reaches with ecological constraints or baseline deviation
    const hasBaselineDeviation = !!assessment.baselineDeviation?.isAnomalous;
    const hasSevereStressor =
      classification.stressorEvidence &&
      classification.stressorEvidence.some((s: string) =>
        s.toLowerCase().includes('hypoxia') ||
        s.toLowerCase().includes('toxin') ||
        s.toLowerCase().includes('mortality') ||
        s.toLowerCase().includes('spill') ||
        s.toLowerCase().includes('acute')
      );
    const ecologicalScore = hasBaselineDeviation || hasSevereStressor ? 75 : 40;
    factors.push({
      factor: 'ECOLOGICAL_IMPACT',
      weight: 0.1,
      score: ecologicalScore,
      description: hasBaselineDeviation
        ? `Statistical baseline deviation confirmed (deviation: ${assessment.baselineDeviation?.deviationMagnitude?.toFixed(2) ?? 'high'})`
        : 'Parameters within expected seasonal baseline boundaries',
    });

    // Weighted composite score calculation
    const compositeScore = Math.round(
      factors.reduce((sum, f) => sum + f.score * f.weight, 0)
    );

    // Map to OperationalSeverityLevel
    let level: OperationalSeverityLevel = 'LOW';
    if (compositeScore >= 75) {
      level = 'CRITICAL';
    } else if (compositeScore >= 60) {
      level = 'HIGH';
    } else if (compositeScore >= 40) {
      level = 'MODERATE';
    } else {
      level = 'LOW';
    }

    const factorArray: any = [...factors];
    factorArray.confidenceFactor = confidenceScore;
    factorArray.hazardProfile = hazardScore;
    factorArray.exposurePotential = exposureScore;
    factorArray.publicVisibility = citizenScore;
    factorArray.ecologicalImpact = ecologicalScore;

    const explanations = factors.map((f) => f.description);

    return {
      level,
      score: compositeScore,
      factors: factorArray,
      explanations,
      calculatedAt: nowUtc(),
    };
  }
}

export const severityCalculator = new SeverityCalculator();
