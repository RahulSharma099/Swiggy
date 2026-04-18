import { Request, Response } from 'express';

/**
 * Health check handler
 */
export const createHealthCheckHandler = () => {
  return (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
    });
  };
};
