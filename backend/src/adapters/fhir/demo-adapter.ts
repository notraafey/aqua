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
import { nowUtc } from '../../domain/value-objects.js';

export class DemoFhirAdapter implements IFhirAdapter {
  private observations = new Map<string, FhirObservation>();
  private tasks = new Map<string, FhirTask>();
  private flags = new Map<string, FhirFlag>();
  private subscriptions = new Map<string, FhirSubscription>();

  async healthCheck(): Promise<FhirHealthStatus> {
    return {
      healthy: true,
      endpoint: 'in-memory://demo-fhir-r4',
      isMock: true,
      version: '4.0.1 (Demo / In-Memory Mock)',
    };
  }

  async publishObservation(obs: Observation): Promise<string> {
    const fhirObs = this.toFhirObservation(obs);
    const validation = FhirValidator.validate(fhirObs);
    if (!validation.valid) {
      logger.warn(`[DEMO FHIR] Observation ${obs.id} failed validation:`, validation.issues);
    }

    this.observations.set(obs.id, fhirObs);
    logger.info(`[DEMO FHIR] Stored Observation ${obs.id}`);

    await this.dispatchSubscriptionNotification(fhirObs);
    return obs.id;
  }

  async publishTask(task: Task): Promise<string> {
    const fhirTask = this.toFhirTask(task);
    const validation = FhirValidator.validate(fhirTask);
    if (!validation.valid) {
      logger.warn(`[DEMO FHIR] Task ${task.id} failed validation:`, validation.issues);
    }

    this.tasks.set(task.id, fhirTask);
    logger.info(`[DEMO FHIR] Stored Task ${task.id}`);

    await this.dispatchSubscriptionNotification(fhirTask);
    return task.id;
  }

  async updateTask(task: Task): Promise<string> {
    const fhirTask = this.toFhirTask(task);
    this.tasks.set(task.id, fhirTask);
    logger.info(`[DEMO FHIR] Updated Task ${task.id} (Status: ${fhirTask.status})`);

    await this.dispatchSubscriptionNotification(fhirTask);
    return task.id;
  }

  async publishFlag(incident: Incident): Promise<string> {
    const fhirFlag = this.toFhirFlag(incident);
    const validation = FhirValidator.validate(fhirFlag);
    if (!validation.valid) {
      logger.warn(`[DEMO FHIR] Flag ${incident.id} failed validation:`, validation.issues);
    }

    this.flags.set(incident.id, fhirFlag);
    logger.info(`[DEMO FHIR] Stored Flag ${incident.id}`);

    await this.dispatchSubscriptionNotification(fhirFlag);
    return incident.id;
  }

  async publishEarlyWarningFlag(warning: EarlyWarning): Promise<string> {
    const fhirFlag = this.toFhirEarlyWarningFlag(warning);
    this.flags.set(warning.id, fhirFlag);
    logger.info(`[DEMO FHIR] Stored EarlyWarning Flag ${warning.id}`);

    await this.dispatchSubscriptionNotification(fhirFlag);
    return warning.id;
  }

  async publishForecastObservation(forecast: ForecastResult): Promise<string[]> {
    const fhirObsList = this.toFhirForecastObservation(forecast);
    const ids: string[] = [];
    for (const fhirObs of fhirObsList) {
      if (fhirObs.id) {
        this.observations.set(fhirObs.id, fhirObs);
        ids.push(fhirObs.id);
        await this.dispatchSubscriptionNotification(fhirObs);
      }
    }
    logger.info(`[DEMO FHIR] Stored ${ids.length} Forecast Observations for forecast ${forecast.id}`);
    return ids;
  }

  async fetchObservation(id: string): Promise<Observation | null> {
    const fhirObs = this.observations.get(id);
    if (!fhirObs) return null;
    return this.fromFhirObservation(fhirObs);
  }

  async fetchTask(id: string): Promise<FhirTask | null> {
    const fhirTask = this.tasks.get(id);
    return fhirTask || null;
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
    this.subscriptions.set(sub.id, {
      ...sub,
      status: 'active',
      createdAt: sub.createdAt || nowUtc(),
    });
    logger.info(`[DEMO FHIR] Registered subscription ${sub.id} -> ${sub.channel.endpoint} (${sub.criteria})`);
    return sub.id;
  }

  async getSubscriptions(): Promise<FhirSubscription[]> {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Evaluates active FHIR subscriptions and fires real REST-hook HTTP notifications
   * to downstream endpoints. Defined in Phase 7 PRD Section 17.
   */
  async dispatchSubscriptionNotification(resource: any): Promise<number> {
    let dispatched = 0;
    const activeSubs = Array.from(this.subscriptions.values()).filter((s) => s.status === 'active');

    for (const sub of activeSubs) {
      if (this.matchesCriteria(sub.criteria, resource)) {
        dispatched++;
        sub.lastTriggeredAt = nowUtc();
        if (sub.channel.type === 'rest-hook' && sub.channel.endpoint) {
          try {
            logger.info(
              `[DEMO FHIR] Dispatching REST-hook for ${resource.resourceType}/${resource.id} to ${sub.channel.endpoint}`
            );
            await fetch(sub.channel.endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/fhir+json',
                Accept: 'application/json, application/fhir+json',
                'X-FHIR-Subscription-ID': sub.id,
              },
              body: JSON.stringify(resource),
              signal: AbortSignal.timeout(3000),
            });
          } catch (err: any) {
            logger.warn(
              `[DEMO FHIR] REST-hook delivery failed for subscription ${sub.id} to ${sub.channel.endpoint}: ${err.message}`
            );
          }
        }
      }
    }
    return dispatched;
  }

  private matchesCriteria(criteria: string, resource: any): boolean {
    if (!criteria || criteria === '*' || criteria === 'all') return true;

    const [resourceTypeFilter, query] = criteria.split('?');
    if (resourceTypeFilter && resourceTypeFilter !== resource.resourceType) {
      return false;
    }

    if (!query) return true;

    // Filter key=val checks
    const params = new URLSearchParams(query);
    for (const [key, val] of params.entries()) {
      if (key === 'status' && resource.status && resource.status !== val) {
        return false;
      }
    }

    return true;
  }
}
