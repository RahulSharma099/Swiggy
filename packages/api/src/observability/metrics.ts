/**
 * Prometheus Metrics Collection
 *
 * Collects application metrics in Prometheus format
 * Includes: HTTP, Database, WebSocket, Business, Event metrics
 */

/**
 * Simple metrics registry
 * In production, use 'prom-client' library for full Prometheus support
 */
export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Add a histogram value
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
  }

  /**
   * Start a timer
   */
  startTimer(name: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.recordHistogram(name, duration);
    };
  }

  /**
   * Get all metrics in Prometheus text format
   */
  getAllMetrics(): string {
    let output = '';

    // Counters
    output += '# HELP http_requests_total Total HTTP requests\n';
    output += '# TYPE http_requests_total counter\n';
    for (const [key, value] of this.counters) {
      if (key.includes('http_')) {
        output += `${key} ${value}\n`;
      }
    }

    // Other counters
    output += '# HELP issues_created_total Total issues created\n';
    output += '# TYPE issues_created_total counter\n';
    for (const [key, value] of this.counters) {
      if (key.includes('issue_')) {
        output += `${key} ${value}\n`;
      }
    }

    output += '# HELP events_published_total Total events published\n';
    output += '# TYPE events_published_total counter\n';
    for (const [key, value] of this.counters) {
      if (key.includes('event_')) {
        output += `${key} ${value}\n`;
      }
    }

    // Gauges
    output += '# HELP websocket_connections_active Active WebSocket connections\n';
    output += '# TYPE websocket_connections_active gauge\n';
    for (const [key, value] of this.gauges) {
      if (key.includes('websocket_')) {
        output += `${key} ${value}\n`;
      }
    }

    output += '# HELP db_pool_connections_active Active database connections\n';
    output += '# TYPE db_pool_connections_active gauge\n';
    for (const [key, value] of this.gauges) {
      if (key.includes('db_')) {
        output += `${key} ${value}\n`;
      }
    }

    // Histograms (percentiles)
    output += '# HELP request_duration_milliseconds HTTP request duration\n';
    output += '# TYPE request_duration_milliseconds histogram\n';
    for (const [key, values] of this.histograms) {
      if (key.includes('request_duration')) {
        const sorted = values.sort((a, b) => a - b);

        output += `${key}_bucket{le="100"} ${sorted.filter((v) => v <= 100).length}\n`;
        output += `${key}_bucket{le="500"} ${sorted.filter((v) => v <= 500).length}\n`;
        output += `${key}_bucket{le="1000"} ${sorted.filter((v) => v <= 1000).length}\n`;
        output += `${key}_count ${sorted.length}\n`;
        output += `${key}_sum ${sorted.reduce((a, b) => a + b, 0)}\n`;
      }
    }

    output += '# HELP query_duration_milliseconds Database query duration\n';
    output += '# TYPE query_duration_milliseconds histogram\n';
    for (const [key, values] of this.histograms) {
      if (key.includes('query_duration')) {
        const sorted = values.sort((a, b) => a - b);

        output += `${key}_bucket{le="10"} ${sorted.filter((v) => v <= 10).length}\n`;
        output += `${key}_bucket{le="50"} ${sorted.filter((v) => v <= 50).length}\n`;
        output += `${key}_bucket{le="100"} ${sorted.filter((v) => v <= 100).length}\n`;
        output += `${key}_count ${sorted.length}\n`;
        output += `${key}_sum ${sorted.reduce((a, b) => a + b, 0)}\n`;
      }
    }

    return output;
  }

  /**
   * Get formatted metrics for JSON response
   */
  getMetricsJSON(): Record<string, any> {
    const metrics: Record<string, any> = {
      counters: {},
      gauges: {},
      histograms: {},
    };

    for (const [key, value] of this.counters) {
      metrics.counters[key] = value;
    }

    for (const [key, value] of this.gauges) {
      metrics.gauges[key] = value;
    }

    for (const [key, values] of this.histograms) {
      const sorted = values.sort((a, b) => a - b);
      metrics.histograms[key] = {
        count: sorted.length,
        sum: sorted.reduce((a, b) => a + b, 0),
        min: sorted[0],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        max: sorted[sorted.length - 1],
      };
    }

    return metrics;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Build metric key with labels
   */
  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${name}{${labelStr}}`;
  }
}

// Singleton instance
let metricsInstance: MetricsCollector | null = null;

export function createMetricsCollector(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}

export function getMetricsCollector(): MetricsCollector {
  if (!metricsInstance) {
    throw new Error('MetricsCollector not initialized. Call createMetricsCollector() first.');
  }
  return metricsInstance;
}

export function resetMetricsCollector(): void {
  if (metricsInstance) {
    metricsInstance.reset();
  }
}
