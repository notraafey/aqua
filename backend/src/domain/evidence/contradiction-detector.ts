/**
 * Contradiction Detector for AquaSentinel Evidence Fusion Engine
 * Actively surfaces signals, conditions, and contextual records that weaken the incident hypothesis.
 * Conforms to Main PRD Section 20.2 & 20.3 and Phase 3 PRD Sections 17, 32.
 */

import { Observation, StreamReach, CorroborationGroup } from '@aquasentinel/shared';
import { defaultEvidenceConfig, EvidenceFusionConfig } from './config.js';

export interface ContradictionItem {
  rule: string;
  observationId?: string;
  source?: string;
  penalty: number;
  reason: string;
}

export interface ContradictionDetectionResult {
  hasContradictions: boolean;
  contradictions: ContradictionItem[];
  totalPenalty: number;
  summary: string;
}

export class ContradictionDetector {
  private config: EvidenceFusionConfig;

  constructor(config: EvidenceFusionConfig = defaultEvidenceConfig) {
    this.config = config;
  }

  /**
   * Evaluates an evidence collection for contradictory or weakening signals.
   */
  public detect(params: {
    primaryAnomaly?: Observation;
    observations: Observation[];
    reach?: StreamReach | null;
    activeGroups: CorroborationGroup[];
  }): ContradictionDetectionResult {
    const contradictions: ContradictionItem[] = [];
    const { primaryAnomaly, observations, reach, activeGroups } = params;

    // 1. Narrow stream mixed-pixel uncorroborated anomaly
    if (primaryAnomaly?.source === 'SATELLITE_SENTINEL2') {
      const isNarrow =
        reach?.waterCoverageConstraint && reach.waterCoverageConstraint.minWidthMeters < 15;
      const hasGroundCorroboration =
        activeGroups.includes('CITIZEN') || activeGroups.includes('IN_SITU');

      if (isNarrow && !hasGroundCorroboration) {
        contradictions.push({
          rule: 'UNCORROBORATED_NARROW_STREAM_SATELLITE',
          observationId: primaryAnomaly.id,
          source: 'SATELLITE_SENTINEL2',
          penalty: this.config.penalties.narrowStreamMixedPixel,
          reason: `Satellite anomaly observed over narrow reach (${reach?.name ?? 'Stream'}, <15m width) without ground or in-situ corroboration. Bank vegetation reflectance mixed-pixel artifact probable.`,
        });
      }

      // Cloud cover gating contradiction
      const cloudCover = typeof primaryAnomaly.metadata?.cloudCoverFraction === 'number'
        ? (primaryAnomaly.metadata.cloudCoverFraction as number)
        : 0;
      if (cloudCover > 0.15) {
        contradictions.push({
          rule: 'HIGH_CLOUD_COVER_CONTRADICTION',
          observationId: primaryAnomaly.id,
          source: 'SATELLITE_SENTINEL2',
          penalty: this.config.penalties.highCloudCover,
          reason: `Satellite acquisition has ${(cloudCover * 100).toFixed(1)}% cloud cover, introducing significant optical uncertainty that weakens the spectral bloom hypothesis.`,
        });
      }
    }

    // 2. Conflicting normal environmental observations within the window
    for (const obs of observations) {
      if (obs.id === primaryAnomaly?.id) continue;

      // Check if an observation explicitly records normal / healthy baseline conditions
      if (obs.indicator === 'NDCI' && typeof obs.value === 'number' && obs.value < 0.10) {
        contradictions.push({
          rule: 'CONFLICTING_NORMAL_NDCI',
          observationId: obs.id,
          source: obs.source,
          penalty: this.config.penalties.conflictingNormalReading,
          reason: `Concurrent satellite observation recorded normal chlorophyll levels (NDCI: ${obs.value}), conflicting with the anomaly interpretation.`,
        });
      }

      // High dissolved oxygen (>7.5 mg/L) contradicts severe hypoxic/algal crash
      if (obs.indicator === 'DISSOLVED_OXYGEN' && typeof obs.value === 'number' && obs.value >= 7.5) {
        contradictions.push({
          rule: 'HEALTHY_DISSOLVED_OXYGEN',
          observationId: obs.id,
          source: obs.source,
          penalty: 15,
          reason: `Normal dissolved oxygen levels (${obs.value} mg/L) contradict immediate severe eutrophic hypoxia.`,
        });
      }
    }

    // 3. Heavy rainfall context explaining turbidity
    const heavyRain = observations.find(
      (o) => o.indicator === 'PRECIPITATION' && typeof o.value === 'number' && o.value >= 15
    );
    const elevatedTurbidity = observations.find(
      (o) => o.indicator === 'TURBIDITY' && typeof o.value === 'number' && o.value > 10
    );
    if (heavyRain && elevatedTurbidity) {
      contradictions.push({
        rule: 'STORM_RUNOFF_EXPLANATION',
        observationId: heavyRain.id,
        source: 'WEATHER_STATION',
        penalty: 15,
        reason: `Recent heavy precipitation (${heavyRain.value} mm) provides a natural meteorological explanation for elevated turbidity (storm runoff) rather than an illicit discharge incident.`,
      });
    }

    const totalPenalty = contradictions.reduce((sum, c) => sum + c.penalty, 0);

    let summary = 'No contradictory signals detected.';
    if (contradictions.length > 0) {
      summary = `${contradictions.length} contradictory or weakening factor(s) identified (total penalty: -${totalPenalty} pts): ${contradictions
        .map((c) => c.reason)
        .join(' ')}`;
    }

    return {
      hasContradictions: contradictions.length > 0,
      contradictions,
      totalPenalty,
      summary,
    };
  }
}

export const contradictionDetector = new ContradictionDetector();
