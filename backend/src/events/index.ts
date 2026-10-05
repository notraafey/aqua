import { DomainEvent } from '@aquasentinel/shared';
import { logger } from '../logging/logger.js';

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

export interface IEventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(eventType: T['eventType'] | string, handler: EventHandler<T>): void;
  unsubscribe<T extends DomainEvent>(eventType: T['eventType'] | string, handler: EventHandler<T>): void;
}

export class InMemoryEventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    logger.info(`[EventBus] Publishing event: ${event.eventType}`, {
      eventId: event.eventId,
      eventType: event.eventType,
      actor: event.actor,
      timestamp: event.timestamp,
    });

    const listeners = this.handlers.get(event.eventType);
    if (!listeners || listeners.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];
    for (const handler of listeners) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          promises.push(
            result.catch((err) => {
              logger.error(`[EventBus] Error in handler for ${event.eventType}:`, { error: err.message });
            })
          );
        }
      } catch (err: any) {
        logger.error(`[EventBus] Synchronous error in handler for ${event.eventType}:`, { error: err.message });
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  subscribe<T extends DomainEvent>(eventType: T['eventType'] | string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe<T extends DomainEvent>(eventType: T['eventType'] | string, handler: EventHandler<T>): void {
    const listeners = this.handlers.get(eventType);
    if (listeners) {
      listeners.delete(handler);
    }
  }
}

// Global EventBus Singleton
let activeEventBus: IEventBus | null = null;

export function getEventBus(): IEventBus {
  if (!activeEventBus) {
    activeEventBus = new InMemoryEventBus();
  }
  return activeEventBus;
}

export function setEventBus(bus: IEventBus): void {
  activeEventBus = bus;
}
