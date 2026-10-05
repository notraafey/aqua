import { describe, it, expect } from 'vitest';
import { InMemoryEventBus } from '../../src/events/index.js';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';
import { IncidentCreatedEvent } from '@aquasentinel/shared';

describe('Event Architecture Foundation', () => {
  it('publishes and subscribes to typed domain events', async () => {
    const bus = new InMemoryEventBus();
    const receivedEvents: IncidentCreatedEvent[] = [];

    const handler = async (event: IncidentCreatedEvent) => {
      receivedEvents.push(event);
    };

    bus.subscribe('IncidentCreated', handler);

    const testEvent: IncidentCreatedEvent = {
      eventId: generateId(),
      eventType: 'IncidentCreated',
      timestamp: nowUtc(),
      actor: 'unit-test',
      payload: {
        incident: {
          id: generateId(),
          streamReachId: generateId(),
          createdAt: nowUtc(),
          updatedAt: nowUtc(),
          status: 'DETECTED',
          hazardType: 'ALGAL_BLOOM',
          evidenceConfidence: 65,
          severity: 'MEDIUM',
          verificationStatus: 'UNVERIFIED',
        },
      },
    };

    await bus.publish(testEvent);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].eventId).toBe(testEvent.eventId);
    expect(receivedEvents[0].payload.incident.hazardType).toBe('ALGAL_BLOOM');

    // Unsubscribe
    bus.unsubscribe('IncidentCreated', handler);
    await bus.publish(testEvent);
    expect(receivedEvents).toHaveLength(1);
  });
});
