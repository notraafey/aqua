/**
 * Deterministic Incident Classification Engine
 * Conforms to Phase 4 PRD Section 6 and Section 29 (Scientific/Ethical Guardrails).
 * 
 * Maps multi-source evidence assessments to standardized incident classifications
 * with explicit caveats and transparent rationale.
 */

import {
  EvidenceAssessment,
  IncidentClassification,
  IncidentClassificationType,
  EvidenceItem,
} from '@aquasentinel/shared';
import { nowUtc } from '../value-objects.js';

export interface ClassifyIncidentOptions {
  assessment: EvidenceAssessment;
}

export class IncidentClassifier {
  /**
   * Deterministically classifies an environmental incident from an EvidenceAssessment.
   */
  public classify(assessment: EvidenceAssessment): IncidentClassification {
    const supporting = assessment.supportingEvidence || [];
    const contradicting = assessment.contradictingEvidence || [];
    const missing = assessment.missingEvidence || [];

    const supportingIds = assessment.supportingEvidenceIds || supporting.map((s) => s.id);
    const contradictingIds = assessment.contradictingEvidenceIds || contradicting.map((c) => c.id);

    // Indicator checks
    const ndciItem = supporting.find((item) => item.indicator === 'NDCI');
    const turbidityItem = supporting.find((item) => item.indicator === 'TURBIDITY');
    const citizenItem = supporting.find(
      (item) => item.corroborationGroup === 'CITIZEN' || item.indicator === 'WATER_COLOR' || item.indicator === 'ODOR'
    );
    const stormContradiction = contradicting.find(
      (item) =>
        item.rule === 'STORM_RUNOFF_EXPLANATION' ||
        item.reason?.toLowerCase().includes('rain') ||
        item.reason?.toLowerCase().includes('runoff')
    );
    const weatherRain = supporting.find(
      (item) => item.indicator === 'RAINFALL_ACCUMULATION' || item.source === 'WEATHER_STATION'
    );
    const doItem = supporting.find((item) => item.indicator === 'DISSOLVED_OXYGEN');
    const phItem = supporting.find((item) => item.indicator === 'PH' || item.indicator === 'pH');
    const ammoniaItem = supporting.find((item) => item.indicator === 'AMMONIA');
    const coliformItem = supporting.find((item) => item.indicator === 'COLIFORM');

    const primaryIndicators: string[] = [];
    if (ndciItem) primaryIndicators.push('NDCI');
    if (doItem) primaryIndicators.push('DISSOLVED_OXYGEN');
    if (phItem) primaryIndicators.push('PH');
    if (turbidityItem) primaryIndicators.push('TURBIDITY');
    if (ammoniaItem) primaryIndicators.push('AMMONIA');
    if (coliformItem) primaryIndicators.push('COLIFORM');
    if (weatherRain) primaryIndicators.push('RAINFALL_ACCUMULATION');

    let type: IncidentClassificationType = 'UNKNOWN_WATER_QUALITY_ANOMALY';
    let rationale = '';

    const citizenText = citizenItem ? String(citizenItem.value).toLowerCase() : '';
    const hasBloomKeywords =
      citizenText.includes('scum') ||
      citizenText.includes('green') ||
      citizenText.includes('cyan') ||
      citizenText.includes('algae') ||
      citizenText.includes('film');

    // 1. Stormwater Event Check
    const isStormwater = (stormContradiction || weatherRain) && turbidityItem && (!ndciItem || Number(ndciItem.value) < 0.25);
    if (isStormwater) {
      type = 'POSSIBLE_STORMWATER_EVENT';
      rationale =
        'Elevated turbidity coincided with heavy precipitation and meteorological runoff conditions, consistent with transient stormwater discharge rather than biochemical contamination.';
    }
    // 2. Cyanobacteria / Algal Bloom Check
    else if (
      ndciItem &&
      Number(ndciItem.value) >= 0.20 &&
      ((doItem && Number(doItem.value) < 3.5) || hasBloomKeywords || Number(ndciItem.value) >= 0.35)
    ) {
      type = 'POSSIBLE_CYANOBLOOM';
      rationale =
        'Cyanobacterial bloom signature: Optical remote sensing indicates anomalous chlorophyll-a / NDCI surface reflectance, corroborated by visible surface scum characteristics or acute dissolved oxygen depression.';
    }
    // 3. Eutrophication Check
    else if (ndciItem && Number(ndciItem.value) >= 0.15) {
      type = 'POSSIBLE_EUTROPHICATION';
      rationale =
        'Multi-source observations show persistent elevated chlorophyll-a and organic density indicating possible accelerated nutrient enrichment and eutrophication.';
    }
    // 4. Sewage / Organic Contamination Check
    else if (
      ammoniaItem ||
      coliformItem ||
      (turbidityItem &&
        (citizenText.includes('sewage') ||
          citizenText.includes('sewer') ||
          citizenText.includes('odor') ||
          (doItem && Number(doItem.value) < 4.0)))
    ) {
      type = 'POSSIBLE_SEWAGE_CONTAMINATION';
      rationale =
        'Combination of physical water turbidity, dissolved oxygen depression, and visual/olfactory reports suggests possible combined sewer overflow or domestic wastewater ingress.';
    }
    // 5. Industrial Discharge Check
    else if (
      (phItem && (Number(phItem.value) < 6.0 || Number(phItem.value) > 8.5)) ||
      citizenText.includes('sheen') ||
      (turbidityItem && !ndciItem && !stormContradiction && !weatherRain)
    ) {
      type = 'POSSIBLE_INDUSTRIAL_DISCHARGE';
      rationale =
        'Localized abnormal physicochemical parameters without meteorological runoff explanation suggest possible illicit point-source or industrial outfall discharge.';
    }
    // 6. General Anomaly Fallback
    else {
      type = 'UNKNOWN_WATER_QUALITY_ANOMALY';
      rationale =
        'Observable deviations from baseline detected, but parameter signature does not conclusively match specific known chemical or biological contamination profiles.';
    }

    return {
      type,
      confidenceBand: assessment.confidenceBand,
      confidence: assessment.score / 100,
      primaryIndicators,
      stressorEvidence: supporting.map((s) => s.reason || `${s.indicator} anomaly`),
      supportingEvidenceIds: supportingIds,
      contradictingEvidenceIds: contradictingIds,
      missingEvidence: missing,
      rationale,
      classifiedAt: nowUtc(),
    };
  }
}

export const incidentClassifier = new IncidentClassifier();
