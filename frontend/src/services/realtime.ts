/**
 * Real-Time Event Transport Service
 * Conforms to AquaSentinel Phase 5 PRD Sections 23, 24, 30, 35.
 * 
 * Provides a typed Server-Sent Events (SSE) connection to /api/v1/events/stream,
 * broadcasting backend domain events to React subscribers with automatic reconnection,
 * heartbeat monitoring, and fallback handling.
 */

import { DomainEvent } from '@aquasentinel/shared';

export type RealtimeListener<T = DomainEvent> = (event: T) => void;

export interface RealtimeConnectionState {
  connected: boolean;
  transport: 'SSE' | 'OFFLINE' | 'POLLING';
  lastHeartbeat: string | null;
  reconnectAttempts: number;
}

class RealtimeService {
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<RealtimeListener<any>>>();
  private wildcardListeners = new Set<RealtimeListener<DomainEvent>>();
  private stateListeners = new Set<(state: RealtimeConnectionState) => void>();
  private reconnectTimeout: any = null;
  private heartbeatTimeout: any = null;
  private isConnecting = false;

  private state: RealtimeConnectionState = {
    connected: false,
    transport: 'SSE',
    lastHeartbeat: null,
    reconnectAttempts: 0,
  };

  public getState(): RealtimeConnectionState {
    return { ...this.state };
  }

  public onStateChange(listener: (state: RealtimeConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private updateState(partial: Partial<RealtimeConnectionState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.stateListeners) {
      try {
        listener(this.getState());
      } catch (err) {
        console.error('[RealtimeService] Error in state listener:', err);
      }
    }
  }

  /**
   * Initializes the SSE connection to the backend stream.
   */
  public connect(): void {
    if (typeof window === 'undefined' || !window.EventSource) {
      this.updateState({ connected: false, transport: 'OFFLINE' });
      return;
    }

    if (this.eventSource || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const streamUrl = '/api/v1/events/stream';
      const es = new EventSource(streamUrl);
      this.eventSource = es;

      es.onopen = () => {
        this.isConnecting = false;
        this.updateState({
          connected: true,
          transport: 'SSE',
          lastHeartbeat: new Date().toISOString(),
          reconnectAttempts: 0,
        });
        this.resetHeartbeatTimer();
      };

      es.onerror = () => {
        this.isConnecting = false;
        this.updateState({
          connected: false,
          reconnectAttempts: this.state.reconnectAttempts + 1,
        });
        this.cleanup();
        this.scheduleReconnect();
      };

      // Register standard AquaSentinel domain event types
      const eventTypes = [
        'ConnectionEstablished',
        'ObservationReceived',
        'EvidenceUpdated',
        'IncidentCreated',
        'IncidentStateChanged',
        'RecommendationCreated',
        'RecommendationGenerated',
        'RecommendationReviewed',
        'TaskCreated',
        'TaskStatusUpdated',
        'VerificationSubmitted',
        'IncidentResolved',
      ];

      for (const eventType of eventTypes) {
        es.addEventListener(eventType, (msg: MessageEvent) => {
          this.handleIncomingMessage(eventType, msg);
        });
      }

      // Generic fallback message listener
      es.onmessage = (msg: MessageEvent) => {
        try {
          const parsed = JSON.parse(msg.data);
          this.dispatch(parsed.eventType || 'GenericMessage', parsed);
        } catch {
          // Keep-alive comments or text
        }
      };
    } catch (err) {
      this.isConnecting = false;
      this.updateState({ connected: false });
      this.scheduleReconnect();
    }
  }

  private handleIncomingMessage(eventType: string, msg: MessageEvent): void {
    this.updateState({ lastHeartbeat: new Date().toISOString() });
    this.resetHeartbeatTimer();

    try {
      const parsed: DomainEvent = JSON.parse(msg.data);
      this.dispatch(eventType, parsed);
    } catch (err) {
      console.warn(`[RealtimeService] Failed to parse SSE event ${eventType}:`, err);
    }
  }

  private resetHeartbeatTimer(): void {
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    // Expect heartbeat within 45s (server sends ping every 25s)
    this.heartbeatTimeout = setTimeout(() => {
      this.updateState({ connected: false });
      this.cleanup();
      this.scheduleReconnect();
    }, 45000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.state.reconnectAttempts), 15000);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.cleanup();
    this.updateState({ connected: false, transport: 'OFFLINE' });
  }

  /**
   * Dispatches an event locally (also allows mock injection in demo mode).
   */
  public dispatch(eventType: string, event: DomainEvent): void {
    const specific = this.listeners.get(eventType);
    if (specific) {
      for (const listener of specific) {
        try {
          listener(event);
        } catch (err) {
          console.error(`[RealtimeService] Error executing listener for ${eventType}:`, err);
        }
      }
    }

    for (const listener of this.wildcardListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[RealtimeService] Error executing wildcard listener:', err);
      }
    }
  }

  /**
   * Subscribes to a specific domain event type.
   */
  public subscribe<T = DomainEvent>(eventType: string, listener: RealtimeListener<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Auto-connect if needed
    if (!this.eventSource && !this.isConnecting) {
      this.connect();
    }

    return () => {
      const set = this.listeners.get(eventType);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribes to all domain events.
   */
  public subscribeAll(listener: RealtimeListener<DomainEvent>): () => void {
    this.wildcardListeners.add(listener);
    if (!this.eventSource && !this.isConnecting) {
      this.connect();
    }
    return () => {
      this.wildcardListeners.delete(listener);
    };
  }
}

export const realtimeService = new RealtimeService();
