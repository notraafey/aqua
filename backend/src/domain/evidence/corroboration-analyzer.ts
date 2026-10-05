/**
 * Corroboration Analyzer for AquaSentinel Evidence Fusion Engine
 * Enforces evidence independence, source-group caps, and diminishing returns.
 * Conforms to Main PRD Section 20.3 and Phase 3 PRD Sections 5, 16, 21, 22.
 */

import { Observation, ObservationSource, CorroborationGroup } from '@aquasentinel/shared';
import { defaultEvidenceConfig, EvidenceFusionConfig } from './config.js';

export interface GroupContribution {
  group: CorroborationGroup;
  observationCount: number;
  rawPoints: number;
  effectivePoints: number;
  isCapped: boolean;
  observations: Observation[];
}

export interface CorroborationAnalysisResult {
  independentGroups: CorroborationGroup[];
  groupContributions: Record<CorroborationGroup, GroupContribution>;
  totalBasePoints: number;
  corroborationBonus: number;
  effectiveCorroborationPoints: number;
  explanation: string;
}

export class CorroborationAnalyzer {
  private config: EvidenceFusionConfig;

  constructor(config: EvidenceFusionConfig = defaultEvidenceConfig) {
    this.config = config;
  }

  /**
   * Maps an observation source or indicator to its independent corroboration group.
   */
  public getCorroborationGroup(source: ObservationSource, indicator?: string): CorroborationGroup {
    switch (source) {
      case 'SATELLITE_SENTINEL2':
        return 'REMOTE_SENSING';
      case 'CITIZEN_REPORT':
        return 'CITIZEN';
      case 'WEATHER_STATION':
        return 'WEATHER';
      case 'HISTORICAL_BASELINE':
        return 'HISTORICAL_BASELINE';
      case 'IN_SITU_SENSOR':
        return 'IN_SITU';
      default:
        if (indicator === 'PRECIPITATION' || indicator === 'AIR_TEMP') return 'WEATHER';
        return 'CITIZEN';
    }
  }

  /**
   * Analyzes a collection of supporting observations, calculating group contributions
   * with diminishing returns and independent multi-source bonuses.
   */
  public analyze(
    supportingObservations: { observation: Observation; baseScore: number }[]
  ): CorroborationAnalysisResult {
    // Group observations by independent group
    const groups: Record<CorroborationGroup, { observation: Observation; baseScore: number }[]> = {
      REMOTE_SENSING: [],
      CITIZEN: [],
      WEATHER: [],
      HISTORICAL_BASELINE: [],
      IN_SITU: [],
    };

    for (const item of supportingObservations) {
      const group = this.getCorroborationGroup(
        item.observation.source,
        String(item.observation.indicator)
      );
      groups[group].push(item);
    }

    const groupContributions: Record<CorroborationGroup, GroupContribution> = {
      REMOTE_SENSING: { group: 'REMOTE_SENSING', observationCount: 0, rawPoints: 0, effectivePoints: 0, isCapped: false, observations: [] },
      CITIZEN: { group: 'CITIZEN', observationCount: 0, rawPoints: 0, effectivePoints: 0, isCapped: false, observations: [] },
      WEATHER: { group: 'WEATHER', observationCount: 0, rawPoints: 0, effectivePoints: 0, isCapped: false, observations: [] },
      HISTORICAL_BASELINE: { group: 'HISTORICAL_BASELINE', observationCount: 0, rawPoints: 0, effectivePoints: 0, isCapped: false, observations: [] },
      IN_SITU: { group: 'IN_SITU', observationCount: 0, rawPoints: 0, effectivePoints: 0, isCapped: false, observations: [] },
    };

    const activeGroups: CorroborationGroup[] = [];
    let totalBasePoints = 0;

    for (const [grpKey, items] of Object.entries(groups)) {
      const group = grpKey as CorroborationGroup;
      if (items.length === 0) continue;

      activeGroups.push(group);
      const cap = this.config.sourceGroupCaps[group];
      let rawPoints = 0;
      let effectivePoints = 0;

      items.forEach((item, index) => {
        rawPoints += item.baseScore;
        // Apply diminishing returns multiplier: index 0 -> 1.0, 1 -> 0.5, 2+ -> 0.1
        const multiplier =
          index < this.config.diminishingReturns.length
            ? this.config.diminishingReturns[index]
            : this.config.diminishingReturns[this.config.diminishingReturns.length - 1];

        effectivePoints += item.baseScore * multiplier;
      });

      const isCapped = effectivePoints > cap;
      const finalGroupPoints = Math.min(effectivePoints, cap);

      groupContributions[group] = {
        group,
        observationCount: items.length,
        rawPoints: Math.round(rawPoints),
        effectivePoints: Math.round(finalGroupPoints),
        isCapped,
        observations: items.map((i) => i.observation),
      };

      totalBasePoints += finalGroupPoints;
    }

    // Calculate independent corroboration bonus
    let corroborationBonus = 0;
    if (activeGroups.length >= 3) {
      corroborationBonus = this.config.corroborationBonuses.threeOrMoreGroups;
    } else if (activeGroups.length === 2) {
      corroborationBonus = this.config.corroborationBonuses.twoGroups;
    }

    const effectiveCorroborationPoints = Math.round(totalBasePoints + corroborationBonus);

    // Build human-readable explanation
    let explanation = '';
    if (activeGroups.length === 0) {
      explanation = 'No supporting observations available.';
    } else if (activeGroups.length === 1) {
      explanation = `Single evidence source group active (${activeGroups[0]}). No independent multi-source corroboration.`;
    } else {
      explanation = `Multi-source corroboration confirmed across ${activeGroups.length} independent groups (${activeGroups.join(
        ', '
      )}), providing +${corroborationBonus} points corroboration bonus.`;
    }

    return {
      independentGroups: activeGroups,
      groupContributions,
      totalBasePoints: Math.round(totalBasePoints),
      corroborationBonus,
      effectiveCorroborationPoints,
      explanation,
    };
  }
}

export const corroborationAnalyzer = new CorroborationAnalyzer();
