import {
  Observation,
  Task,
  Incident,
  FhirObservation,
  FhirTask,
  FhirFlag,
  EarlyWarning,
  ForecastResult,
  FhirSubscription,
} from '@aquasentinel/shared';
import { IFhirAdapter, FhirHealthStatus } from './types.js';
import { FhirMapper } from './mapper.js';
import { FhirValidator } from './validator.js';
import { logger } from '../../logging/logger.js';

export interface HapiAdapterOptions {
  authMode?: 'none' | 'basic' | 'bearer' | 'oauth2';
  authToken?: string;
}

export class HapiFhirAdapter implements IFhirAdapter {
  private serverUrl: string;
  private options: HapiAdapterOptions;

  constructor(serverUrl: string, options: HapiAdapterOptions = {}) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.options = options;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };
    if (this.options.authMode === 'bearer' && this.options.authToken) {
      headers.Authorization = `Bearer ${this.options.authToken}`;
    }
    return headers;
  }

  async healthCheck(): Promise<FhirHealthStatus> {
    try {
      const res = await fetch(`${this.serverUrl}/metadata`, {
        headers: { Accept: 'application/fhir+json' },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const metadata = (await res.json().catch(() => ({}))) as any;
        return {
          healthy: true,
          endpoint: this.serverUrl,
          isMock: false,
          version: metadata.fhirVersion || '4.0.1 (HAPI FHIR R4)',
        };
      }
      return {
        healthy: false,
        endpoint: this.serverUrl,
        isMock: false,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        endpoint: this.serverUrl,
        isMock: false,
        error: err.message,
      };
    }
  }

  async publishObservation(obs: Observation): Promise<string> {
    const fhirObs = this.toFhirObservation(obs);
    const validation = FhirValidator.validate(fhirObs);
    if (!validation.valid) {
      throw new Error(
        `FHIR Validation failed for Observation ${obs.id}: ${validation.issues.map((i) => i.details).join('; ')}`
      );
    }

    logger.info(`Publishing Observation ${obs.id} to HAPI FHIR: ${this.serverUrl}/Observation`);

    const res = await fetch(`${this.serverUrl}/Observation`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(fhirObs),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to publish Observation to FHIR: HTTP ${res.status} - ${text}`);
    }

    const json = (await res.json()) as { id?: string };
    return json.id || obs.id;
  }

  async publishTask(task: Task): Promise<string> {
    const fhirTask = this.toFhirTask(task);
    const validation = FhirValidator.validate(fhirTask);
    if (!validation.valid) {
      throw new Error(
        `FHIR Validation failed for Task ${task.id}: ${validation.issues.map((i) => i.details).join('; ')}`
      );
    }

    logger.info(`Publishing Task ${task.id} to HAPI FHIR: ${this.serverUrl}/Task`);

    const res = await fetch(`${this.serverUrl}/Task`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(fhirTask),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to publish Task to FHIR: HTTP ${res.status} - ${text}`);
    }

    const json = (await res.json()) as { id?: string };
    return json.id || task.id;
  }

  async updateTask(task: Task): Promise<string> {
    const fhirTask = this.toFhirTask(task);
    const taskId = task.fhirTaskId || task.id;
    logger.info(`Updating Task ${taskId} in HAPI FHIR: ${this.serverUrl}/Task/${taskId}`);

    const res = await fetch(`${this.serverUrl}/Task/${taskId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(fhirTask),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.warn(`Failed to update Task in FHIR: HTTP ${res.status} - ${text}`);
      return taskId;
    }

    const json = (await res.json()) as { id?: string };
    return json.id || taskId;
  }

  async fetchTask(id: string): Promise<FhirTask | null> {
    const res = await fetch(`${this.serverUrl}/Task/${id}`, {
      headers: { Accept: 'application/fhir+json' },
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to fetch Task ${id} from FHIR: HTTP ${res.status}`);
    }

    return (await res.json()) as FhirTask;
  }

  async publishFlag(incident: Incident): Promise<string> {
    const fhirFlag = this.toFhirFlag(incident);
    const validation = FhirValidator.validate(fhirFlag);
    if (!validation.valid) {
      throw new Error(
        `FHIR Validation failed for Flag ${incident.id}: ${validation.issues.map((i) => i.details).join('; ')}`
      );
    }

    logger.info(`Publishing Flag for incident ${incident.id} to HAPI FHIR: ${this.serverUrl}/Flag`);

    const res = await fetch(`${this.serverUrl}/Flag`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(fhirFlag),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to publish Flag to FHIR: HTTP ${res.status} - ${text}`);
    }

    const json = (await res.json()) as { id?: string };
    return json.id || incident.id;
  }

  async publishEarlyWarningFlag(warning: EarlyWarning): Promise<string> {
    const fhirFlag = this.toFhirEarlyWarningFlag(warning);
    logger.info(`Publishing EarlyWarning Flag ${warning.id} to HAPI FHIR: ${this.serverUrl}/Flag`);

    const res = await fetch(`${this.serverUrl}/Flag`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(fhirFlag),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to publish EarlyWarning Flag to FHIR: HTTP ${res.status} - ${text}`);
    }

    const json = (await res.json()) as { id?: string };
    return json.id || warning.id;
  }

  async publishForecastObservation(forecast: ForecastResult): Promise<string[]> {
    const fhirObsList = this.toFhirForecastObservation(forecast);
    const ids: string[] = [];

    for (const fhirObs of fhirObsList) {
      const res = await fetch(`${this.serverUrl}/Observation`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(fhirObs),
      });
      if (res.ok) {
        const json = (await res.json()) as { id?: string };
        if (json.id) ids.push(json.id);
      }
    }
    return ids;
  }

  async fetchObservation(id: string): Promise<Observation | null> {
    const res = await fetch(`${this.serverUrl}/Observation/${id}`, {
      headers: { Accept: 'application/fhir+json' },
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to fetch Observation ${id} from FHIR: HTTP ${res.status}`);
    }

    const fhirObs = (await res.json()) as FhirObservation;
    return this.fromFhirObservation(fhirObs);
  }

  toFhirObservation(obs: Observation): FhirObservation {
    return FhirMapper.toFhirObservation(obs);
  }

  fromFhirObservation(fhirObs: FhirObservation): Observation {
    return FhirMapper.fromFhirObservation(fhirObs);
  }

  toFhirTask(task: Task): FhirTask {
    return FhirMapper.toFhirTask(task);
  }

  toFhirFlag(incident: Incident): FhirFlag {
    return FhirMapper.toFhirFlag(incident);
  }

  toFhirEarlyWarningFlag(warning: EarlyWarning): FhirFlag {
    return FhirMapper.toFhirEarlyWarningFlag(warning);
  }

  toFhirForecastObservation(forecast: ForecastResult): FhirObservation[] {
    return FhirMapper.toFhirForecastObservation(forecast);
  }

  async registerSubscription(sub: FhirSubscription): Promise<string> {
    const payload = {
      resourceType: 'Subscription',
      id: sub.id,
      status: 'requested', // HAPI FHIR transitions to active
      reason: sub.reason,
      criteria: sub.criteria,
      channel: {
        type: sub.channel.type,
        endpoint: sub.channel.endpoint,
        payload: sub.channel.payload || 'application/fhir+json',
        header: sub.channel.header,
      },
    };

    logger.info(`Registering Subscription ${sub.id} with HAPI FHIR: ${this.serverUrl}/Subscription/${sub.id}`);

    const res = await fetch(`${this.serverUrl}/Subscription/${sub.id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to register Subscription with HAPI FHIR: HTTP ${res.status} - ${text}`);
    }

    const json = (await res.json()) as { id?: string };
    return json.id || sub.id;
  }

  async getSubscriptions(): Promise<FhirSubscription[]> {
    const res = await fetch(`${this.serverUrl}/Subscription`, {
      headers: { Accept: 'application/fhir+json' },
    });

    if (!res.ok) {
      return [];
    }

    const bundle = (await res.json()) as any;
    if (!bundle.entry || !Array.isArray(bundle.entry)) return [];

    return bundle.entry.map((e: any) => {
      const r = e.resource;
      return {
        id: r.id,
        status: r.status,
        reason: r.reason || '',
        criteria: r.criteria || '',
        channel: {
          type: r.channel?.type || 'rest-hook',
          endpoint: r.channel?.endpoint || '',
          payload: r.channel?.payload,
        },
      };
    });
  }
}
