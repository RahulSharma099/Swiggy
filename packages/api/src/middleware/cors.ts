import { Request, Response, NextFunction } from 'express';

/**
 * Create CORS middleware
 */
export const createCorsMiddleware = (allowedOrigins: string[] = ['localhost:3000']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.get('origin');

    // Check if origin is allowed
    if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  };
};
