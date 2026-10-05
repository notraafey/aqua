/**
 * Resilience Scorecard & Monitoring Coverage Engine for AquaSentinel
 * Conforms to Phase 6 PRD Sections 19, 20
 *
 * CRITICAL DESIGN RULE:
 * Do not collapse health into an arbitrary single "composite score".
 * Instead, calculate and display explicit multidimensional components:
 * - Environmental Stability
 * - Evidence Coverage
 * - Monitoring Coverage & Source Diversity
 * - Active Incidents & Severity
 * - Response Readiness
 */

import {
  Observation,
  StreamReach,
  Incident,
  EarlyWarning,
  EvidenceAssessment,
  ReachResilienceScorecard,
  MonitoringCoverageBreakdown,
  SourceCoverageDetail,
  EnvironmentalStabilityRating,
  CoverageRating,
  ResponseReadinessRating,
} from '@aquasentinel/shared';
import { nowUtc } from '../value-objects.js';
import { TimeSeriesEngine } from './time-series-engine.js';

export interface ScorecardInput {
  reach: StreamReach;
  observations: Observation[];
  incidents: Incident[];
  activeEarlyWarnings: EarlyWarning[];
  assessment?: EvidenceAssessment | null;
  referenceTime?: string;
}

export class ResilienceScorecardEngine {
  /**
   * Calculates detailed monitoring coverage and observation frequency across sources.
   */
  public static calculateMonitoringCoverage(
    reach: StreamReach,
    observations: Observation[],
    referenceTime: string = nowUtc()
  ): MonitoringCoverageBreakdown {
    const tRefMs = new Date(referenceTime).getTime();
    const reachObs = observations.filter((o) => o.streamReachId === reach.id);

    const msInDay = 24 * 3600 * 1000;
    const obs30Days = reachObs.filter(
      (o) => tRefMs - new Date(o.timestamp).getTime() <= 30 * msInDay
    );
    const obs7Days = reachObs.filter(
      (o) => tRefMs - new Date(o.timestamp).getTime() <= 7 * msInDay
    );

    const sorted = TimeSeriesEngine.sortChronologically(reachObs);
    const lastObs = sorted.length > 0 ? sorted[sorted.length - 1] : undefined;
    const daysSinceLastObservation = lastObs
      ? Math.max(0, Math.round(((tRefMs - new Date(lastObs.timestamp).getTime()) / msInDay) * 10) / 10)
      : 999;

    const observationFrequencyPerWeek = Math.round((obs30Days.length / (30 / 7)) * 10) / 10;

    // Helper for source details
    const evaluateSource = (sourceName: string): SourceCoverageDetail => {
      const srcObs = reachObs.filter((o) => o.source.includes(sourceName));
      const sortedSrc = TimeSeriesEngine.sortChronologically(srcObs);
      const last = sortedSrc.length > 0 ? sortedSrc[sortedSrc.length - 1].timestamp : undefined;
      const count = srcObs.length;

      let status: 'HIGH' | 'MODERATE' | 'LOW' | 'NONE' = 'NONE';
      if (count >= 5) status = 'HIGH';
      else if (count >= 2) status = 'MODERATE';
      else if (count >= 1) status = 'LOW';

      return { count, lastTimestamp: last, status };
    };

    const satellite = evaluateSource('SATELLITE');
    const citizen = evaluateSource('CITIZEN');
    const weather = evaluateSource('WEATHER');
    const sensor = evaluateSource('SENSOR');

    // Overall Coverage rating
    let overallRating: CoverageRating = 'LOW';
    if (observationFrequencyPerWeek >= 3.0 && daysSinceLastObservation <= 5 && satellite.status !== 'NONE') {
      overallRating = 'HIGH';
    } else if (observationFrequencyPerWeek >= 1.0 && daysSinceLastObservation <= 14) {
      overallRating = 'MODERATE';
    } else if (reachObs.length === 0 || daysSinceLastObservation > 30) {
      overallRating = 'POOR';
    } else {
      overallRating = 'LOW';
    }

    return {
      reachId: reach.id,
      reachName: reach.name,
      overallRating,
      observationCount30Days: obs30Days.length,
      observationCount7Days: obs7Days.length,
      observationFrequencyPerWeek,
      daysSinceLastObservation,
      lastObservationTimestamp: lastObs?.timestamp,
      sourceBreakdown: {
        satellite,
        citizen,
        weather,
        sensor,
      },
    };
  }

  /**
   * Evaluates multidimensional resilience scorecard for a reach.
   */
  public static calculateScorecard(input: ScorecardInput): ReachResilienceScorecard {
    const { reach, observations, incidents, activeEarlyWarnings, assessment } = input;
    const refTime = input.referenceTime ?? nowUtc();

    const coverage = this.calculateMonitoringCoverage(reach, observations, refTime);

    // Filter NDCI points
    const ndciPoints = TimeSeriesEngine.extractSeries(
      observations.filter((o) => o.streamReachId === reach.id),
      'NDCI'
    );

    const baselineNdci = reach.baselineData?.typicalNdci ?? 0.12;
    const stats = TimeSeriesEngine.computeStats(ndciPoints, baselineNdci);
    const latestNdci = ndciPoints.length > 0 ? ndciPoints[ndciPoints.length - 1].value : undefined;

    // 1. Environmental Stability Rating
    let environmentalStability: EnvironmentalStabilityRating = 'STABLE';
    if (stats.trendClassification === 'ACCELERATING' || (latestNdci !== undefined && latestNdci > baselineNdci * 2)) {
      environmentalStability = 'DETERIORATING';
    } else if (stats.trendClassification === 'VOLATILE') {
      environmentalStability = 'VOLATILE';
    } else if (stats.trendClassification === 'INCREASING') {
      environmentalStability = 'MODERATE';
    } else {
      environmentalStability = 'STABLE';
    }

    // 2. Evidence Coverage
    let evidenceCoverage: 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
    if (assessment) {
      const evidenceCount =
        (assessment.supportingEvidenceIds?.length ?? 0) +
        (assessment.contradictingEvidenceIds?.length ?? 0);
      if (assessment.score >= 60 || evidenceCount >= 4) evidenceCoverage = 'HIGH';
      else if (assessment.score >= 35 || evidenceCount >= 2) evidenceCoverage = 'MODERATE';
    } else if (ndciPoints.length >= 4) {
      evidenceCoverage = 'MODERATE';
    }

    // 3. Active Incidents & Max Severity
    const reachIncidents = incidents.filter(
      (i) => i.streamReachId === reach.id && i.status !== 'RESOLVED' && i.status !== 'DISMISSED'
    );
    const activeIncidentCount = reachIncidents.length;

    let maxActiveIncidentSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined = undefined;
    const severityRanks: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    for (const inc of reachIncidents) {
      if (
        !maxActiveIncidentSeverity ||
        (severityRanks[inc.severity] ?? 0) > (severityRanks[maxActiveIncidentSeverity] ?? 0)
      ) {
        maxActiveIncidentSeverity = inc.severity;
      }
    }

    // 4. Response Readiness Rating
    let responseReadiness: ResponseReadinessRating = 'MODERATE';
    if (coverage.overallRating === 'HIGH' && reach.monitoringStatus === 'ACTIVE') {
      responseReadiness = 'HIGH';
    } else if (coverage.overallRating === 'POOR' || reach.monitoringStatus !== 'ACTIVE') {
      responseReadiness = 'LOW';
    }

    const reachWarnings = activeEarlyWarnings.filter((w) => w.streamReachId === reach.id);

    return {
      reachId: reach.id,
      reachName: reach.name,
      environmentalStability,
      evidenceCoverage,
      monitoringCoverage: coverage.overallRating,
      activeIncidentCount,
      maxActiveIncidentSeverity,
      responseReadiness,
      currentTrend: stats.trendClassification,
      latestNdci,
      baselineNdci,
      activeEarlyWarningsCount: reachWarnings.length,
      lastAssessedTimestamp: refTime,
    };
  }
}
