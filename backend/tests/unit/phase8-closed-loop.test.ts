import { describe, it, expect, beforeEach } from 'vitest';
import { GeofenceValidator } from '../../src/domain/response/geofence.js';
import { OutcomeEngine } from '../../src/domain/response/outcome-engine.js';
import {
  Incident,
  Verification,
  EvidenceAssessment,
  GeoJsonPoint,
  StructuredFieldObservations,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';
import { ValidationError } from '../../src/api/middleware/error-handler.js';
import { getRepositories } from '../../src/database/repositories/index.js';
import { getOperationalResponseService } from '../../src/services/response/operational-response-service.js';

describe('Phase 8: Closed-Loop Field Response Unit Tests', () => {
  describe('GeofenceValidator', () => {
    // Reference point: Athens center [23.7275, 37.9838]
    const expectedLocation: GeoJsonPoint = {
      type: 'Point',
      coordinates: [23.7275, 37.9838],
    };

    it('validates location AT_LOCATION when distance is <= 50m', () => {
      // Very close (~15m offset in latitude: ~0.00013 deg is ~14.4m)
      const nearbyLocation: GeoJsonPoint = {
        type: 'Point',
        coordinates: [23.7275, 37.98393],
      };

      const result = GeofenceValidator.validate(nearbyLocation, expectedLocation);
      expect(result.status).toBe('AT_LOCATION');
      expect(result.isWithinGeofence).toBe(true);
      expect(result.distanceMeters).toBeLessThanOrEqual(50);
    });

    it('validates location NEAR_LOCATION when distance is between 50m and 250m', () => {
      // Offset by ~150m (approx 0.0013 deg latitude)
      const nearLocation: GeoJsonPoint = {
        type: 'Point',
        coordinates: [23.7275, 37.9851],
      };

      const result = GeofenceValidator.validate(nearLocation, expectedLocation);
      expect(result.status).toBe('NEAR_LOCATION');
      expect(result.isWithinGeofence).toBe(true);
      expect(result.distanceMeters).toBeGreaterThan(50);
      expect(result.distanceMeters).toBeLessThanOrEqual(250);
    });

    it('validates location OUTSIDE_EXPECTED_AREA when distance is > 250m', () => {
      // Offset by ~1000m (approx 0.009 deg latitude)
      const farLocation: GeoJsonPoint = {
        type: 'Point',
        coordinates: [23.7275, 37.993],
      };

      const result = GeofenceValidator.validate(farLocation, expectedLocation);
      expect(result.status).toBe('OUTSIDE_EXPECTED_AREA');
      expect(result.isWithinGeofence).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(250);
    });

    it('respects custom threshold override', () => {
      const farLocation: GeoJsonPoint = {
        type: 'Point',
        coordinates: [23.7275, 37.986], // ~240m away
      };

      // With default 250m, it's NEAR_LOCATION
      const defResult = GeofenceValidator.validate(farLocation, expectedLocation);
      expect(defResult.isWithinGeofence).toBe(true);

      // With custom threshold 100m, it's OUTSIDE_EXPECTED_AREA
      const customResult = GeofenceValidator.validate(farLocation, expectedLocation, 100);
      expect(customResult.status).toBe('OUTSIDE_EXPECTED_AREA');
      expect(customResult.isWithinGeofence).toBe(false);
    });
  });

  describe('OutcomeEngine', () => {
    const mockIncident: Incident = {
      id: 'inc-test-1',
      streamReachId: 'reach-1',
      severity: 'HIGH',
      status: 'FIELD_VERIFICATION_PENDING',
      hazardType: 'ALGAL_BLOOM',
      evidenceConfidence: 80,
      verificationStatus: 'PENDING',
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    };

    const baseAssessment: EvidenceAssessment = {
      id: 'ea-test-1',
      streamReachId: 'reach-1',
      candidateId: 'inc-test-1',
      score: 82,
      confidenceBand: 'HIGH',
      supportingEvidence: [],
      contradictingEvidence: [],
      missingDimensions: [],
      assessedAt: nowUtc(),
    };

    it('proposes ESCALATE when severe dead fish mortality is observed with high confidence', () => {
      const verification: Verification = {
        id: 'ver-1',
        taskId: 'task-1',
        incidentId: 'inc-test-1',
        inspector: { name: 'Alex Rivera' } as any,
        timestamp: nowUtc(),
        location: { type: 'Point', coordinates: [23.7275, 37.9838] } as any,
        status: 'CONFIRMED',
        observations: {
          waterColour: 'DARK_GREEN',
          deadFish: 12, // severe mortality > 5
        },
        notes: 'Severe fish kill detected',
        evidence: { photos: [], samples: [] },
        syncStatus: 'SYNCED',
        conflictStatus: 'NONE',
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      };

      const outcome = OutcomeEngine.evaluate({
        incident: mockIncident,
        verification,
        assessment: baseAssessment,
      });

      expect(outcome.proposedOutcome).toBe('ESCALATE');
      expect(outcome.reason).toContain('fish mortality');
      expect(outcome.ruleVersion).toBe('OUTCOME_RULE_V1');
    });

    it('proposes NOT_CONFIRMED when field inspection finds no contamination (false alarm)', () => {
      const verification: Verification = {
        id: 'ver-2',
        taskId: 'task-2',
        incidentId: 'inc-test-1',
        inspector: { name: 'Elena Vasquez' } as any,
        timestamp: nowUtc(),
        location: { type: 'Point', coordinates: [23.7275, 37.9838] } as any,
        status: 'NOT_CONFIRMED',
        observations: {
          waterColour: 'CLEAR',
          surfaceAppearance: 'CLEAR',
          foam: false,
          visibleAlgae: false,
          deadFish: 0,
        },
        notes: 'Clear water, false alarm',
        evidence: { photos: [], samples: [] },
        syncStatus: 'SYNCED',
        conflictStatus: 'NONE',
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      };

      const outcome = OutcomeEngine.evaluate({
        incident: mockIncident,
        verification,
        assessment: {
          ...baseAssessment,
          score: 30,
          confidenceBand: 'LOW',
        },
      });

      expect(outcome.proposedOutcome).toBe('NOT_CONFIRMED');
      expect(outcome.reason).toContain('false positive');
    });

    it('proposes CONFIRMED when field inspection confirms anomaly with good confidence', () => {
      const verification: Verification = {
        id: 'ver-3',
        taskId: 'task-3',
        incidentId: 'inc-test-1',
        inspector: { name: 'Alex Rivera' } as any,
        timestamp: nowUtc(),
        location: { type: 'Point', coordinates: [23.7275, 37.9838] } as any,
        status: 'CONFIRMED',
        observations: {
          waterColour: 'GREEN_FOAM',
          visibleAlgae: true,
          foam: true,
          deadFish: 0,
        },
        notes: 'Confirmed algal bloom present',
        evidence: { photos: [], samples: [] },
        syncStatus: 'SYNCED',
        conflictStatus: 'NONE',
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      };

      const outcome = OutcomeEngine.evaluate({
        incident: mockIncident,
        verification,
        assessment: baseAssessment,
      });

      expect(outcome.proposedOutcome).toBe('CONFIRMED');
      expect(outcome.reason).toContain('confirmed physical ground presence');
    });

    it('proposes ADDITIONAL_VERIFICATION_REQUIRED when verification is UNCERTAIN or requires follow-up', () => {
      const verification: Verification = {
        id: 'ver-4',
        taskId: 'task-4',
        incidentId: 'inc-test-1',
        inspector: { name: 'Nikos Katsaros' } as any,
        timestamp: nowUtc(),
        location: { type: 'Point', coordinates: [23.7275, 37.9838] } as any,
        status: 'UNCERTAIN',
        observations: {
          waterColour: 'BROWN',
          debris: 'LIGHT',
        },
        notes: 'Ambiguous stormwater runoff',
        evidence: { photos: [], samples: [] },
        syncStatus: 'SYNCED',
        conflictStatus: 'NONE',
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      };

      const outcome = OutcomeEngine.evaluate({
        incident: mockIncident,
        verification,
        assessment: {
          ...baseAssessment,
          confidenceBand: 'LOW',
          score: 45,
        },
      });

      expect(outcome.proposedOutcome).toBe('ADDITIONAL_VERIFICATION_REQUIRED');
      expect(outcome.reason).toContain('ambiguous or inconclusive');
    });
  });

  describe('OperationalResponseService Task State Transitions', () => {
    it('validates allowed task transitions and rejects invalid state jumps', async () => {
      const service = getOperationalResponseService();
      const repos = getRepositories();

      const task = await repos.tasks.create({
        id: generateId(),
        incidentId: 'inc-state-test',
        taskType: 'FIELD_INSPECTION' as any,
        title: 'State machine test task',
        assignedTo: 'Tester',
        location: { type: 'Point', coordinates: [23.7275, 37.9838] },
        priority: 'MEDIUM',
        instructions: 'Test state machine transitions',
        status: 'DRAFT',
        createdAt: nowUtc(),
      });

      // Valid: REQUESTED -> APPROVED
      const approved = await service.transitionTaskStatus(task.id, 'APPROVED', 'Supervisor');
      expect(approved.status).toBe('APPROVED');

      // Valid: APPROVED -> ASSIGNED
      const assigned = await service.transitionTaskStatus(task.id, 'ASSIGNED', 'Supervisor');
      expect(assigned.status).toBe('ASSIGNED');

      // Valid: ASSIGNED -> ACCEPTED
      const accepted = await service.transitionTaskStatus(task.id, 'ACCEPTED', 'Inspector');
      expect(accepted.status).toBe('ACCEPTED');

      // Valid: ACCEPTED -> IN_PROGRESS
      const inProgress = await service.transitionTaskStatus(task.id, 'IN_PROGRESS', 'Inspector');
      expect(inProgress.status).toBe('IN_PROGRESS');

      // Invalid: IN_PROGRESS -> REQUESTED should fail
      await expect(
        service.transitionTaskStatus(task.id, 'REQUESTED', 'Inspector')
      ).rejects.toThrow();
    });
  });
});
