import { randomBytes } from "crypto";

/**
 * Generate a unique event ID
 * Used for deduplication and event sourcing
 */
export function generateEventId(): string {
  return `evt-${Date.now()}-${randomBytes(12).toString("hex")}`;
}

/**
 * Generate a correlation ID for tracing related events
 * Typically generated at request entry point and propagated through event chain
 */
export function generateCorrelationId(): string {
  return `cor-${Date.now()}-${randomBytes(8).toString("hex")}`;
}

/**
 * Build request context with correlation ID
 * This should be created in middleware and passed through the request
 */
export interface RequestContext {
  correlationId: string;
  userId: string;
  workspaceId: string;
  requestId: string;
  timestamp: Date;
}

export function createRequestContext(
  userId: string,
  workspaceId: string,
  correlationId?: string,
): RequestContext {
  return {
    correlationId: correlationId || generateCorrelationId(),
    userId,
    workspaceId,
    requestId: generateEventId(),
    timestamp: new Date(),
  };
}
