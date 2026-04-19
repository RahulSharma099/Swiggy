/**
 * Shared Authentication Utilities for k6 Load Tests
 *
 * Provides JWT token generation and auth helpers for all load test scenarios
 */

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_PATH = '/auth/login';

// Cache for tokens to avoid re-authentication on every request
const tokenCache = {};
const TOKEN_CACHE_DURATION = 60000; // Cache tokens for 1 minute (access tokens expire in 15 min)

/**
 * Authenticate and get JWT tokens
 * Caches tokens per VU to avoid excessive login requests
 */
export function getAuthToken(userId) {
  const cacheKey = `token_${userId}`;
  const now = Date.now();

  // Return cached token if still valid
  if (tokenCache[cacheKey] && tokenCache[cacheKey].expiresAt > now) {
    return tokenCache[cacheKey].accessToken;
  }

  const payload = JSON.stringify({
    userId: userId,
    workspaceId: `workspace-${userId}`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}${AUTH_PATH}`, payload, params);

  check(res, {
    'auth status 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      const accessToken = body.data.accessToken;
      const expiresIn = body.data.expiresIn || 900; // Default 15 minutes

      // Cache the token
      tokenCache[cacheKey] = {
        accessToken: accessToken,
        expiresAt: now + (expiresIn * 1000 * 0.9), // Refresh at 90% of expiry
      };

      return accessToken;
    } catch (e) {
      console.error('Failed to parse auth response:', e);
      return null;
    }
  }

  return null;
}

/**
 * Get auth headers with JWT token
 */
export function getAuthHeaders(userId) {
  const token = getAuthToken(userId);

  if (!token) {
    return {
      'Content-Type': 'application/json',
    };
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Get Bearer token string with JWT
 */
export function getBearerToken(userId) {
  const token = getAuthToken(userId);
  return token ? `Bearer ${token}` : '';
}

/**
 * Clear token cache (useful for token refresh testing)
 */
export function clearTokenCache() {
  for (const key in tokenCache) {
    delete tokenCache[key];
  }
}

/**
 * Get token expiry time in seconds
 */
export function getTokenExpirySeconds(userId) {
  const cacheKey = `token_${userId}`;
  if (tokenCache[cacheKey]) {
    const now = Date.now();
    const timeLeft = tokenCache[cacheKey].expiresAt - now;
    return Math.max(0, Math.floor(timeLeft / 1000));
  }
  return 0;
}
