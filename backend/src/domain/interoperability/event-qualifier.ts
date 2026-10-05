import {
  DomainEvent,
  ObservationReceivedEvent,
  EvidenceUpdatedEvent,
  IncidentCreatedEvent,
  IncidentStateChangedEvent,
  RecommendationReviewedEvent,
  TaskCreatedEvent,
  TaskStatusUpdatedEvent,
  EarlyWarningTriggeredEvent,
  ForecastGeneratedEvent,
  ScenarioSimulatedEvent,
  VerificationCompletedEvent,
  IncidentConfirmedEvent,
  IncidentNotConfirmedEvent,
  IncidentEscalatedEvent,
  IncidentResolvedEvent,
  AdditionalVerificationRequiredEvent,
  InteroperabilityEventType,
} from '@aquasentinel/shared';

export interface EventQualificationResult {
  qualified: boolean;
  externalEventType?: InteroperabilityEventType;
  reason?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  subjectReference?: string;
  correlationId?: string;
  causationId?: string;
}

export class EventQualifier {
  /**
   * Evaluates an internal DomainEvent to determine if it meets the criteria
   * for external interoperability publication.
   * Defined in Phase 7 PRD Section 8.
   */
  static qualify(event: DomainEvent): EventQualificationResult {
    switch (event.eventType) {
      case 'ObservationReceived':
        return this.qualifyObservation(event as ObservationReceivedEvent);

      case 'EvidenceUpdated':
        return this.qualifyEvidence(event as EvidenceUpdatedEvent);

      case 'IncidentCreated':
        return this.qualifyIncidentCreated(event as IncidentCreatedEvent);

      case 'IncidentStateChanged':
        return this.qualifyIncidentStateChanged(event as IncidentStateChangedEvent);

      case 'RecommendationReviewed':
        return this.qualifyRecommendationReviewed(event as RecommendationReviewedEvent);

      case 'TaskCreated':
        return this.qualifyTaskCreated(event as TaskCreatedEvent);

      case 'TaskStatusUpdated':
        return this.qualifyTaskStatusUpdated(event as TaskStatusUpdatedEvent);

      case 'EarlyWarningTriggered':
        return this.qualifyEarlyWarning(event as EarlyWarningTriggeredEvent);

      case 'ForecastGenerated':
        return this.qualifyForecast(event as ForecastGeneratedEvent);

      case 'ScenarioSimulated':
        return this.qualifyScenario(event as ScenarioSimulatedEvent);

      case 'VerificationCompleted':
        return this.qualifyVerificationCompleted(event as VerificationCompletedEvent);

      case 'IncidentConfirmed':
        return this.qualifyIncidentConfirmed(event as IncidentConfirmedEvent);

      case 'IncidentNotConfirmed':
        return this.qualifyIncidentNotConfirmed(event as IncidentNotConfirmedEvent);

      case 'IncidentEscalated':
        return this.qualifyIncidentEscalated(event as IncidentEscalatedEvent);

      case 'IncidentResolved':
        return this.qualifyIncidentResolved(event as IncidentResolvedEvent);

      case 'AdditionalVerificationRequired':
        return this.qualifyAdditionalVerificationRequired(event as AdditionalVerificationRequiredEvent);

      default:
        return { qualified: false, reason: 'Event type not registered for external publication' };
    }
  }

  private static qualifyObservation(event: ObservationReceivedEvent): EventQualificationResult {
    const obs = event.payload.observation;
    const numVal = typeof obs.value === 'number' ? obs.value : parseFloat(String(obs.value));

    // 1. Quality flag check
    if (obs.quality === 'FLAGGED') {
      return {
        qualified: true,
        externalEventType: 'ObservationCreated',
        reason: `Quality control flagged anomalous observation: ${obs.indicator}`,
        severity: 'MEDIUM',
        subjectReference: `Location/${obs.streamReachId || 'unknown'}`,
        correlationId: obs.id,
        causationId: obs.provenance?.sourceIdentifier || obs.id,
      };
    }

    // 2. Physical / Optical threshold checks
    const indicator = String(obs.indicator).toUpperCase();
    let isAnomalous = false;
    let rationale = '';

    if (indicator === 'NDCI' && !isNaN(numVal) && numVal > 0.15) {
      isAnomalous = true;
      rationale = `Elevated chlorophyll-related optical remote-sensing proxy (NDCI: ${numVal.toFixed(3)} > 0.15)`;
    } else if (indicator === 'DISSOLVED_OXYGEN' && !isNaN(numVal) && numVal < 6.0) {
      isAnomalous = true;
      rationale = `Depressed dissolved oxygen below aquatic threshold (${numVal.toFixed(1)} mg/L < 6.0 mg/L)`;
    } else if (indicator === 'WATER_TEMPERATURE' && !isNaN(numVal) && numVal > 22.0) {
      isAnomalous = true;
      rationale = `Elevated water temperature promoting microbial/algal kinetics (${numVal.toFixed(1)}°C > 22.0°C)`;
    } else if (indicator === 'TURBIDITY' && !isNaN(numVal) && numVal > 40.0) {
      isAnomalous = true;
      rationale = `Elevated turbidity plume detected (${numVal.toFixed(1)} NTU > 40.0 NTU)`;
    } else if (['WATER_COLOR', 'ODOR', 'FOAM', 'DEAD_FISH'].includes(indicator)) {
      isAnomalous = true;
      rationale = `Citizen science qualitative report of environmental anomaly: ${indicator}`;
    }

    if (isAnomalous) {
      return {
        qualified: true,
        externalEventType: 'ObservationCreated',
        reason: rationale,
        severity: numVal > 0.28 ? 'HIGH' : 'MEDIUM',
        subjectReference: `Location/${obs.streamReachId || 'unknown'}`,
        correlationId: obs.id,
        causationId: obs.provenance?.sourceIdentifier || obs.id,
      };
    }

    // Baseline routine observation stays internal
    return {
      qualified: false,
      reason: 'Routine baseline observation within standard physical bounds (internal only)',
    };
  }

  private static qualifyEvidence(event: EvidenceUpdatedEvent): EventQualificationResult {
    const assessment = event.payload.assessment;
    const score = assessment.score || 0;
    const isElevated = score >= 50 || ['INVESTIGATE', 'PRIORITIZE', 'HIGH'].includes(assessment.confidenceBand);

    // Elevated score or prioritized confidence qualifies for external notification
    if (isElevated) {
      return {
        qualified: true,
        externalEventType: 'EvidenceAssessmentUpdated',
        reason: `Synthesized multi-source evidence update (Score: ${score.toFixed(0)}/100, Band: ${assessment.confidenceBand}, Reach: ${event.payload.streamReachId})`,
        severity: score >= 75 ? 'HIGH' : 'MEDIUM',
        subjectReference: `Location/${event.payload.streamReachId}`,
        correlationId: event.payload.incidentId || assessment.id,
        causationId: event.payload.triggerObservationId || assessment.id,
      };
    }

    return {
      qualified: false,
      reason: 'Preliminary low-confidence evidence update (internal only)',
    };
  }

  private static qualifyIncidentCreated(event: IncidentCreatedEvent): EventQualificationResult {
    const inc = event.payload.incident;
    const severityMap: Record<string, EventQualificationResult['severity']> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL',
    };

    return {
      qualified: true,
      externalEventType: 'IncidentCreated',
      reason: `Classified environmental hazard incident: ${inc.hazardType} (Severity: ${inc.severity})`,
      severity: severityMap[inc.severity] || 'HIGH',
      subjectReference: `Location/${inc.streamReachId}`,
      correlationId: inc.id,
      causationId: inc.id,
    };
  }

  private static qualifyIncidentStateChanged(event: IncidentStateChangedEvent): EventQualificationResult {
    const { incidentId, previousStatus, newStatus, reason } = event.payload;

    return {
      qualified: true,
      externalEventType: 'IncidentSeverityChanged',
      reason: `Incident ${incidentId} status transition: ${previousStatus} -> ${newStatus}${reason ? ` (${reason})` : ''}`,
      severity: newStatus === 'RESOLVED' ? 'LOW' : 'HIGH',
      subjectReference: `Incident/${incidentId}`,
      correlationId: incidentId,
      causationId: event.eventId,
    };
  }

  private static qualifyRecommendationReviewed(event: RecommendationReviewedEvent): EventQualificationResult {
    // Only approved recommendations trigger external operational publication
    if (event.payload.action === 'APPROVED') {
      return {
        qualified: true,
        externalEventType: 'RecommendationApproved',
        reason: `Human operator (${event.payload.actor}) approved operational response recommendation ${event.payload.recommendationId}`,
        severity: 'HIGH',
        subjectReference: `Incident/${event.payload.incidentId}`,
        correlationId: event.payload.incidentId,
        causationId: event.payload.recommendationId,
      };
    }

    return {
      qualified: false,
      reason: `Recommendation action '${event.payload.action}' remains internal supervisory workflow`,
    };
  }

  private static qualifyTaskCreated(event: TaskCreatedEvent): EventQualificationResult {
    const task = event.payload.task;
    return {
      qualified: true,
      externalEventType: 'TaskCreated',
      reason: `Operational intervention task dispatched: ${task.taskType || 'TASK'} - ${task.instructions}`,
      severity: task.priority === 'URGENT' ? 'URGENT' : task.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
      subjectReference: `Incident/${task.incidentId}`,
      correlationId: task.incidentId,
      causationId: task.recommendationId || task.id,
    };
  }

  private static qualifyTaskStatusUpdated(event: TaskStatusUpdatedEvent): EventQualificationResult {
    const { taskId, incidentId, newStatus, previousStatus } = event.payload;

    if (newStatus === 'COMPLETED' || newStatus === 'VERIFIED') {
      return {
        qualified: true,
        externalEventType: 'TaskCompleted',
        reason: `Operational task ${taskId} reached completion status '${newStatus}' (was ${previousStatus})`,
        severity: 'LOW',
        subjectReference: `Incident/${incidentId}`,
        correlationId: incidentId,
        causationId: taskId,
      };
    }

    return {
      qualified: false,
      reason: `Intermediate task status transition '${newStatus}' remains internal`,
    };
  }

  private static qualifyEarlyWarning(event: EarlyWarningTriggeredEvent): EventQualificationResult {
    const w = event.payload.earlyWarning;
    return {
      qualified: true,
      externalEventType: 'EarlyWarningCreated',
      reason: `Predictive early warning: [${w.warningLevel}] ${w.triggerReason}`,
      severity: w.warningLevel === 'WARNING' ? 'HIGH' : w.warningLevel === 'ADVISORY' ? 'MEDIUM' : 'LOW',
      subjectReference: `Location/${w.streamReachId}`,
      correlationId: w.id,
      causationId: w.evidenceAssessmentId || w.id,
    };
  }

  private static qualifyForecast(event: ForecastGeneratedEvent): EventQualificationResult {
    const f = event.payload.forecast;
    const maxVal = Math.max(...f.projections.map((p) => p.projectedValue));

    if (maxVal > 0.20 || f.projections.some((p) => p.upperBound > 0.25)) {
      return {
        qualified: true,
        externalEventType: 'ForecastUpdated',
        reason: `Predictive short-horizon forecast (${f.modelId}) indicates escalating proxy trend reaching peak ${maxVal.toFixed(3)}`,
        severity: maxVal > 0.28 ? 'HIGH' : 'MEDIUM',
        subjectReference: `Location/${f.reachId}`,
        correlationId: f.id,
        causationId: f.originTimestamp,
      };
    }

    return {
      qualified: false,
      reason: 'Routine projection within non-escalating bounds (internal only)',
    };
  }

  private static qualifyScenario(event: ScenarioSimulatedEvent): EventQualificationResult {
    const sim = event.payload.simulation;
    return {
      qualified: true,
      externalEventType: 'ScenarioCompleted',
      reason: `Counterfactual scenario simulated: ${sim.type} (${sim.name}) on reach ${sim.streamReachId}`,
      severity: 'LOW',
      subjectReference: `Location/${sim.streamReachId}`,
      correlationId: sim.scenarioId,
      causationId: sim.baselineForecastId,
    };
  }

  private static qualifyVerificationCompleted(event: VerificationCompletedEvent): EventQualificationResult {
    const { verification, incidentId } = event.payload;
    return {
      qualified: true,
      externalEventType: 'VerificationCompleted',
      reason: `Ground truth field verification completed: status '${verification.status}'. Observations: ${verification.observations?.waterColour || 'recorded'}`,
      severity: verification.status === 'CONFIRMED' ? 'HIGH' : verification.status === 'NOT_CONFIRMED' ? 'LOW' : 'MEDIUM',
      subjectReference: `Incident/${incidentId}`,
      correlationId: incidentId,
      causationId: verification.id,
    };
  }

  private static qualifyIncidentConfirmed(event: IncidentConfirmedEvent): EventQualificationResult {
    const { incidentId, verificationId, confidence, reason } = event.payload;
    return {
      qualified: true,
      externalEventType: 'IncidentConfirmed',
      reason: `Incident confirmed following verified ground observations: ${reason}`,
      severity: confidence >= 80 ? 'HIGH' : 'MEDIUM',
      subjectReference: `Incident/${incidentId}`,
      correlationId: incidentId,
      causationId: verificationId,
    };
  }

  private static qualifyIncidentNotConfirmed(event: IncidentNotConfirmedEvent): EventQualificationResult {
    const { incidentId, verificationId, reason } = event.payload;
    return {
      qualified: true,
      externalEventType: 'IncidentNotConfirmed',
      reason: `Field ground truth refuted optical proxy alert: ${reason}`,
      severity: 'LOW',
      subjectReference: `Incident/${incidentId}`,
      correlationId: incidentId,
      causationId: verificationId,
    };
  }

  private static qualifyIncidentEscalated(event: IncidentEscalatedEvent): EventQualificationResult {
    const { incidentId, newSeverity, reason } = event.payload;
    return {
      qualified: true,
      externalEventType: 'IncidentEscalated',
      reason: `Operational escalation to ${newSeverity}: ${reason}`,
      severity: 'CRITICAL',
      subjectReference: `Incident/${incidentId}`,
      correlationId: incidentId,
      causationId: incidentId,
    };
  }

  private static qualifyIncidentResolved(event: IncidentResolvedEvent): EventQualificationResult {
    const { incidentId, resolution } = event.payload;
    return {
      qualified: true,
      externalEventType: 'IncidentResolved',
      reason: `Incident officially resolved: ${resolution}`,
      severity: 'LOW',
      subjectReference: `Incident/${incidentId}`,
      correlationId: incidentId,
      causationId: incidentId,
    };
  }

  private static qualifyAdditionalVerificationRequired(event: AdditionalVerificationRequiredEvent): EventQualificationResult {
    const { incidentId, verificationId, reason } = event.payload;
    return {
      qualified: true,
      externalEventType: 'AdditionalVerificationRequired',
      reason: `Inconclusive evidence requires secondary ground verification: ${reason}`,
      severity: 'MEDIUM',
      subjectReference: `Incident/${incidentId}`,
      correlationId: incidentId,
      causationId: verificationId || incidentId,
    };
  }
}
