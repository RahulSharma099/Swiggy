import { Request, Response, NextFunction } from "express";
import { generateCorrelationId } from "../domain/events";

/**
 * Correlation ID Middleware
 *
 * Adds correlation ID to request for distributed tracing across services.
 * If client provides x-correlation-id header, it's reused (for tracing across multiple requests).
 * Otherwise, a new correlation ID is generated.
 *
 * The correlation ID is:
 * - Added to response headers (x-correlation-id)
 * - Attached to request context (for use in services/repositories)
 */
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Check if client provided correlation ID (for tracing chains)
  const providedCorrelationId = req.headers["x-correlation-id"] as string;
  const correlationId = providedCorrelationId || generateCorrelationId();

  // Attach to request for services to use
  (req as any).correlationId = correlationId;

  // Add to response headers so client can track
  res.setHeader("x-correlation-id", correlationId);

  // Add to request ID header for logging aggregation
  res.setHeader("x-request-id", (req as any).id || correlationId);

  next();
};

/**
 * Request timing middleware
 * Logs request duration with correlation ID
 */
export const requestTimingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId;

  // Override res.json to log timing
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    console.log({
      type: "request",
      method: req.method,
      path: req.path,
      statusCode,
      duration,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    return originalJson(body);
  };

  next();
};
