/**
 * Scenario Simulation & Comparison Engine for AquaSentinel
 * Conforms to Phase 6 PRD Sections 15, 16, 17, 18, 24
 *
 * CRITICAL SCIENTIFIC PRINCIPLES:
 * - Transparent, parameterized scenario analysis (not a fake physics simulation).
 * - All assumptions made explicit in output.
 * - Explicit labels: SIMULATED, HYPOTHETICAL, MODELLED_EFFECT.
 * - Distinguishes modelled effect from verified post-intervention effect.
 * - Deterministic, testable, and reproducible.
 */

import {
  ForecastResult,
  ScenarioSimulation,
  ScenarioType,
  ScenarioParameters,
  ProjectionPoint,
  ScenarioComparison,
  ScenarioComparisonPoint,
  ForecastUncertainty,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../value-objects.js';

export interface SimulateScenarioInput {
  baselineForecast: ForecastResult;
  type: ScenarioType;
  name?: string;
  description?: string;
  parameters?: ScenarioParameters;
}

export class ScenarioEngine {
  public static readonly VERSION = '1.0.0';

  /**
   * Simulates an environmental trajectory under a specified scenario hypothesis.
   */
  public static simulate(input: SimulateScenarioInput): ScenarioSimulation {
    const { baselineForecast, type } = input;
    const params: ScenarioParameters = input.parameters ?? {};
    const assumptions: string[] = [];

    const baseProjections = baselineForecast.projections;
    const simulatedProjections: ProjectionPoint[] = [];

    let name = input.name;
    let description = input.description;
    let uncertainty: ForecastUncertainty = baselineForecast.uncertainty;

    switch (type) {
      case 'CURRENT_CONTINUES': {
        name = name ?? 'Status Quo Continuation';
        description =
          description ??
          'Current empirical trajectory and meteorological conditions continue unchanged.';
        assumptions.push('Baseline rate of change and environmental conditions remain constant.');
        assumptions.push('No acute meteorological shock or operational intervention occurs.');

        // Exact match with baseline forecast
        for (const bp of baseProjections) {
          simulatedProjections.push({ ...bp });
        }
        break;
      }

      case 'ACCELERATED_DETERIORATION': {
        const mult = params.accelerationMultiplier ?? 1.5;
        name = name ?? `Accelerated Deterioration (${mult}×)`;
        description =
          description ??
          `Environmental indicator increases at ${mult}× recent baseline rate due to compounded stress or nutrient surge.`;
        assumptions.push(
          `Environmental degradation rate accelerates by a factor of ${mult}× over baseline trajectory.`
        );
        assumptions.push('Assumes prolonged stagnant hydrological flow and uninterrupted solar radiation.');

        const v0 = baselineForecast.currentValue;
        for (const bp of baseProjections) {
          const delta = bp.projectedValue - v0;
          // Apply multiplier to growth
          const acceleratedVal = v0 + (delta > 0 ? delta * mult : delta);
          const margin = (bp.upperBound - bp.projectedValue) * 1.2;

          simulatedProjections.push({
            targetTimestamp: bp.targetTimestamp,
            stepHours: bp.stepHours,
            projectedValue: Math.max(0, Math.round(acceleratedVal * 1000) / 1000),
            lowerBound: Math.max(0, Math.round((acceleratedVal - margin) * 1000) / 1000),
            upperBound: Math.round((acceleratedVal + margin) * 1000) / 1000,
            confidenceInterval: 0.95,
          });
        }
        uncertainty = uncertainty === 'LOW' ? 'MODERATE' : 'HIGH';
        break;
      }

      case 'ATTENUATION': {
        const decayRate = params.attenuationRatePerDay ?? 0.04;
        name = name ?? 'Natural Attenuation / Flow Flush';
        description =
          description ??
          `Natural hydrological flushing or biological decay attenuates indicator at -${Math.round(decayRate * 1000) / 10}% per day.`;
        assumptions.push(
          `Natural attenuation decreases concentration at an estimated rate of ${decayRate}/day.`
        );
        assumptions.push('Assumes cessation of upstream contaminant loading.');

        const v0 = baselineForecast.currentValue;
        const baselineFloor = baselineForecast.historicalBaseline ?? 0.12;

        for (const bp of baseProjections) {
          const days = bp.stepHours / 24;
          // Exponential decay towards baseline floor
          const decayed =
            baselineFloor + (v0 - baselineFloor) * Math.exp(-decayRate * days);
          const margin = (bp.upperBound - bp.projectedValue) * 0.9;

          simulatedProjections.push({
            targetTimestamp: bp.targetTimestamp,
            stepHours: bp.stepHours,
            projectedValue: Math.max(baselineFloor, Math.round(decayed * 1000) / 1000),
            lowerBound: Math.max(baselineFloor, Math.round((decayed - margin) * 1000) / 1000),
            upperBound: Math.round((decayed + margin) * 1000) / 1000,
            confidenceInterval: 0.95,
          });
        }
        break;
      }

      case 'WEATHER_EVENT': {
        const rainMm = params.rainfallIntensityMm ?? 35;
        const runoffCoeff = params.runoffCoefficient ?? 0.6;
        name = name ?? `Weather Event: Heavy Rainfall (${rainMm}mm)`;
        description =
          description ??
          `Convective precipitation event of ${rainMm}mm induces initial runoff spike followed by dilution.`;
        assumptions.push(
          `Precipitation of ${rainMm}mm causes early runoff influx (first 24h) followed by hydraulic dilution.`
        );
        assumptions.push(`Runoff catchment transport coefficient calibrated at ${runoffCoeff}.`);

        const v0 = baselineForecast.currentValue;
        for (const bp of baseProjections) {
          let adjusted = bp.projectedValue;
          if (bp.stepHours <= 24) {
            // Initial runoff spike
            adjusted += (rainMm / 100) * runoffCoeff * 0.15;
          } else {
            // Subsequent dilution flush
            const dilutionFactor = Math.min(0.3, (rainMm / 150) * ((bp.stepHours - 24) / 48));
            adjusted -= adjusted * dilutionFactor;
          }

          const margin = (bp.upperBound - bp.projectedValue) * 1.35; // Weather increases variance
          simulatedProjections.push({
            targetTimestamp: bp.targetTimestamp,
            stepHours: bp.stepHours,
            projectedValue: Math.max(0, Math.round(adjusted * 1000) / 1000),
            lowerBound: Math.max(0, Math.round((adjusted - margin) * 1000) / 1000),
            upperBound: Math.round((adjusted + margin) * 1000) / 1000,
            confidenceInterval: 0.95,
          });
        }
        uncertainty = 'HIGH';
        break;
      }

      case 'OPERATIONAL_INTERVENTION': {
        const efficacyPct = params.interventionEfficacyPercent ?? 40; // 40% reduction
        const lagHours = params.interventionLagHours ?? 12;
        name = name ?? `Operational Intervention (${efficacyPct}% Efficacy)`;
        description =
          description ??
          `Simulated impact of approved Phase 4 mitigation task with ${efficacyPct}% target reduction after ${lagHours}h operational lag.`;
        assumptions.push(
          `Approved mitigation countermeasure achieves ${efficacyPct}% reduction in proxy indicator magnitude.`
        );
        assumptions.push(
          `Operational mobilization and mixing lag estimated at ${lagHours} hours before observable impact.`
        );
        assumptions.push(
          'MANDATORY NOTICE: Modelled hypothetical effect. Real reduction requires Phase 3/4 verification evidence.'
        );

        const v0 = baselineForecast.currentValue;
        const baselineFloor = baselineForecast.historicalBaseline ?? 0.12;

        for (const bp of baseProjections) {
          let val = bp.projectedValue;
          if (bp.stepHours >= lagHours) {
            const elapsedSinceLag = bp.stepHours - lagHours;
            const progress = Math.min(1.0, elapsedSinceLag / 24); // Ramps up over 24h
            const reduction = (val - baselineFloor) * (efficacyPct / 100) * progress;
            val = Math.max(baselineFloor, val - reduction);
          }

          const margin = (bp.upperBound - bp.projectedValue) * 1.1;
          simulatedProjections.push({
            targetTimestamp: bp.targetTimestamp,
            stepHours: bp.stepHours,
            projectedValue: Math.max(baselineFloor, Math.round(val * 1000) / 1000),
            lowerBound: Math.max(baselineFloor, Math.round((val - margin) * 1000) / 1000),
            upperBound: Math.round((val + margin) * 1000) / 1000,
            confidenceInterval: 0.95,
          });
        }
        break;
      }
    }

    return {
      scenarioId: generateId(),
      name,
      type,
      description,
      streamReachId: baselineForecast.reachId,
      reachName: baselineForecast.reachName,
      indicator: baselineForecast.indicator,
      originTimestamp: baselineForecast.originTimestamp,
      horizonHours: baselineForecast.horizonHours,
      baselineForecastId: baselineForecast.id,
      changedParameters: params,
      assumptions,
      projections: simulatedProjections,
      uncertainty,
      confidence: baselineForecast.confidence,
      modelVersion: this.VERSION,
      generatedTimestamp: nowUtc(),
      isHypothetical: true,
      labels: ['SIMULATED', 'HYPOTHETICAL', 'MODELLED_EFFECT'],
    };
  }

  /**
   * Compares baseline forecast against one or more simulated scenarios side by side.
   * Conforms to Phase 6 PRD Section 17.
   */
  public static compare(
    baselineForecast: ForecastResult,
    scenarios: ScenarioSimulation[]
  ): ScenarioComparison {
    const comparisonPoints: ScenarioComparisonPoint[] = [];

    const baseProjections = baselineForecast.projections;

    for (let i = 0; i < baseProjections.length; i++) {
      const bp = baseProjections[i];
      const scenarioValues: Record<string, number> = {};
      const deltas: Record<string, { absolute: number; percent: number }> = {};

      for (const sc of scenarios) {
        const scPoint = sc.projections[i];
        if (scPoint) {
          scenarioValues[sc.name] = scPoint.projectedValue;
          const absDiff = Math.round((scPoint.projectedValue - bp.projectedValue) * 1000) / 1000;
          const pctDiff =
            bp.projectedValue !== 0
              ? Math.round((absDiff / bp.projectedValue) * 1000) / 10
              : 0;
          deltas[sc.name] = { absolute: absDiff, percent: pctDiff };
        }
      }

      comparisonPoints.push({
        stepHours: bp.stepHours,
        targetTimestamp: bp.targetTimestamp,
        baselineValue: bp.projectedValue,
        scenarioValues,
        deltas,
      });
    }

    // Build operational implications from mathematical comparison
    const operationalImplications: string[] = [];
    const lastStep = comparisonPoints[comparisonPoints.length - 1];

    if (lastStep) {
      for (const sc of scenarios) {
        const delta = lastStep.deltas[sc.name];
        if (!delta) continue;

        if (sc.type === 'ACCELERATED_DETERIORATION' && delta.percent > 0) {
          operationalImplications.push(
            `Under ${sc.name}, projected ${baselineForecast.indicator} reaches ${lastStep.scenarioValues[sc.name]} (+${delta.percent}%), which would necessitate immediate preventive field sampling and containment.`
          );
        } else if (sc.type === 'OPERATIONAL_INTERVENTION' && delta.percent < 0) {
          operationalImplications.push(
            `Simulated ${sc.name} achieves a ${Math.abs(delta.percent)}% reduction at ${baselineForecast.horizonHours}h. Note that real observed benefit requires post-intervention field confirmation.`
          );
        } else if (sc.type === 'WEATHER_EVENT') {
          operationalImplications.push(
            `Weather event introduces significant hydrological variance; heightened monitoring required during first 24h runoff window.`
          );
        } else if (sc.type === 'ATTENUATION') {
          operationalImplications.push(
            `Natural attenuation projection shows stabilization toward baseline within ${baselineForecast.horizonHours}h if upstream inputs cease.`
          );
        }
      }
    }

    const summary = `Comparison of ${scenarios.length} scenario(s) against baseline forecast over ${baselineForecast.horizonHours} hours for ${baselineForecast.reachName} (${baselineForecast.indicator}).`;

    return {
      reachId: baselineForecast.reachId,
      reachName: baselineForecast.reachName,
      indicator: baselineForecast.indicator,
      horizonHours: baselineForecast.horizonHours,
      baselineForecast,
      scenarios,
      comparisonPoints,
      summary,
      operationalImplications,
    };
  }
}
