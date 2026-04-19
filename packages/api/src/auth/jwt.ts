/**
 * JWT Token Utilities
 *
 * Handles JWT token generation, verification, and refresh token logic
 */

import { createHmac, randomBytes } from "crypto";

export interface JWTPayload {
  userId: string;
  workspaceId?: string;
  iat: number;
  exp: number;
  type: "access" | "refresh";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * JWT Configuration
 */
export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || "dev-secret-key-change-in-production",
  accessTokenExpiry: parseInt(process.env.JWT_ACCESS_EXPIRY || "900"), // 15 minutes
  refreshTokenExpiry: parseInt(process.env.JWT_REFRESH_EXPIRY || "604800"), // 7 days
  algorithm: "HS256",
} as const;

/**
 * Encode JWT token (simplified implementation)
 * In production, use 'jsonwebtoken' library
 */
export function encodeJWT(payload: JWTPayload): string {
  // Header
  const header = Buffer.from(
    JSON.stringify({ alg: JWT_CONFIG.algorithm, typ: "JWT" }),
  ).toString("base64url");

  // Payload
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  // Signature
  const message = `${header}.${encodedPayload}`;
  const signature = createHmac("sha256", JWT_CONFIG.secret)
    .update(message)
    .digest("base64url");

  return `${message}.${signature}`;
}

/**
 * Decode and verify JWT token
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const message = `${headerB64}.${payloadB64}`;
    const expectedSignature = createHmac("sha256", JWT_CONFIG.secret)
      .update(message)
      .digest("base64url");

    if (signatureB64 !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload: JWTPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Generate access token
 */
export function generateAccessToken(
  userId: string,
  workspaceId?: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    userId,
    workspaceId,
    iat: now,
    exp: now + JWT_CONFIG.accessTokenExpiry,
    type: "access",
  };

  return encodeJWT(payload);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    userId,
    iat: now,
    exp: now + JWT_CONFIG.refreshTokenExpiry,
    type: "refresh",
  };

  return encodeJWT(payload);
}

/**
 * Generate token pair (access + refresh)
 */
export function generateTokenPair(
  userId: string,
  workspaceId?: string,
): TokenPair {
  return {
    accessToken: generateAccessToken(userId, workspaceId),
    refreshToken: generateRefreshToken(userId),
    expiresIn: JWT_CONFIG.accessTokenExpiry,
  };
}

/**
 * Extract token from Bearer header
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Generate a secure refresh token ID for token rotation
 */
export function generateRefreshTokenId(): string {
  return randomBytes(32).toString("hex");
}
