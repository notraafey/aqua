/**
 * AquaSentinel FHIR Integration Boundary Types
 * Based on Main PRD Section 19 and Phase 1 PRD Section 23
 */

export interface FhirCoding {
  system?: string;
  code: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference: string;
  display?: string;
  type?: string;
}

export interface FhirQuantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
}

export interface FhirObservation {
  resourceType: 'Observation';
  id?: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  component?: Array<{
    code: FhirCodeableConcept;
    valueQuantity?: FhirQuantity;
    valueString?: string;
  }>;
  note?: Array<{ text: string }>;
}

export interface FhirIdentifier {
  system?: string;
  value: string;
}

export interface FhirTaskInputOutput {
  type: FhirCodeableConcept;
  valueString?: string;
  valueReference?: FhirReference;
}

export interface FhirTask {
  resourceType: 'Task';
  id?: string;
  identifier?: FhirIdentifier[];
  status: 'draft' | 'requested' | 'received' | 'accepted' | 'rejected' | 'ready' | 'in-progress' | 'completed' | 'cancelled';
  intent: 'order' | 'proposal' | 'plan';
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: FhirCodeableConcept;
  description?: string;
  focus?: FhirReference;
  for?: FhirReference;
  authoredOn?: string;
  lastModified?: string;
  requester?: FhirReference;
  owner?: FhirReference;
  reasonCode?: FhirCodeableConcept;
  note?: Array<{ text: string; time?: string; authorString?: string }>;
  executionPeriod?: {
    start?: string;
    end?: string;
  };
  input?: FhirTaskInputOutput[];
  output?: FhirTaskInputOutput[];
  relevantHistory?: FhirReference[];
}

export interface FhirCommunicationRequest {
  resourceType: 'CommunicationRequest';
  id?: string;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  category?: FhirCodeableConcept[];
  payload?: Array<{ contentString: string }>;
  occurrenceDateTime?: string;
  authoredOn?: string;
  requester?: FhirReference;
  recipient?: FhirReference[];
  about?: FhirReference[];
}

export interface FhirFlag {
  resourceType: 'Flag';
  id?: string;
  status: 'active' | 'inactive' | 'entered-in-error';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface FhirSubscriptionPayload {
  subscription: {
    id: string;
    resourceType: 'Subscription';
  };
  resource?: FhirObservation | Record<string, unknown>;
}
