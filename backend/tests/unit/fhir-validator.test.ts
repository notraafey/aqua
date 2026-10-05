import { describe, it, expect } from 'vitest';
import { FhirValidator, FhirValidationError } from '../../src/adapters/fhir/validator.js';

describe('FhirValidator Unit Tests (Phase 7)', () => {
  it('validates compliant FHIR R4 Observation', () => {
    const validObservation = {
      resourceType: 'Observation',
      id: 'obs-fhir-101',
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://aquasentinel.eu/fhir/indicators',
            code: 'NDCI',
            display: 'Normalized Difference Chlorophyll Index',
          },
        ],
        text: 'Optical chlorophyll remote-sensing proxy',
      },
      subject: {
        reference: 'Location/krafsidonas-1',
        display: 'Krafsidonas Upper Stream',
      },
      effectiveDateTime: '2026-09-19T09:30:00Z',
      valueQuantity: {
        value: 0.312,
        unit: 'index',
        system: 'http://unitsofmeasure.org',
        code: '{index}',
      },
    };

    const result = FhirValidator.validate(validObservation);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.operationOutcome).toBeUndefined();
  });

  it('rejects Observation missing required fields and generates OperationOutcome', () => {
    const invalidObservation = {
      resourceType: 'Observation',
      // Missing id, status, code, subject
    };

    const result = FhirValidator.validate(invalidObservation);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.operationOutcome).toBeDefined();
    expect(result.operationOutcome?.resourceType).toBe('OperationOutcome');
    expect(result.operationOutcome?.issue[0].severity).toBe('error');
  });

  it('validates compliant FHIR R4 Flag', () => {
    const validFlag = {
      resourceType: 'Flag',
      id: 'flag-101',
      status: 'active',
      code: {
        coding: [
          {
            system: 'http://aquasentinel.eu/fhir/hazard-types',
            code: 'ALGAL_BLOOM',
            display: 'Algal Bloom Hazard',
          },
        ],
      },
      subject: {
        reference: 'Location/krafsidonas-1',
      },
    };

    const result = FhirValidator.validate(validFlag);
    expect(result.valid).toBe(true);
  });

  it('rejects Flag with invalid status', () => {
    const invalidFlag = {
      resourceType: 'Flag',
      id: 'flag-101',
      status: 'unknown_status_code',
      code: { text: 'Alert' },
      subject: { reference: 'Location/1' },
    };

    const result = FhirValidator.validate(invalidFlag);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.details.includes('status'))).toBe(true);
  });

  it('validates compliant FHIR R4 Task', () => {
    const validTask = {
      resourceType: 'Task',
      id: 'task-101',
      status: 'requested',
      intent: 'order',
      priority: 'urgent',
      code: {
        coding: [
          {
            system: 'http://aquasentinel.eu/fhir/task-types',
            code: 'FIELD_VERIFY',
            display: 'Field verification and sampling',
          },
        ],
      },
      description: 'Collect water sample at bridge',
      for: {
        reference: 'Location/krafsidonas-1',
      },
    };

    const result = FhirValidator.validate(validTask);
    expect(result.valid).toBe(true);
  });

  it('rejects Task with missing intent or invalid status', () => {
    const invalidTask = {
      resourceType: 'Task',
      id: 'task-101',
      status: 'not_a_fhir_status',
    };

    const result = FhirValidator.validate(invalidTask);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('validates compliant FHIR R4 Subscription', () => {
    const validSub = {
      resourceType: 'Subscription',
      id: 'sub-101',
      status: 'active',
      reason: 'Forward water security alerts to public health portal',
      criteria: 'Flag?status=active',
      channel: {
        type: 'rest-hook',
        endpoint: 'http://localhost:3002/webhook/fhir',
        payload: 'application/fhir+json',
      },
    };

    const result = FhirValidator.validate(validSub);
    expect(result.valid).toBe(true);
  });

  it('throws FhirValidationError on validateOrThrow with malformed resource', () => {
    const malformed = {
      somethingElse: true,
    };

    expect(() => FhirValidator.validateOrThrow(malformed)).toThrow(FhirValidationError);
    try {
      FhirValidator.validateOrThrow(malformed);
    } catch (e: any) {
      expect(e.operationOutcome).toBeDefined();
      expect(e.operationOutcome.resourceType).toBe('OperationOutcome');
    }
  });
});
