import { describe, it, expect } from 'vitest';
import { EventQualifier } from '../../src/domain/interoperability/event-qualifier.js';
import { Observation, Incident, Task, EarlyWarning, EvidenceAssessment } from '@aquasentinel/shared';
import { InteroperabilityService } from '../../src/services/interoperability/interoperability-service.js';

describe('EventQualifier Unit Tests (Phase 7)', () => {
  it('disqualifies normal baseline observations', () => {
    const normalObs: Observation = {
      id: 'obs-norm-1',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.12, // Normal baseline
      timestamp: new Date().toISOString(),
      location: { type: 'Point', coordinates: [22.94, 39.37] },
      streamReachId: 'reach-1',
      createdAt: new Date().toISOString(),
    };

    const result = EventQualifier.qualify({
      eventId: 'evt-norm-1',
      eventType: 'ObservationReceived',
      timestamp: new Date().toISOString(),
      actor: 'copernicus-satellite',
      payload: { observation: normalObs },
    });

    expect(result.qualified).toBe(false);
  });

  it('qualifies anomalous Sentinel-2 NDCI observations (>= 0.28 threshold)', () => {
    const anomalyObs: Observation = {
      id: 'obs-anom-1',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.35, // High anomaly
      timestamp: new Date().toISOString(),
      location: { type: 'Point', coordinates: [22.94, 39.37] },
      streamReachId: 'reach-1',
      quality: 'FLAGGED',
      createdAt: new Date().toISOString(),
    };

    const result = EventQualifier.qualify({
      eventId: 'evt-anom-1',
      eventType: 'ObservationReceived',
      timestamp: new Date().toISOString(),
      actor: 'copernicus-satellite',
      payload: { observation: anomalyObs },
    });

    expect(result.qualified).toBe(true);
    expect(result.externalEventType).toBe('ObservationCreated');
    expect(result.subjectReference).toBe('Location/reach-1');
  });

  it('qualifies significant incidents (DETECTED status with HIGH severity)', () => {
    const incident: Incident = {
      id: 'inc-101',
      streamReachId: 'reach-volos-krafsidonas',
      status: 'DETECTED',
      hazardType: 'ALGAL_BLOOM',
      severity: 'HIGH',
      evidenceConfidence: 88,
      verificationStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = EventQualifier.qualify({
      eventId: 'evt-inc-1',
      eventType: 'IncidentCreated',
      timestamp: new Date().toISOString(),
      actor: 'aquasentinel-decision-engine',
      payload: { incident },
    });

    expect(result.qualified).toBe(true);
    expect(result.externalEventType).toBe('IncidentCreated');
    expect(result.correlationId).toBe('inc-101');
  });

  it('disqualifies low-confidence evidence assessments and qualifies actionable ones', () => {
    const lowConf: EvidenceAssessment = {
      id: 'ea-low',
      incidentId: 'inc-101',
      score: 45,
      confidenceBand: 'MONITOR',
      summary: 'Insufficient corroborating signals',
      timestamp: new Date().toISOString(),
      factors: [],
    };

    const highConf: EvidenceAssessment = {
      id: 'ea-high',
      incidentId: 'inc-101',
      score: 85,
      confidenceBand: 'PRIORITIZE',
      summary: 'Multi-sensor convergence confirmed',
      timestamp: new Date().toISOString(),
      factors: [],
    };

    const lowResult = EventQualifier.qualify({
      eventId: 'evt-ea-low',
      eventType: 'EvidenceUpdated',
      timestamp: new Date().toISOString(),
      actor: 'evidence-fusion',
      payload: { assessment: lowConf },
    });
    expect(lowResult.qualified).toBe(false);

    const highResult = EventQualifier.qualify({
      eventId: 'evt-ea-high',
      eventType: 'EvidenceUpdated',
      timestamp: new Date().toISOString(),
      actor: 'evidence-fusion',
      payload: { assessment: highConf },
    });
    expect(highResult.qualified).toBe(true);
    expect(highResult.externalEventType).toBe('EvidenceAssessmentUpdated');
  });

  it('qualifies urgent early warnings', () => {
    const warning: EarlyWarning = {
      id: 'ew-1',
      streamReachId: 'reach-1',
      reachName: 'Krafsidonas River',
      indicator: 'NDCI',
      warningLevel: 'WARNING',
      triggerReason: 'High NDCI optical proxy',
      contributingFactors: ['Temp > 24C', 'Low flow'],
      confidence: 'HIGH',
      recommendedAction: 'Dispatch field inspection crew',
      timestamp: new Date().toISOString(),
      incidentId: 'inc-101',
      labels: ['EARLY_WARNING'],
    };

    const result = EventQualifier.qualify({
      eventId: 'evt-ew-1',
      eventType: 'EarlyWarningTriggered',
      timestamp: new Date().toISOString(),
      actor: 'early-warning-engine',
      payload: { earlyWarning: warning },
    });

    expect(result.qualified).toBe(true);
    expect(result.externalEventType).toBe('EarlyWarningCreated');
  });

  it('qualifies operational response tasks', () => {
    const task: Task = {
      id: 'task-inspect-1',
      incidentId: 'inc-101',
      location: { type: 'Point', coordinates: [22.94, 39.37] },
      taskType: 'FIELD_VERIFY',
      title: 'Emergency Sampling',
      instructions: 'Collect water sample at bridge',
      priority: 'URGENT',
      assignedTo: 'Volos Inspection Team',
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
    };

    const result = EventQualifier.qualify({
      eventId: 'evt-task-1',
      eventType: 'TaskCreated',
      timestamp: new Date().toISOString(),
      actor: 'human-supervisor',
      payload: { task },
    });

    expect(result.qualified).toBe(true);
    expect(result.externalEventType).toBe('TaskCreated');
  });
});
