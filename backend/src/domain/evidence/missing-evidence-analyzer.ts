/**
 * Missing Evidence Analyzer for AquaSentinel Evidence Fusion Engine
 * Explicitly distinguishes "Evidence Absent" from "Evidence Contradicts".
 * Conforms to Main PRD Section 20.5 and Phase 3 PRD Sections 18, 29.
 */

import { CorroborationGroup, BaselineStatus } from '@aquasentinel/shared';

export interface MissingEvidenceResult {
  missingItems: string[];
  recommendedDataGathering: string[];
}

export class MissingEvidenceAnalyzer {
  /**
   * Identifies what critical evidence dimensions are missing from the current evidence set.
   */
  public analyze(params: {
    activeGroups: CorroborationGroup[];
    baselineStatus: BaselineStatus;
    hasCloudInterference?: boolean;
    hasFieldVerification?: boolean;
  }): MissingEvidenceResult {
    const { activeGroups, baselineStatus, hasCloudInterference, hasFieldVerification } = params;
    const missing: string[] = [];
    const recommendations: string[] = [];

    // 1. Citizen ground observation check
    if (!activeGroups.includes('CITIZEN')) {
      missing.push('No ground citizen science reports or eyewitness accounts available.');
      recommendations.push('Dispatch field request to citizen science community or local volunteers.');
    }

    // 2. Baseline comparison check
    if (baselineStatus === 'UNAVAILABLE') {
      missing.push('Historical baseline unavailable for evaluated indicators.');
      recommendations.push('Establish local seasonal baseline via historical lookback or reach calibration.');
    } else if (baselineStatus === 'INSUFFICIENT') {
      missing.push('Historical observations insufficient for robust statistical deviation modeling.');
    }

    // 3. Meteorological context check
    if (!activeGroups.includes('WEATHER')) {
      missing.push('No recent meteorological context (precipitation / temperature / wind).');
      recommendations.push('Ingest Open-Meteo hourly weather history for reach coordinates.');
    }

    // 4. In-situ physical sensor check
    if (!activeGroups.includes('IN_SITU')) {
      missing.push('No in-situ telemetry (continuous DO, turbidity, pH probes).');
    }

    // 5. Satellite coverage / cloud obscuration check
    if (!activeGroups.includes('REMOTE_SENSING')) {
      missing.push('No satellite remote sensing coverage for monitored reach.');
      recommendations.push('Query Sentinel-2 MSI archive for recent cloud-free passes.');
    } else if (hasCloudInterference) {
      missing.push('Cloud-free satellite imagery unavailable due to local cloud cover.');
    }

    // 6. Field verification / laboratory sampling check
    if (!hasFieldVerification) {
      missing.push('No physical field verification or laboratory water quality sampling recorded.');
      recommendations.push('Recommend formal water sampling / field inspection to verify suspected anomaly.');
    }

    return {
      missingItems: missing,
      recommendedDataGathering: recommendations,
    };
  }
}

export const missingEvidenceAnalyzer = new MissingEvidenceAnalyzer();
