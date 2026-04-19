import { EventEmitter } from "events";
import { AllDomainEvents, EventType } from "./types";

type EventHandler<E extends AllDomainEvents = AllDomainEvents> = (
  event: E,
) => Promise<void> | void;

/**
 * EventBus (In-Memory Event Emitter)
 *
 * Manages domain event publication and subscription.
 * Handlers are executed sequentially in the order they were registered.
 *
 * For distributed systems with multiple instances, extend with Redis Pub/Sub
 * TODO: Add Redis-backed pub/sub for horizontal scaling
 */
export class EventBus {
  private emitter: EventEmitter;
  private handlers: Map<EventType | "*", EventHandler[]> = new Map();

  constructor() {
    this.emitter = new EventEmitter();
    // Prevent memory leaks with many listeners
    this.emitter.setMaxListeners(100);
  }

  /**
   * Subscribe to domain events
   * @param eventType The event type to subscribe to (e.g., 'issue.created') or '*' for all
   * @param handler Callback function to execute when event is published
   */
  subscribe<E extends AllDomainEvents = AllDomainEvents>(
    eventType: EventType | "*",
    handler: EventHandler<E>,
  ): () => void {
    // Store in handlers map for discovery/debugging
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler);

    // Wrap handler with error handling
    const wrappedHandler = async (event: E) => {
      try {
        await Promise.resolve(handler(event));
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
        // In production, push to error tracking service (Sentry, DataDog, etc)
      }
    };

    this.emitter.on(eventType, wrappedHandler);

    // Return unsubscribe function
    return () => {
      this.emitter.off(eventType, wrappedHandler);
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler as EventHandler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Subscribe to all events (useful for logging/auditing)
   */
  subscribeToAll(handler: EventHandler): () => void {
    const wrappedHandler = async (event: AllDomainEvents) => {
      try {
        await Promise.resolve(handler(event));
      } catch (error) {
        console.error("Error in global event handler:", error);
      }
    };

    this.emitter.on("*", wrappedHandler);

    return () => {
      this.emitter.off("*", wrappedHandler);
    };
  }

  /**
   * Publish a domain event to all subscribers
   */
  async publish<E extends AllDomainEvents = AllDomainEvents>(
    event: E,
  ): Promise<void> {
    // Emit to specific event type subscribers
    this.emitter.emit(event.type, event);

    // Also emit to wildcard subscribers (for logging/analytics)
    this.emitter.emit("*", event);
  }

  /**
   * Get all registered handlers (for debugging/testing)
   */
  getHandlers(
    eventType?: EventType | "*",
  ): Map<EventType | "*", EventHandler[]> {
    if (eventType) {
      const result = new Map<EventType | "*", EventHandler[]>();
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        result.set(eventType, handlers);
      }
      return result;
    }
    return new Map(this.handlers);
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear(): void {
    this.emitter.removeAllListeners();
    this.handlers.clear();
  }
}

// Singleton instance
let eventBusInstance: EventBus | null = null;

export function createEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    throw new Error("EventBus not initialized. Call createEventBus() first.");
  }
  return eventBusInstance;
}

export function resetEventBus(): void {
  if (eventBusInstance) {
    eventBusInstance.clear();
  }
  eventBusInstance = null;
}
