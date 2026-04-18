import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, NotFoundError, ForbiddenError, ConflictError } from '@pms/shared';

/**
 * Global error handler middleware
 * Catches all errors and returns formatted JSON responses
 */
export const createErrorHandler =
  () =>
  (_err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    const err = _err instanceof Error ? _err : new AppError('UNKNOWN_ERROR', 500, 'Unknown error');

    // Determine status code based on error type
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (err instanceof ValidationError) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (err instanceof NotFoundError) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (err instanceof ForbiddenError) {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
    } else if (err instanceof ConflictError) {
      statusCode = 409;
      errorCode = 'CONFLICT';
    } else if (err instanceof AppError) {
      statusCode = err.statusCode || 500;
      errorCode = 'APP_ERROR';
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      },
    });
  };
