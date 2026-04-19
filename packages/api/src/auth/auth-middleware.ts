/**
 * JWT Authentication Middleware
 *
 * Verifies JWT tokens and extracts user information
 */

import { Request, Response, NextFunction } from "express";
import { decodeJWT, extractToken, JWTPayload } from "./jwt";

/**
 * Extended Express Request with JWT payload
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  userId?: string;
  workspaceId?: string;
}

/**
 * JWT verification middleware
 * Verifies JWT token from Authorization header
 */
export function createJWTMiddleware() {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({ error: "No authorization token provided" });
      return;
    }

    const payload = decodeJWT(token);

    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Ensure token is access token, not refresh token
    if (payload.type !== "access") {
      res.status(401).json({ error: "Invalid token type" });
      return;
    }

    // Attach to request
    req.user = payload;
    req.userId = payload.userId;
    req.workspaceId = payload.workspaceId;

    next();
  };
}

/**
 * Optional JWT middleware
 * Doesn't fail if token is missing, but extracts if present
 */
export function createOptionalJWTMiddleware() {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): void => {
    const token = extractToken(req.headers.authorization);

    if (token) {
      const payload = decodeJWT(token);
      if (payload && payload.type === "access") {
        req.user = payload;
        req.userId = payload.userId;
        req.workspaceId = payload.workspaceId;
      }
    }

    next();
  };
}

/**
 * Role-based access control middleware factory
 * (for future implementation with user roles)
 */
export function requireRole(_roles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // TODO: Implement role checking when user roles are added
    // For now, just check authenticated
    next();
  };
}

/**
 * Workspace access control middleware
 * Ensures user has access to requested workspace
 */
export function requireWorkspaceAccess() {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const requestedWorkspaceId =
      req.params.workspaceId || req.query.workspaceId;

    // If workspace is specified in request and doesn't match token, deny access
    if (
      requestedWorkspaceId &&
      req.user.workspaceId &&
      requestedWorkspaceId !== req.user.workspaceId
    ) {
      res.status(403).json({ error: "Access denied to this workspace" });
      return;
    }

    next();
  };
}
