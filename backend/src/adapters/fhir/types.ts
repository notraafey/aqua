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

export interface FhirHealthStatus {
  healthy: boolean;
  endpoint: string;
  isMock: boolean;
  version?: string;
  error?: string;
}

export interface IFhirAdapter {
  healthCheck(): Promise<FhirHealthStatus>;
  publishObservation(obs: Observation): Promise<string>;
  publishTask(task: Task): Promise<string>;
  updateTask(task: Task): Promise<string>;
  publishFlag(incident: Incident): Promise<string>;
  publishEarlyWarningFlag?(warning: EarlyWarning): Promise<string>;
  publishForecastObservation?(forecast: ForecastResult): Promise<string[]>;
  fetchObservation(id: string): Promise<Observation | null>;
  fetchTask(id: string): Promise<FhirTask | null>;
  toFhirObservation(obs: Observation): FhirObservation;
  fromFhirObservation(fhirObs: FhirObservation): Observation;
  toFhirTask(task: Task): FhirTask;
  toFhirFlag(incident: Incident): FhirFlag;
  toFhirEarlyWarningFlag?(warning: EarlyWarning): FhirFlag;
  toFhirForecastObservation?(forecast: ForecastResult): FhirObservation[];
  registerSubscription(subscription: FhirSubscription): Promise<string>;
  getSubscriptions(): Promise<FhirSubscription[]>;
  dispatchSubscriptionNotification?(resource: any): Promise<number>;
}

