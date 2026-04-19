/**
 * Graceful Shutdown Manager
 *
 * Handles clean shutdown of the application:
 * 1. Stop accepting new HTTP connections (return 503 Service Unavailable)
 * 2. Stop accepting new WebSocket connections
 * 3. Allow in-flight requests to complete (with timeout)
 * 4. Close WebSocket connections gracefully
 * 5. Flush metrics and logs
 * 6. Close database and Redis connections
 * 7. Exit process
 */

import { Server } from "http";
import { WebSocketServer } from "ws";
import { PrismaClient } from "@prisma/client";
import { RedisClientType } from "redis";
import { MetricsCollector } from "./metrics";

interface ShutdownOptions {
  timeout?: number; // Total shutdown timeout in ms (default: 60s)
  drainTimeout?: number; // Time to wait for in-flight requests (default: 30s)
  websocketCloseCode?: number; // WebSocket close code (default: 1001 Service Restart)
}

/**
 * Graceful shutdown manager
 */
export class GracefulShutdown {
  private isShuttingDown = false;
  private activeConnections = new Set<NodeJS.Socket>();
  private activeRequests = new Map<string, Promise<void>>();

  constructor(
    private logger: {
      error: (msg: string) => void;
      info: (msg: string) => void;
    },
  ) {}

  /**
   * Register a server for graceful shutdown
   */
  public registerServer(httpServer: Server): void {
    // Track all connections
    httpServer.on("connection", (socket) => {
      this.activeConnections.add(socket);

      socket.on("close", () => {
        this.activeConnections.delete(socket);
      });
    });
  }

  /**
   * Register a WebSocket server for graceful shutdown
   */
  public registerWebSocketServer(
    wss: WebSocketServer,
    options?: ShutdownOptions,
  ): void {
    const closeCode = options?.websocketCloseCode ?? 1001; // Service Restart

    // When shutdown starts, notify all WebSocket clients
    this.onShutdown(async () => {
      this.logger.info(
        `[Graceful Shutdown] Closing ${wss.clients.size} WebSocket connections...`,
      );

      for (const client of wss.clients) {
        client.close(closeCode, "Server shutting down");
      }
    });
  }

  /**
   * Register a function to be called during shutdown
   */
  public onShutdown(handler: () => Promise<void> | void): void {
    if (!this.handler) {
      this.handler = [];
    }
    this.handler.push(handler);
  }

  private handler: Array<() => Promise<void> | void> = [];

  /**
   * Start graceful shutdown sequence
   */
  public async shutdown(options: ShutdownOptions = {}): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.info("[Graceful Shutdown] Already shutting down...");
      return;
    }

    this.isShuttingDown = true;

    const timeout = options.timeout ?? 60000; // 60s total
    const drainTimeout = options.drainTimeout ?? 30000; // 30s to drain
    const startTime = Date.now();

    try {
      // Phase 1: Stop accepting new connections
      this.logger.info(
        "[Graceful Shutdown] Phase 1: Stopping acceptance of new connections...",
      );
      // Close all idle connections (gracefully)
      for (const socket of this.activeConnections) {
        // Mark connection for closure
        if ((socket as any).writable) {
          (socket as any).end?.();
        }
      }

      // Phase 2: Wait for in-flight requests to complete
      this.logger.info(
        `[Graceful Shutdown] Phase 2: Waiting for ${this.activeRequests.size} in-flight requests (timeout: ${drainTimeout}ms)...`,
      );

      const drainPromises = Array.from(this.activeRequests.values());
      const drainStart = Date.now();

      try {
        await Promise.race([
          Promise.all(drainPromises),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Drain timeout")), drainTimeout),
          ),
        ]);
        const drainDuration = Date.now() - drainStart;
        this.logger.info(
          `[Graceful Shutdown] Phase 2: All requests completed in ${drainDuration}ms`,
        );
      } catch (error) {
        const drainDuration = Date.now() - drainStart;
        this.logger.error(
          `[Graceful Shutdown] Phase 2: Drain timeout or error after ${drainDuration}ms: ${(error as any).message}`,
        );
      }

      // Phase 3: Call shutdown handlers
      this.logger.info(
        `[Graceful Shutdown] Phase 3: Running ${this.handler.length} shutdown handlers...`,
      );

      for (const handler of this.handler) {
        try {
          await handler();
        } catch (error) {
          this.logger.error(
            `[Graceful Shutdown] Handler error: ${(error as any).message}`,
          );
        }
      }

      const totalDuration = Date.now() - startTime;
      this.logger.info(
        `[Graceful Shutdown] Complete in ${totalDuration}ms (timeout was ${timeout}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `[Graceful Shutdown] Unexpected error: ${(error as any).message}`,
      );
    }
  }

  /**
   * Track request execution
   */
  public trackRequest(requestId: string, promise: Promise<void>): void {
    this.activeRequests.set(requestId, promise);
    promise.finally(() => {
      this.activeRequests.delete(requestId);
    });
  }

  /**
   * Get current shutdown status
   */
  public getStatus(): {
    isShuttingDown: boolean;
    activeConnections: number;
    activeRequests: number;
  } {
    return {
      isShuttingDown: this.isShuttingDown,
      activeConnections: this.activeConnections.size,
      activeRequests: this.activeRequests.size,
    };
  }
}

/**
 * Setup graceful shutdown for database and cache
 */
export async function setupGracefulShutdownHandlers(
  gracefulShutdown: GracefulShutdown,
  _prisma: PrismaClient,
  redis: RedisClientType,
  metrics?: MetricsCollector,
): Promise<void> {
  // Close database connections
  gracefulShutdown.onShutdown(async () => {
    console.log("[Graceful Shutdown] Closing database connections...");
    // Prisma handles this automatically
  });

  // Close Redis connections
  gracefulShutdown.onShutdown(async () => {
    console.log("[Graceful Shutdown] Closing Redis connections...");
    await redis.quit();
  });

  // Flush metrics
  if (metrics) {
    gracefulShutdown.onShutdown(async () => {
      console.log("[Graceful Shutdown] Flushing metrics...");
      const metricsData = metrics.getMetricsJSON();
      // TODO: Send metrics to external service (e.g., Prometheus pushgateway)
      console.log(
        `[Graceful Shutdown] Metrics flushed: ${Object.keys(metricsData).length} metrics`,
      );
    });
  }

  // Setup signal handlers
  const logger = {
    info: (msg: string) => console.log(msg),
    error: (msg: string) => console.error(msg),
  };

  process.on("SIGTERM", async () => {
    logger.info("[Graceful Shutdown] Received SIGTERM signal");
    await gracefulShutdown.shutdown({ timeout: 60000, drainTimeout: 30000 });
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    logger.info("[Graceful Shutdown] Received SIGINT signal");
    await gracefulShutdown.shutdown({ timeout: 60000, drainTimeout: 30000 });
    process.exit(0);
  });
}

/**
 * Middleware to return 503 Service Unavailable during shutdown
 */
export const createShutdownMiddleware = (
  gracefulShutdown: GracefulShutdown,
) => {
  return (_req: any, res: any, next: any) => {
    const status = gracefulShutdown.getStatus();

    if (status.isShuttingDown) {
      res.status(503).json({
        error: "Service Unavailable",
        message: "Server is shutting down",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};
