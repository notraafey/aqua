import { describe, it, expect, beforeEach } from 'vitest';
import { evidenceFusionService } from '../../src/services/evidence/evidence-fusion-service.js';
import { getRepositories, createRepositories, setRepositories } from '../../src/database/repositories/index.js';
import { getEventBus, InMemoryEventBus, setEventBus } from '../../src/events/index.js';
import { Observation, StreamReach, EvidenceUpdatedEvent, ObservationReceivedEvent } from '@aquasentinel/shared';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';

describe('Evidence Fusion Pipeline Integration Tests', () => {
  let reach: StreamReach;

  beforeEach(async () => {
    // Reset test repositories and event bus
    const testRepos = createRepositories(true);
    setRepositories(testRepos);
    const bus = new InMemoryEventBus();
    setEventBus(bus);

    evidenceFusionService.initialize();

    reach = await testRepos.streamReaches.create({
      id: 'reach-almyros-test',
      name: 'Almyros Stream Reach Test',
      city: 'Volos',
      region: 'Thessaly',
      monitoringStatus: 'ACTIVE',
      geometry: {
        type: 'LineString',
        coordinates: [
          [22.751, 39.182],
          [22.7535, 39.1812],
          [22.757, 39.1798],
        ],
      },
      baselineData: { typicalNdci: 0.12 },
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    });
  });

  it('triggers evidence assessment upon ObservationReceived and emits EvidenceUpdated', async () => {
    const repos = getRepositories();
    const eventBus = getEventBus();

    let updatedEventReceived: EvidenceUpdatedEvent | null = null;
    eventBus.subscribe<EvidenceUpdatedEvent>('EvidenceUpdated', (ev) => {
      updatedEventReceived = ev;
    });

    const satObs: Observation = await repos.observations.create({
      id: 'obs-sat-event-test',
      source: 'SATELLITE_SENTINEL2',
      timestamp: nowUtc(),
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      streamReachId: reach.id,
      indicator: 'NDCI',
      value: 0.44,
      unit: 'index',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-sat-event-test',
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: 'S2_TEST',
        acquisitionTimestamp: nowUtc(),
        ingestionTimestamp: nowUtc(),
        processingTimestamp: nowUtc(),
        processingMethod: 'SENTINEL2_NDCI',
        qualityStatus: 'VALIDATED',
      },
      createdAt: nowUtc(),
    });

    // Publish ObservationReceived domain event
    const obsEvent: ObservationReceivedEvent = {
      eventId: generateId(),
      eventType: 'ObservationReceived',
      timestamp: nowUtc(),
      actor: 'test',
      payload: { observation: satObs },
    };

    await eventBus.publish(obsEvent);

    // Verify assessment was persisted
    const assessments = await repos.evidenceAssessments.findAll({ streamReachId: reach.id });
    expect(assessments.length).toBeGreaterThanOrEqual(1);

    const latest = assessments[0];
    expect(latest.score).toBeGreaterThan(0);
    expect(latest.confidenceBand).toBeDefined();

    // Verify EvidenceUpdated was published
    expect(updatedEventReceived).not.toBeNull();
    expect(updatedEventReceived?.payload.streamReachId).toBe(reach.id);
    expect(updatedEventReceived?.payload.assessment.id).toBe(latest.id);
  });

  it('ensures idempotency: identical observation event does not create redundant assessment', async () => {
    const repos = getRepositories();
    const eventBus = getEventBus();

    const satObs: Observation = await repos.observations.create({
      id: 'obs-idempotent-test',
      source: 'SATELLITE_SENTINEL2',
      timestamp: nowUtc(),
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      streamReachId: reach.id,
      indicator: 'NDCI',
      value: 0.42,
      unit: 'index',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-idempotent-test',
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: 'S2_IDEM',
        acquisitionTimestamp: nowUtc(),
        ingestionTimestamp: nowUtc(),
        processingTimestamp: nowUtc(),
        processingMethod: 'SENTINEL2_NDCI',
        qualityStatus: 'VALIDATED',
      },
      createdAt: nowUtc(),
    });

    // Fire event 1st time
    await evidenceFusionService.handleObservationReceived(satObs);
    const countAfterFirst = await repos.evidenceAssessments.count();

    // Fire event 2nd time with exact same observation
    await evidenceFusionService.handleObservationReceived(satObs);
    const countAfterSecond = await repos.evidenceAssessments.count();

    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
