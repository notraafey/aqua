import { describe, it, expect } from 'vitest';
import { FhirMapper } from '../../src/adapters/fhir/mapper.js';
import { Task } from '@aquasentinel/shared';

describe('FHIR R4 Task Mapper Unit Tests (Phase 4 Standards Interoperability)', () => {
  const baseTask: Task = {
    id: 'task-fhir-123',
    incidentId: 'inc-456',
    recommendationId: 'rec-789',
    assessmentId: 'eval-101',
    taskType: 'FIELD_INVESTIGATION',
    title: 'Deploy rapid water grab sampling team',
    assignedRole: 'ENVIRONMENTAL_INSPECTOR',
    assignedTo: 'Inspector Alex Rivera',
    location: {
      type: 'Point',
      coordinates: [25.132, 35.338],
    },
    priority: 'URGENT',
    status: 'REQUESTED',
    instructions: 'Collect three grab samples at upstream culvert and record dissolved oxygen in situ.',
    requiredEvidence: ['Dissolved oxygen log', 'Laboratory chain of custody document'],
    createdAt: '2026-09-17T14:00:00.000Z',
  };

  it('maps Task entity to conformant HL7 FHIR R4 Task resource', () => {
    const fhir = FhirMapper.toFhirTask(baseTask);

    expect(fhir.resourceType).toBe('Task');
    expect(fhir.id).toBe(baseTask.id);
    expect(fhir.status).toBe('requested');
    expect(fhir.priority).toBe('stat');
    expect(fhir.description).toBe(baseTask.instructions);

    // Reason & Context references
    expect(fhir.for?.reference).toBe(`Location/${baseTask.location.coordinates.join(',')}`);
    expect(fhir.focus?.reference).toBe(`Flag/${baseTask.incidentId}`);
    expect(fhir.reasonCode?.text).toContain(baseTask.incidentId);
    expect(fhir.owner?.display).toContain(baseTask.assignedTo);

    // Input provenance items
    expect(fhir.input).toBeDefined();
    expect(fhir.input?.length).toBeGreaterThanOrEqual(2);

    const assessmentInput = fhir.input?.find((i) => i.valueReference?.reference.includes('EvidenceAssessment'));
    expect(assessmentInput).toBeDefined();

    const recInput = fhir.input?.find((i) => i.valueReference?.reference.includes('Recommendation'));
    expect(recInput).toBeDefined();
  });

  it('maps lifecycle statuses to FHIR R4 task statuses accurately', () => {
    const statuses: Array<[Task['status'], string]> = [
      ['REQUESTED', 'requested'],
      ['ACCEPTED', 'accepted'],
      ['IN_PROGRESS', 'in-progress'],
      ['COMPLETED', 'completed'],
      ['VERIFIED', 'completed'],
      ['CANCELLED', 'cancelled'],
    ];

    for (const [taskStatus, expectedFhirStatus] of statuses) {
      const task: Task = { ...baseTask, status: taskStatus };
      const fhir = FhirMapper.toFhirTask(task);
      expect(fhir.status).toBe(expectedFhirStatus);
    }
  });
});
