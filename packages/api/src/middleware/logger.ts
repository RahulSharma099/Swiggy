import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

/**
 * Create logger middleware for request logging
 */
export const createLoggerMiddleware = (logger: winston.Logger) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Log request
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    });

    // Intercept response to log it
    const originalSend = res.send.bind(res);
    res.send = function (data: any) {
      const duration = Date.now() - startTime;
      logger.info('Outgoing response', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
      return originalSend(data);
    };

    next();
  };
};
