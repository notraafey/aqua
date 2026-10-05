import { Router, Request, Response, NextFunction } from 'express';
import { FhirObservation } from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { getFhirAdapter } from '../../adapters/fhir/index.js';
import { getEventBus } from '../../events/index.js';
import { logger } from '../../logging/logger.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';

export const webhooksRouter = Router();

webhooksRouter.post('/fhir/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    logger.info('[Webhook] Received FHIR subscription resthook notification', {
      resourceType: payload?.resourceType,
      id: payload?.id,
    });

    // Check if the payload is an Observation or wraps one
    const resource: FhirObservation | undefined =
      payload?.resourceType === 'Observation'
        ? payload
        : payload?.resource?.resourceType === 'Observation'
        ? payload.resource
        : undefined;

    if (resource) {
      const fhirAdapter = getFhirAdapter();
      const observation = fhirAdapter.fromFhirObservation(resource);

      const repos = getRepositories();
      const saved = await repos.observations.create(observation);

      const eventBus = getEventBus();
      await eventBus.publish({
        eventId: generateId(),
        eventType: 'ObservationReceived',
        timestamp: nowUtc(),
        actor: 'webhook:fhir_subscription',
        payload: { observation: saved },
      });

      logger.info(`[Webhook] Converted & persisted FHIR Observation ${saved.id} (indicator: ${saved.indicator}, val: ${saved.value})`);
    }

    res.status(200).json({ status: 'PROCESSED' });
  } catch (err) {
    next(err);
  }
});
