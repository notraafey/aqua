import {
  ObservationSource,
  QualityStatus,
  ObservationIndicator,
} from '@aquasentinel/shared';

export interface QualityAssessmentInput {
  source: ObservationSource;
  indicator: ObservationIndicator | string;
  value: number | string;
  timestamp: string;
  cloudCoverFraction?: number;
  narrowStreamWarning?: boolean;
  hasPhotos?: boolean;
  isAssociated?: boolean;
}

export interface QualityAssessmentResult {
  status: QualityStatus;
  score: number; // Factual reliability estimate (0.0 - 1.0)
  reasons: string[];
  metadata: {
    cloudCoverFraction?: number;
    narrowStreamWarning?: boolean;
    hasPhotos?: boolean;
    physicalBoundsValid: boolean;
    temporalSanityValid: boolean;
  };
}

export class QualityAssessor {
  /**
   * Assess the factual quality of an incoming environmental observation.
   */
  public assess(input: QualityAssessmentInput): QualityAssessmentResult {
    const reasons: string[] = [];
    let score = 1.0;
    let status: QualityStatus = 'VALIDATED';

    // 1. Temporal Sanity Check
    const obsTime = new Date(input.timestamp).getTime();
    const now = Date.now();
    let temporalSanityValid = true;

    if (isNaN(obsTime)) {
      status = 'REJECTED';
      score = 0.0;
      reasons.push('Invalid timestamp format');
      temporalSanityValid = false;
    } else if (obsTime > now + 3600000) {
      // Future timestamp beyond 1 hour grace
      status = 'REJECTED';
      score = 0.0;
      reasons.push('Future timestamp rejected');
      temporalSanityValid = false;
    }

    // 2. Physical Bounds Check per indicator
    let physicalBoundsValid = true;
    const numVal = typeof input.value === 'number' ? input.value : parseFloat(String(input.value));

    switch (input.indicator) {
      case 'NDCI':
        if (isNaN(numVal) || numVal < -1.0 || numVal > 1.0) {
          status = 'REJECTED';
          score = 0.0;
          reasons.push(`NDCI value ${input.value} outside theoretical range [-1.0, 1.0]`);
          physicalBoundsValid = false;
        }
        break;

      case 'PRECIPITATION':
        if (isNaN(numVal) || numVal < 0 || numVal > 500) {
          status = 'REJECTED';
          score = 0.0;
          reasons.push(`Precipitation value ${input.value} outside reasonable physical range [0, 500] mm`);
          physicalBoundsValid = false;
        }
        break;

      case 'AIR_TEMP':
      case 'WATER_TEMP':
        if (isNaN(numVal) || numVal < -60 || numVal > 60) {
          status = 'REJECTED';
          score = 0.0;
          reasons.push(`Temperature value ${input.value} outside physical range [-60, 60] °C`);
          physicalBoundsValid = false;
        }
        break;

      case 'TURBIDITY':
        if (isNaN(numVal) || numVal < 0) {
          status = 'REJECTED';
          score = 0.0;
          reasons.push(`Turbidity cannot be negative: ${input.value}`);
          physicalBoundsValid = false;
        }
        break;

      case 'PH':
        if (isNaN(numVal) || numVal < 0 || numVal > 14) {
          status = 'REJECTED';
          score = 0.0;
          reasons.push(`pH value ${input.value} outside range [0, 14]`);
          physicalBoundsValid = false;
        }
        break;
    }

    if (!physicalBoundsValid || !temporalSanityValid) {
      return {
        status: 'REJECTED',
        score: 0.0,
        reasons,
        metadata: {
          cloudCoverFraction: input.cloudCoverFraction,
          narrowStreamWarning: input.narrowStreamWarning,
          hasPhotos: input.hasPhotos,
          physicalBoundsValid,
          temporalSanityValid,
        },
      };
    }

    // 3. Source-Specific Quality Rules
    if (input.source === 'SATELLITE_SENTINEL2') {
      score = 0.85;

      // Cloud contamination gating
      if (input.cloudCoverFraction !== undefined) {
        if (input.cloudCoverFraction > 0.40) {
          status = 'REJECTED';
          score = 0.1;
          reasons.push(`Severe cloud contamination: ${(input.cloudCoverFraction * 100).toFixed(1)}% cloud cover exceeds 40% threshold`);
        } else if (input.cloudCoverFraction > 0.15) {
          status = 'FLAGGED';
          score -= 0.25;
          reasons.push(`Moderate cloud contamination: ${(input.cloudCoverFraction * 100).toFixed(1)}%`);
        }
      }

      // Narrow stream mixed-pixel warning
      if (input.narrowStreamWarning) {
        if (status !== 'REJECTED') {
          status = 'FLAGGED';
        }
        score -= 0.2;
        reasons.push('Stream width constraint warning: reach width is narrower than Sentinel-2 20m pixel resolution (mixed pixel risk)');
      }
    } else if (input.source === 'WEATHER_STATION') {
      score = 0.90;
    } else if (input.source === 'CITIZEN_REPORT') {
      score = 0.60;
      if (input.hasPhotos) {
        score += 0.15;
      } else {
        reasons.push('Citizen report lacks accompanying photographic evidence');
      }

      if (!input.isAssociated) {
        status = 'FLAGGED';
        reasons.push('Citizen report not located within any monitored stream reach');
      }
    }

    score = Math.max(0.0, Math.min(1.0, Math.round(score * 100) / 100));

    return {
      status,
      score,
      reasons,
      metadata: {
        cloudCoverFraction: input.cloudCoverFraction,
        narrowStreamWarning: input.narrowStreamWarning,
        hasPhotos: input.hasPhotos,
        physicalBoundsValid,
        temporalSanityValid,
      },
    };
  }
}

export const qualityAssessor = new QualityAssessor();
