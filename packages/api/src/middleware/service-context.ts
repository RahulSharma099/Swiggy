import { Request } from "express";

/**
 * Service context helper
 * Extracts request context (userId, workspaceId, correlationId) for passing to services
 */
export interface ServiceContext {
  userId: string;
  workspaceId?: string;
  correlationId?: string;
  projectId?: string;
}

export function extractServiceContext(req: Request): ServiceContext {
  return {
    userId: (req as any).userId,
    workspaceId: (req as any).workspaceId,
    correlationId: (req as any).correlationId,
    projectId: (req as any).projectId,
  };
}
