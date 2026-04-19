/**
 * Authentication Routes
 *
 * POST /auth/login     - Authenticate user and get token pair
 * POST /auth/refresh   - Refresh expired access token
 * POST /auth/logout    - Logout and invalidate refresh token
 */

import { Router, Request, Response } from "express";
import { generateTokenPair, decodeJWT } from "./jwt";
import { createJWTMiddleware, AuthenticatedRequest } from "./auth-middleware";

export function createAuthRoutes(): Router {
  const router = Router();

  /**
   * POST /auth/login
   *
   * Authenticate user and return token pair
   *
   * Request:
   * {
   *   "userId": "user-123",
   *   "workspaceId": "workspace-456"  // optional
   * }
   *
   * Response:
   * {
   *   "accessToken": "eyJhbGc...",
   *   "refreshToken": "eyJhbGc...",
   *   "expiresIn": 900,
   *   "user": {
   *     "userId": "user-123",
   *     "workspaceId": "workspace-456"
   *   }
   * }
   */
  router.post("/login", async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, workspaceId, password } = req.body;

      // Validation
      if (!userId) {
        res.status(400).json({ error: "userId is required" });
        return;
      }

      // TODO: In production, verify credentials against user database
      // For now, accept any userId (development mode)
      if (process.env.NODE_ENV === "production" && !password) {
        res.status(400).json({ error: "password is required" });
        return;
      }

      // TODO: Verify user credentials
      // const user = await getUserByEmail(email);
      // if (!user || !verifyPassword(password, user.passwordHash)) {
      //   res.status(401).json({ error: 'Invalid credentials' });
      //   return;
      // }

      // Generate token pair
      const tokens = generateTokenPair(userId, workspaceId);

      // TODO: Store refresh token in database for rotation
      // await storeRefreshToken(userId, tokens.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          user: {
            userId,
            workspaceId,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        error: "Login failed",
        details: (error as any).message,
      });
    }
  });

  /**
   * POST /auth/refresh
   *
   * Refresh access token using refresh token
   *
   * Request:
   * {
   *   "refreshToken": "eyJhbGc..."
   * }
   *
   * Response:
   * {
   *   "accessToken": "eyJhbGc...",
   *   "expiresIn": 900
   * }
   */
  router.post(
    "/refresh",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
          res.status(400).json({ error: "refreshToken is required" });
          return;
        }

        // Decode refresh token
        const payload = decodeJWT(refreshToken);

        if (!payload) {
          res.status(401).json({ error: "Invalid or expired refresh token" });
          return;
        }

        // Ensure it's a refresh token
        if (payload.type !== "refresh") {
          res.status(401).json({ error: "Invalid token type" });
          return;
        }

        // TODO: Verify refresh token is in database (not revoked)
        // const storedToken = await getRefreshToken(payload.userId);
        // if (!storedToken || storedToken.token !== refreshToken) {
        //   res.status(401).json({ error: 'Refresh token revoked' });
        //   return;
        // }

        // Generate new access token
        const newTokens = generateTokenPair(
          payload.userId,
          payload.workspaceId,
        );

        res.status(200).json({
          success: true,
          data: {
            accessToken: newTokens.accessToken,
            expiresIn: newTokens.expiresIn,
          },
        });
      } catch (error) {
        res.status(500).json({
          error: "Token refresh failed",
          details: (error as any).message,
        });
      }
    },
  );

  /**
   * POST /auth/logout
   *
   * Logout user and invalidate refresh token
   * (Requires valid access token)
   */
  router.post(
    "/logout",
    createJWTMiddleware(),
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ error: "Not authenticated" });
          return;
        }

        // TODO: Revoke refresh token in database
        // await revokeRefreshToken(req.user.userId);

        res.status(200).json({
          success: true,
          message: "Logout successful",
        });
      } catch (error) {
        res.status(500).json({
          error: "Logout failed",
          details: (error as any).message,
        });
      }
    },
  );

  /**
   * GET /auth/me
   *
   * Get current authenticated user info
   * (Requires valid access token)
   */
  router.get(
    "/me",
    createJWTMiddleware(),
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ error: "Not authenticated" });
          return;
        }

        res.status(200).json({
          success: true,
          data: {
            userId: req.user.userId,
            workspaceId: req.user.workspaceId,
            expiresAt: new Date(req.user.exp * 1000),
          },
        });
      } catch (error) {
        res.status(500).json({
          error: "Failed to get user info",
          details: (error as any).message,
        });
      }
    },
  );

  return router;
}
