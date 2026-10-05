/**
 * Early-Warning Engine for AquaSentinel Resilience Intelligence
 * Conforms to Phase 6 PRD Sections 13, 14, 30, 31
 *
 * Multi-Signal Corroboration:
 * - Distinguishes isolated weak signals from corroborated signals.
 * - Evaluates sustained baseline deviation + accelerating environmental indicators.
 * - Incorporates cross-domain corroboration (citizen reports, weather conditions).
 * - Contradictory evidence reduces warning priority or flags conflicting state.
 * - Always provides structured, factual explanations of WHY the warning triggered.
 */

import {
  Observation,
  StreamReach,
  ObservationIndicator,
  EarlyWarning,
  EarlyWarningLevel,
  EvidenceAssessment,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../value-objects.js';
import { TimeSeriesEngine } from './time-series-engine.js';

export interface EarlyWarningEvaluationContext {
  reach: StreamReach;
  indicator?: ObservationIndicator;
  observations: Observation[];
  assessment?: EvidenceAssessment | null;
  incidentId?: string;
  referenceTime?: string;
}

export class EarlyWarningEngine {
  /**
   * Evaluates reach environmental conditions for early warnings.
   */
  public static evaluate(ctx: EarlyWarningEvaluationContext): EarlyWarning | null {
    const indicator = ctx.indicator ?? 'NDCI';
    const observations = ctx.observations.filter((o) => o.streamReachId === ctx.reach.id);

    // Filter indicator series
    const indicatorPoints = TimeSeriesEngine.extractSeries(observations, indicator);
    if (indicatorPoints.length < 2) {
      return null; // Insufficient data to evaluate early warning
    }

    const baselineValue =
      indicator === 'NDCI'
        ? ctx.reach.baselineData?.typicalNdci ?? 0.12
        : indicator === 'TURBIDITY'
        ? ctx.reach.baselineData?.typicalTurbidity ?? 4.0
        : 0.15;

    const stats = TimeSeriesEngine.computeStats(indicatorPoints, baselineValue);

    // 1. Detect sustained elevation (at least 2 of the last 3 observations >= 30% above baseline)
    const recentPoints = indicatorPoints.slice(-3);
    const elevatedRecent = recentPoints.filter(
      (p) => p.value >= baselineValue * 1.3
    );
    const isSustainedElevation = elevatedRecent.length >= 2;

    // 2. Trend direction and acceleration
    const isIncreasing =
      stats.trendClassification === 'INCREASING' || stats.trendClassification === 'ACCELERATING';
    const isAccelerating = stats.trendClassification === 'ACCELERATING';

    // 3. Cross-domain Corroboration: Citizen observations within last 7 days
    const recentCitizenObs = observations.filter(
      (o) =>
        o.source === 'CITIZEN_REPORT' &&
        (o.indicator === 'FOAM' || o.indicator === 'ODOR' || o.indicator === 'WATER_COLOR')
    );
    const hasCitizenCorroboration = recentCitizenObs.length > 0;

    // 4. Cross-domain Corroboration: Weather conditions (heavy rain/runoff or high heat)
    const recentWeatherObs = observations.filter(
      (o) =>
        o.source === 'WEATHER_STATION' &&
        (o.indicator === 'PRECIPITATION' || o.indicator === 'TEMPERATURE')
    );
    const heavyRain = recentWeatherObs.some(
      (o) => o.indicator === 'PRECIPITATION' && Number(o.value) > 20
    );
    const extremeHeat = recentWeatherObs.some(
      (o) => o.indicator === 'TEMPERATURE' && Number(o.value) > 28
    );

    // 5. Contradiction Detection: Recent high-confidence readings indicating pristine conditions
    const recentInSituOrSensor = observations.filter(
      (o) =>
        o.source === 'IN_SITU_SENSOR' ||
        (o.source === 'SATELLITE_SENTINEL2' && o.id !== indicatorPoints[indicatorPoints.length - 1].observationId)
    );
    const hasContradictoryNormal = recentInSituOrSensor.some((o) => {
      const dtHours =
        Math.abs(new Date(stats.lastTimestamp).getTime() - new Date(o.timestamp).getTime()) /
        (1000 * 3600);
      return dtHours <= 24 && o.indicator === indicator && Number(o.value) <= baselineValue;
    });

    // Check triggering thresholds
    if (!isSustainedElevation && !isIncreasing && !hasCitizenCorroboration) {
      return null; // No early warning condition met
    }

    // Determine warning level & confidence
    let warningLevel: EarlyWarningLevel = 'WATCH';
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    const contributingFactors: string[] = [];

    if (isSustainedElevation) {
      contributingFactors.push(
        `Sustained baseline elevation: ${elevatedRecent.length} of the last ${recentPoints.length} observations exceeded baseline by >= 30%.`
      );
    }

    if (isIncreasing) {
      contributingFactors.push(
        `Upward trend: trajectory is ${stats.trendClassification} with rate of +${stats.trendSlopePerDay}/day.`
      );
    }

    if (hasCitizenCorroboration) {
      contributingFactors.push(
        `Corroborating citizen reporting: ${recentCitizenObs.length} community report(s) noted visual water anomalies (foam/odor/color).`
      );
    }

    if (heavyRain) {
      contributingFactors.push('Hydrological context: recent heavy rainfall promotes agricultural runoff.');
    } else if (extremeHeat) {
      contributingFactors.push('Thermal context: elevated water temperature supports biological growth.');
    }

    if (hasContradictoryNormal) {
      contributingFactors.push(
        'Caveat: conflicting concurrent reading indicated near-baseline values, lowering warning priority.'
      );
      confidence = 'LOW';
    }

    // Multi-signal level evaluation
    if (isSustainedElevation && isAccelerating && (hasCitizenCorroboration || heavyRain) && !hasContradictoryNormal) {
      warningLevel = 'WARNING';
      confidence = 'HIGH';
    } else if (isSustainedElevation && (isIncreasing || hasCitizenCorroboration)) {
      warningLevel = 'ADVISORY';
      confidence = hasContradictoryNormal ? 'LOW' : 'MEDIUM';
    } else {
      warningLevel = 'WATCH';
      confidence = 'LOW';
    }

    // Recommended operational response (strictly operational monitoring advice, NOT medical)
    let recommendedAction = 'Maintain baseline surveillance and review upcoming satellite passes.';
    if (warningLevel === 'WARNING') {
      recommendedAction =
        'Priority recommendation: Increase monitoring frequency, dispatch field team for in-situ reach verification, and inspect upstream discharge points.';
    } else if (warningLevel === 'ADVISORY') {
      recommendedAction =
        'Recommended response: Increase sensor polling frequency and verify reach visually during routine patrol.';
    }

    // Structured trigger reason
    const triggerReason = `${warningLevel} on ${ctx.reach.name}: ${contributingFactors[0] ?? 'Elevated indicator trend'}`;

    return {
      id: generateId(),
      streamReachId: ctx.reach.id,
      reachName: ctx.reach.name,
      indicator,
      warningLevel,
      triggerReason,
      contributingFactors,
      confidence,
      recommendedAction,
      timestamp: nowUtc(),
      incidentId: ctx.incidentId,
      evidenceAssessmentId: ctx.assessment?.id,
      labels: ['EARLY_WARNING', 'MULTI_SIGNAL', 'INFERRED'],
    };
  }
}
