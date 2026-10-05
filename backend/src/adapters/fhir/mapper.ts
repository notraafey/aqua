import {
  Observation,
  Task,
  Recommendation,
  Incident,
  FhirObservation,
  FhirTask,
  FhirFlag,
  ObservationSource,
  ObservationIndicator,
  EarlyWarning,
  ForecastResult,
  Verification,
  VerificationLocation,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { createProvenanceRecord } from '../../domain/provenance.js';

export class FhirMapper {
  static toFhirObservation(obs: Observation): FhirObservation {
    const isNumeric = typeof obs.value === 'number' || !isNaN(Number(obs.value));
    return {
      resourceType: 'Observation',
      id: obs.id,
      status: obs.quality === 'REJECTED' ? 'amended' : 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'activity',
              display: 'Environmental Monitoring',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'https://oneaquahealth.eu/fhir/indicators',
            code: String(obs.indicator).toLowerCase(),
            display: String(obs.indicator),
          },
        ],
        text: String(obs.indicator),
      },
      subject: {
        reference: `Location/${obs.streamReachId}`,
        display: `StreamReach ${obs.streamReachId}`,
      },
      effectiveDateTime: obs.timestamp,
      ...(isNumeric
        ? {
            valueQuantity: {
              value: Number(obs.value),
              unit: obs.unit,
              system: 'http://unitsofmeasure.org',
              code: obs.unit,
            },
          }
        : {
            valueString: String(obs.value),
          }),
      note: [
        {
          text: `AquaSentinel Source: ${obs.source}; ProvenanceId: ${obs.provenance.id}`,
        },
      ],
    };
  }

  static fromFhirObservation(fhir: FhirObservation): Observation {
    const id = fhir.id || generateId();
    const coding = fhir.code?.coding?.[0];
    const indicator = (coding?.code?.toUpperCase() || 'UNKNOWN') as ObservationIndicator;
    const value = fhir.valueQuantity ? fhir.valueQuantity.value : fhir.valueString || '0';
    const unit = fhir.valueQuantity?.unit || 'unknown';
    const timestamp = fhir.effectiveDateTime || nowUtc();
    const streamReachId = fhir.subject?.reference?.replace('Location/', '') || generateId();

    const note = fhir.note?.[0]?.text || '';
    const sourceMatch = note.match(/Source:\s*([A-Z0-9_]+)/);
    const source: ObservationSource = (sourceMatch?.[1] as ObservationSource) || 'IN_SITU_SENSOR';

    const provenance = createProvenanceRecord({
      entityId: id,
      entityType: 'OBSERVATION',
      source,
      sourceIdentifier: fhir.id || id,
      acquisitionTimestamp: timestamp,
      processingMethod: 'FHIR_R4_INGEST_CONVERTER',
      qualityStatus: 'VALIDATED',
    });

    return {
      id,
      source,
      timestamp,
      location: {
        type: 'Point',
        coordinates: [24.0, 35.5], // Default centroid fallback if not in FHIR extension
      },
      streamReachId,
      indicator,
      value,
      unit,
      quality: 'VALIDATED',
      provenance,
      createdAt: nowUtc(),
    };
  }

  static toFhirTask(task: Task): FhirTask {
    const priorityMap: Record<string, 'routine' | 'urgent' | 'asap' | 'stat'> = {
      LOW: 'routine',
      MEDIUM: 'routine',
      HIGH: 'urgent',
      URGENT: 'stat',
    };

    const statusMap: Record<string, FhirTask['status']> = {
      DRAFT: 'draft',
      REQUESTED: 'requested',
      ACCEPTED: 'accepted',
      IN_PROGRESS: 'in-progress',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      VERIFIED: 'completed',
    };

    const inputs: Array<{ type: { coding: Array<{ system: string; code: string; display: string }>; text: string }; valueReference?: { reference: string; display: string }; valueString?: string }> = [];

    if (task.assessmentId) {
      inputs.push({
        type: {
          coding: [{ system: 'https://oneaquahealth.eu/fhir/task-inputs', code: 'evidence-assessment', display: 'Evidence Assessment' }],
          text: 'Triggering Evidence Assessment',
        },
        valueReference: {
          reference: `EvidenceAssessment/${task.assessmentId}`,
          display: `Evidence Assessment ${task.assessmentId}`,
        },
      });
    }

    if (task.recommendationId) {
      inputs.push({
        type: {
          coding: [{ system: 'https://oneaquahealth.eu/fhir/task-inputs', code: 'operational-recommendation', display: 'Operational Recommendation' }],
          text: 'Source Recommendation',
        },
        valueReference: {
          reference: `Recommendation/${task.recommendationId}`,
          display: `Recommendation ${task.recommendationId}`,
        },
      });
    }

    if (task.requiredEvidence && task.requiredEvidence.length > 0) {
      inputs.push({
        type: {
          coding: [{ system: 'https://oneaquahealth.eu/fhir/task-inputs', code: 'required-evidence', display: 'Required Evidence Checklist' }],
          text: 'Required Evidence Protocol',
        },
        valueString: task.requiredEvidence.join('; '),
      });
    }

    return {
      resourceType: 'Task',
      id: task.id,
      identifier: [
        {
          system: 'https://aquasentinel.org/tasks',
          value: task.id,
        },
      ],
      status: statusMap[task.status] || 'requested',
      intent: 'order',
      priority: priorityMap[task.priority] || 'routine',
      code: {
        coding: [
          {
            system: 'https://oneaquahealth.eu/fhir/action-types',
            code: (task.taskType || 'FIELD_VERIFY').toLowerCase(),
            display: task.taskType || 'FIELD_VERIFY',
          },
        ],
        text: task.title || task.instructions,
      },
      description: task.instructions,
      focus: {
        reference: `Flag/${task.incidentId}`,
        display: `Incident Flag ${task.incidentId}`,
      },
      for: task.location
        ? {
            reference: `Location/${task.location.coordinates.join(',')}`,
            display: `Coordinates [${task.location.coordinates[0]}, ${task.location.coordinates[1]}]`,
          }
        : undefined,
      authoredOn: task.createdAt,
      lastModified: task.completedAt || task.acceptedAt || task.createdAt,
      requester: {
        reference: 'Organization/aquasentinel-decision-engine',
        display: 'AquaSentinel Operational Decision Support',
      },
      owner: task.assignedTo
        ? {
            reference: `Practitioner/${encodeURIComponent(task.assignedTo)}`,
            display: `${task.assignedTo} (${task.assignedRole || 'Operator'})`,
          }
        : undefined,
      reasonCode: {
        coding: [
          {
            system: 'https://aquasentinel.org/incident-reasons',
            code: 'operational-response',
            display: `Operational response to classified incident ${task.incidentId}`,
          },
        ],
        text: `Operational response to classified incident ${task.incidentId}`,
      },
      note: [
        {
          text: task.instructions,
          time: task.createdAt,
          authorString: 'AquaSentinel Decision Engine',
        },
      ],
      executionPeriod: {
        start: task.acceptedAt || task.createdAt,
        end: task.completedAt,
      },
      input: inputs.length > 0 ? inputs : undefined,
    };
  }

  static toFhirTaskDraft(rec: Recommendation): FhirTask {
    const priorityMap: Record<string, 'routine' | 'urgent' | 'asap' | 'stat'> = {
      LOW: 'routine',
      MEDIUM: 'routine',
      HIGH: 'urgent',
      URGENT: 'stat',
    };

    const title = (rec as any).measureTitle || rec.title;
    const rationaleSummary =
      typeof rec.rationale === 'string'
        ? rec.rationale
        : (rec.rationale as any)?.summary || rec.rationaleDetails?.whyThis || rec.description;
    const siteId = (rec as any).siteId || 'pilot-site-default';
    const timestamp = (rec as any).generatedAt || rec.createdAt || nowUtc();

    return {
      resourceType: 'Task',
      id: `draft-${rec.id}`,
      identifier: [
        {
          system: 'https://aquasentinel.org/fhir/tasks',
          value: `draft-${rec.id}`,
        },
      ],
      status: 'draft',
      intent: 'proposal',
      priority: priorityMap[rec.priority] || 'routine',
      code: {
        coding: [
          {
            system: 'https://oneaquahealth.eu/fhir/measures',
            code: rec.measureId,
            display: title,
          },
        ],
        text: title,
      },
      description: rationaleSummary,
      focus: {
        reference: `Location/${siteId}`,
        display: `Water Monitoring Site ${siteId}`,
      },
      for: {
        reference: `Incident/${rec.incidentId}`,
        display: `Incident ${rec.incidentId}`,
      },
      authoredOn: timestamp,
      lastModified: timestamp,
      requester: {
        reference: 'Organization/aquasentinel-decision-engine',
        display: 'AquaSentinel Operational Decision Support',
      },
      reasonCode: {
        coding: [
          {
            system: 'https://aquasentinel.org/incident-reasons',
            code: 'operational-recommendation-proposal',
            display: `Proposed response for ${title}`,
          },
        ],
        text: `Proposed operational intervention: ${title}`,
      },
      note: [
        {
          text: `Proposed Action: ${title}. Rationale: ${rationaleSummary}`,
          time: timestamp,
          authorString: 'AquaSentinel Decision Engine',
        },
      ],
      input: [
        {
          type: {
            coding: [{ system: 'https://oneaquahealth.eu/fhir/task-inputs', code: 'operational-recommendation', display: 'Operational Recommendation' }],
            text: 'Source Recommendation',
          },
          valueReference: {
            reference: `Recommendation/${rec.id}`,
            display: `Recommendation ${rec.id}`,
          },
        },
      ],
    };
  }

  static toFhirFlag(incident: Incident): FhirFlag {
    return {
      resourceType: 'Flag',
      id: incident.id,
      status: incident.status === 'RESOLVED' || incident.status === 'DISMISSED' ? 'inactive' : 'active',
      code: {
        coding: [
          {
            system: 'https://oneaquahealth.eu/fhir/hazards',
            code: incident.hazardType.toLowerCase(),
            display: incident.hazardType,
          },
        ],
        text: `Incident: ${incident.hazardType} (Severity: ${incident.severity})`,
      },
      subject: {
        reference: `Location/${incident.streamReachId}`,
        display: `Stream Reach ${incident.streamReachId}`,
      },
      period: {
        start: incident.createdAt,
        end: incident.status === 'RESOLVED' ? incident.updatedAt : undefined,
      },
    };
  }

  static toFhirEarlyWarningFlag(warning: EarlyWarning): FhirFlag {
    return {
      resourceType: 'Flag',
      id: warning.id,
      status: (warning as any).acknowledged ? 'inactive' : 'active',
      code: {
        coding: [
          {
            system: 'https://oneaquahealth.eu/fhir/early-warnings',
            code: warning.warningLevel.toLowerCase(),
            display: `Early Warning (${warning.warningLevel}): ${warning.triggerReason}`,
          },
        ],
        text: `Early Warning [${warning.warningLevel}]: ${warning.triggerReason}. Confidence: ${warning.confidence}. Indicator: ${warning.indicator}`,
      },
      subject: {
        reference: `Location/${warning.streamReachId}`,
        display: `Stream Reach ${warning.reachName || warning.streamReachId}`,
      },
      period: {
        start: warning.timestamp,
      },
    };
  }

  static toFhirForecastObservation(forecast: ForecastResult): FhirObservation[] {
    return forecast.projections.map((pt, idx) => ({
      resourceType: 'Observation',
      id: `${forecast.id}-pt-${idx}`,
      status: 'preliminary',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'activity',
              display: 'Environmental Forecasting & Scenario Simulation',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'https://oneaquahealth.eu/fhir/indicators',
            code: String(forecast.indicator).toLowerCase(),
            display: `${forecast.indicator} [PROJECTED: ${forecast.modelId}]`,
          },
        ],
        text: `PROJECTED ${forecast.indicator} at step +${pt.stepHours}h (Model: ${forecast.modelId})`,
      },
      subject: {
        reference: `Location/${forecast.reachId}`,
        display: `Stream Reach ${forecast.reachName || forecast.reachId}`,
      },
      effectiveDateTime: pt.targetTimestamp,
      valueQuantity: {
        value: pt.projectedValue,
        unit: 'index',
        system: 'http://unitsofmeasure.org',
        code: 'index',
      },
      note: [
        {
          text: `[PROJECTED] AquaSentinel Model: ${forecast.modelId}; Uncertainty: [${pt.lowerBound}, ${pt.upperBound}]; Origin: ${forecast.originTimestamp}`,
        },
      ],
    }));
  }

  static toFhirVerificationObservation(v: Verification): FhirObservation {
    const loc = v.location as VerificationLocation;
    const isValidated = loc?.validationStatus === 'AT_LOCATION' || loc?.validationStatus === 'NEAR_LOCATION' || loc?.isWithinGeofence;
    const inspectorName = typeof v.inspector === 'object' ? v.inspector?.name : String(v.inspector || v.observer || 'Unknown');
    const role = typeof v.inspector === 'object' ? (v.inspector as any).role : 'Inspector';

    return {
      resourceType: 'Observation',
      id: v.id,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'activity',
              display: 'Activity',
            },
            {
              system: 'https://oneaquahealth.eu/fhir/categories',
              code: 'field-verification',
              display: 'Field Verification and Ground Truth Inspection',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'https://oneaquahealth.eu/fhir/indicators',
            code: 'field_inspection_verification',
            display: 'Closed-Loop Field Verification Inspection',
          },
        ],
        text: `Field Verification for Task ${v.taskId} (Incident ${v.incidentId})`,
      },
      subject: {
        reference: `Incident/${v.incidentId}`,
        display: `Incident ${v.incidentId}`,
      },
      effectiveDateTime: v.timestamp,
      valueString: v.status,
      component: [
        {
          code: {
            coding: [{ system: 'https://oneaquahealth.eu/fhir/observation-components', code: 'water_colour', display: 'Water Colour' }],
          },
          valueString: v.observations?.waterColour || 'UNKNOWN',
        },
        {
          code: {
            coding: [{ system: 'https://oneaquahealth.eu/fhir/observation-components', code: 'odour', display: 'Odour' }],
          },
          valueString: v.observations?.odour || 'UNKNOWN',
        },
        {
          code: {
            coding: [{ system: 'https://oneaquahealth.eu/fhir/observation-components', code: 'surface_appearance', display: 'Surface Appearance' }],
          },
          valueString: v.observations?.surfaceAppearance || (v.observations?.foam ? 'FOAM' : 'CLEAR'),
        },
        {
          code: {
            coding: [{ system: 'https://oneaquahealth.eu/fhir/observation-components', code: 'dead_fish_observed', display: 'Dead Aquatic Life / Fish' }],
          },
          valueString: String(v.observations?.deadFish ?? 0),
        },
        {
          code: {
            coding: [{ system: 'https://oneaquahealth.eu/fhir/observation-components', code: 'gps_validation', display: 'Geofence Validation' }],
          },
          valueString: isValidated ? 'VALIDATED' : 'OUT_OF_BOUNDS',
        },
      ],
      note: [
        {
          text: `Inspector: ${inspectorName} (${role}); Assessment: ${v.assessment || 'N/A'}; Notes: ${v.notes || 'None'}`,
        },
      ],
    };
  }
}

