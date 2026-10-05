import { InteroperabilityAcknowledgement } from '@aquasentinel/shared';

export interface ConsumerEventRecord {
  id: string;
  eventId: string;
  receivedAt: string;
  resourceType: string;
  resourceId: string;
  payload: any;
  isDuplicate: boolean;
  downstreamActionTaken: string;
  acknowledgement: InteroperabilityAcknowledgement;
}

export interface ConsumerHealthStatus {
  status: 'healthy' | 'degraded' | 'offline';
  consumerId: string;
  consumerName: string;
  version: string;
  uptimeSeconds: number;
  totalEventsReceived: number;
  uniqueEventsCount: number;
  duplicateEventsCount: number;
  simulatedFailure: boolean;
}
