/**
 * Event Metrics Helper Functions
 *
 * Helper functions for tracking event system metrics
 * Track:
 * - Event count by type
 * - Handler execution time
 * - Handler errors
 */

import { MetricsCollector } from "./metrics";

/**
 * Get event metrics summary
 */
export function getEventMetricsSummary(
  _metrics: MetricsCollector,
): Record<string, any> {
  return {
    events: {
      published: 0, // Will be populated from metrics
      received: 0,
      handler_errors: 0,
      handlers_registered: 0,
    },
    websocket: {
      broadcasts: 0,
      broadcast_errors: 0,
    },
    cache: {
      invalidations: 0,
      invalidation_errors: 0,
    },
    notifications: {
      queued: 0,
      queue_errors: 0,
    },
  };
}
