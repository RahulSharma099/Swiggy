/**
 * Metrics Routes
 *
 * Exposes metrics endpoints:
 * - GET /metrics - Prometheus format metrics
 * - GET /metrics/json - JSON format metrics
 * - GET /metrics/events - Event system metrics summary
 */

import { Router, Response } from "express";
import { MetricsCollector } from "./metrics";
import { getEventMetricsSummary } from "./event-metrics";

export function createMetricsRoutes(metrics: MetricsCollector): Router {
  const router = Router();

  /**
   * GET /metrics
   * Prometheus text format metrics
   * Used by Prometheus scraper
   */
  router.get("/", (_req, res: Response) => {
    res.set("Content-Type", "text/plain; version=0.0.4");
    res.send(metrics.getAllMetrics());
  });

  /**
   * GET /metrics/json
   * JSON format metrics
   * Easier to parse in custom dashboards
   */
  router.get("/json", (_req, res: Response) => {
    const metricsData = metrics.getMetricsJSON();

    res.json({
      timestamp: new Date().toISOString(),
      metrics: metricsData,
    });
  });

  /**
   * GET /metrics/events
   * Event system specific metrics
   */
  router.get("/events", (_req, res: Response) => {
    const eventMetrics = getEventMetricsSummary(metrics);

    res.json({
      timestamp: new Date().toISOString(),
      event_metrics: eventMetrics,
    });
  });

  /**
   * GET /metrics/summary
   * High-level system metrics summary
   */
  router.get("/summary", (_req, res: Response) => {
    const allMetrics = metrics.getMetricsJSON();

    // Calculate summary statistics
    const summary: Record<string, any> = {
      timestamp: new Date().toISOString(),
      counters: {
        total_http_requests: 0,
        total_events_published: 0,
        total_handler_errors: 0,
      },
      gauges: {
        active_websocket_connections: 0,
        registered_event_handlers: 0,
      },
      histograms: {
        request_latency: {
          count: 0,
          avg: 0,
        },
        handler_latency: {
          count: 0,
          avg: 0,
        },
      },
    };

    // Aggregate counter data
    for (const [key, value] of Object.entries(allMetrics.counters || {})) {
      if (key.includes("http_")) summary.counters.total_http_requests += value;
      if (key.includes("event_") && key.includes("published"))
        summary.counters.total_events_published += value;
      if (key.includes("error")) summary.counters.total_handler_errors += value;
    }

    // Aggregate gauge data
    for (const [key, value] of Object.entries(allMetrics.gauges || {})) {
      if (key.includes("websocket"))
        summary.gauges.active_websocket_connections = value;
      if (key.includes("handler"))
        summary.gauges.registered_event_handlers = value;
    }

    // Aggregate histogram data
    for (const [key, val] of Object.entries(allMetrics.histograms || {})) {
      const hist = val as any;
      if (key.includes("request_duration") && hist && hist.count) {
        summary.histograms.request_latency.count = hist.count;
        summary.histograms.request_latency.avg = hist.sum / hist.count;
      }
      if (key.includes("event_handler_duration") && hist && hist.count) {
        summary.histograms.handler_latency.count = hist.count;
        summary.histograms.handler_latency.avg = hist.sum / hist.count;
      }
    }

    res.json(summary);
  });

  return router;
}
