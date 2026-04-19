/**
 * HTTP Request Metrics Middleware
 *
 * Tracks:
 * - Request duration (histogram)
 * - Request count by method/path/status (counter)
 * - Error rate (counter)
 * - Active requests (gauge)
 */

import { Request, Response, NextFunction } from "express";
import { MetricsCollector } from "./metrics";

let activeRequests = 0;

export function createRequestMetricsMiddleware(metrics: MetricsCollector) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Track active requests
    activeRequests++;
    const requestCount = activeRequests;
    metrics.setGauge("http_requests_active", requestCount);

    // Extract request info
    const method = req.method;
    const path = req.path;

    // Track request initiated
    metrics.incrementCounter("http_requests_received_total", {
      method,
      path: normalizePath(path),
    });

    // Override res.end to capture status code and duration
    const originalEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
      // Calculate request duration
      const duration = Date.now() - startTime;
      const status = res.statusCode.toString();

      // Track metrics
      metrics.recordHistogram("http_request_duration_ms", duration, {
        method,
        path: normalizePath(path),
        status,
      });

      metrics.incrementCounter("http_responses_total", {
        method,
        path: normalizePath(path),
        status,
      });

      // Track errors
      if (res.statusCode >= 400) {
        metrics.incrementCounter("http_errors_total", {
          method,
          path: normalizePath(path),
          status,
        });
      }

      // Decrement active requests
      activeRequests--;
      metrics.setGauge("http_requests_active", activeRequests);

      // Call original end
      return originalEnd(...args);
    };

    next();
  };
}

/**
 * Normalize path to avoid cardinality explosion
 * Converts /api/issues/123 => /api/issues/:id
 */
function normalizePath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      // Check if segment looks like an ID (UUID or number)
      if (/^[0-9a-f-]+$/.test(segment) || /^\d+$/.test(segment)) {
        return ":id";
      }
      return segment;
    })
    .join("/");
}
