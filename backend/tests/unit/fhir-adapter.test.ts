import { describe, it, expect } from 'vitest';
import { FhirMapper } from '../../src/adapters/fhir/mapper.js';
import { DemoFhirAdapter } from '../../src/adapters/fhir/demo-adapter.js';
import { Observation, Task, Incident } from '@aquasentinel/shared';
import { generateId, nowUtc, createPoint } from '../../src/domain/value-objects.js';
import { createProvenanceRecord } from '../../src/domain/provenance.js';

describe('FHIR Integration Boundary', () => {
  const sampleObsId = generateId();
  const reachId = generateId();
  const sampleObs: Observation = {
    id: sampleObsId,
    source: 'SATELLITE_SENTINEL2',
    timestamp: nowUtc(),
    location: createPoint(22.75, 39.18),
    streamReachId: reachId,
    indicator: 'NDCI',
    value: 0.58,
    unit: 'ratio',
    quality: 'VALIDATED',
    provenance: createProvenanceRecord({
      entityId: sampleObsId,
      entityType: 'OBSERVATION',
      source: 'SATELLITE_SENTINEL2',
      sourceIdentifier: 'SENTINEL2-TILE-42',
      acquisitionTimestamp: nowUtc(),
      processingMethod: 'NDCI_V1',
    }),
    createdAt: nowUtc(),
  };

  it('maps internal Observation to valid FHIR R4 Observation resource', () => {
    const fhir = FhirMapper.toFhirObservation(sampleObs);

    expect(fhir.resourceType).toBe('Observation');
    expect(fhir.id).toBe(sampleObs.id);
    expect(fhir.code.coding[0].code).toBe('ndci');
    expect(fhir.valueQuantity?.value).toBe(0.58);
    expect(fhir.subject?.reference).toBe(`Location/${reachId}`);
  });

  it('parses FHIR R4 Observation back to internal Observation model', () => {
    const fhir = FhirMapper.toFhirObservation(sampleObs);
    const domain = FhirMapper.fromFhirObservation(fhir);

    expect(domain.indicator).toBe('NDCI');
    expect(domain.value).toBe(0.58);
    expect(domain.streamReachId).toBe(reachId);
    expect(domain.provenance).toBeDefined();
  });

  it('maps Task to valid FHIR Task resource', () => {
    const task: Task = {
      id: generateId(),
      incidentId: generateId(),
      recommendationId: generateId(),
      assignedTo: 'Inspector Davis',
      location: createPoint(22.75, 39.18),
      priority: 'HIGH',
      instructions: 'Collect in-situ water grab samples at bridge crossing',
      status: 'REQUESTED',
      createdAt: nowUtc(),
    };

    const fhirTask = FhirMapper.toFhirTask(task);
    expect(fhirTask.resourceType).toBe('Task');
    expect(fhirTask.priority).toBe('urgent');
    expect(fhirTask.description).toBe(task.instructions);
  });

  it('maps Incident to valid FHIR Flag resource', () => {
    const incident: Incident = {
      id: generateId(),
      streamReachId: reachId,
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
      status: 'ACTION_RECOMMENDED',
      hazardType: 'ALGAL_BLOOM',
      evidenceConfidence: 82,
      severity: 'HIGH',
      verificationStatus: 'PENDING',
    };

    const fhirFlag = FhirMapper.toFhirFlag(incident);
    expect(fhirFlag.resourceType).toBe('Flag');
    expect(fhirFlag.status).toBe('active');
    expect(fhirFlag.code.coding[0].code).toBe('algal_bloom');
  });

  it('DemoFhirAdapter handles publishing and local retrieval seamlessly', async () => {
    const adapter = new DemoFhirAdapter();
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.isMock).toBe(true);

    const publishedId = await adapter.publishObservation(sampleObs);
    expect(publishedId).toBe(sampleObs.id);

    const retrieved = await adapter.fetchObservation(sampleObs.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.indicator).toBe('NDCI');
  });
});
