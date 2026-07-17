export type EventType =
  | "PipelineStarted"
  | "PipelineCompleted"
  | "ResourceScanned"
  | "ResourceExported"
  | "ResourceRestored"
  | "VerificationFailed"
  | "Throttled"
  | "Error";

export interface EventPayload {
  jobId: string;
  storeDomain: string;
  timestamp: string;
  meta: Record<string, any>;
}

type EventHandler = (payload: EventPayload) => void | Promise<void>;

/**
 * InternalEventBus
 * Serves as the central nervous system for the EDA architecture.
 * In a Vercel/Serverless environment, this acts as a local memory bus during execution.
 * In a true distributed environment, this would bridge to Kafka, Redis Pub/Sub, or Supabase Realtime.
 */
export class InternalEventBus {
  private subscribers: Map<EventType, EventHandler[]> = new Map();

  subscribe(eventType: EventType, handler: EventHandler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
  }

  async emit(eventType: EventType, payload: EventPayload) {
    // Fire and forget logging
    console.log(`[EventBus] ${eventType} for job ${payload.jobId}`, payload.meta);

    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      // Execute all handlers concurrently
      await Promise.allSettled(handlers.map((h) => h(payload)));
    }
  }
}

export const globalEventBus = new InternalEventBus();
