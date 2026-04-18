import express from 'express';
import winston from 'winston';
import { prisma } from '@pms/database';
import { createErrorHandler, createLoggerMiddleware, createCorsMiddleware } from './middleware';
import { createRoutes } from './routes';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(createCorsMiddleware(['localhost', '127.0.0.1']));
app.use(createLoggerMiddleware(logger));

// Routes
app.use('/', createRoutes(prisma));

// Error handler (must be last)
app.use(createErrorHandler());

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 API server running on port ${PORT}`);
});

export default app;
export { logger };
