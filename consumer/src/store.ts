import { ConsumerEventRecord } from './types.js';

export class ConsumerStore {
  private events: ConsumerEventRecord[] = [];
  private seenEventIds = new Set<string>();
  private failureMode: boolean = false;
  private failNextRequestsCount: number = 0;

  isDuplicate(eventId: string): boolean {
    return this.seenEventIds.has(eventId);
  }

  recordEvent(record: ConsumerEventRecord): void {
    if (!record.isDuplicate) {
      this.seenEventIds.add(record.eventId);
    }
    this.events.unshift(record);
  }

  getEvents(limit = 100): ConsumerEventRecord[] {
    return this.events.slice(0, limit);
  }

  getEventById(id: string): ConsumerEventRecord | null {
    return this.events.find((e) => e.id === id || e.eventId === id) || null;
  }

  setSimulatedFailure(active: boolean, failNextCount = 0): void {
    this.failureMode = active;
    this.failNextRequestsCount = failNextCount;
  }

  shouldFail(): boolean {
    if (this.failNextRequestsCount > 0) {
      this.failNextRequestsCount--;
      return true;
    }
    return this.failureMode;
  }

  isFailureModeActive(): boolean {
    return this.failureMode || this.failNextRequestsCount > 0;
  }

  getStats() {
    const unique = this.seenEventIds.size;
    const total = this.events.length;
    const duplicate = total - unique;
    return {
      total,
      unique,
      duplicate: duplicate < 0 ? 0 : duplicate,
      failureActive: this.isFailureModeActive(),
    };
  }

  reset(): void {
    this.events = [];
    this.seenEventIds.clear();
    this.failureMode = false;
    this.failNextRequestsCount = 0;
  }
}

export const consumerStore = new ConsumerStore();
