/**
 * API Versioning Handler
 *
 * Middleware and utilities for handling API versioning
 * Supports URL-based versioning (/api/v1, /api/v2, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';

export interface VersionConfig {
  version: string;
  deprecated?: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  successor?: string;
}

export interface VersionedRequest extends Request {
  apiVersion?: string;
  versionConfig?: VersionConfig;
}

/**
 * Version registry to track API versions
 */
export class VersionRegistry {
  private versions = new Map<string, VersionConfig>();

  register(version: string, config: Partial<VersionConfig> = {}) {
    this.versions.set(version, {
      version,
      deprecated: false,
      ...config,
    });
  }

  get(version: string): VersionConfig | undefined {
    return this.versions.get(version);
  }

  getLatest(): string | undefined {
    return Array.from(this.versions.keys()).sort().pop();
  }

  isDeprecated(version: string): boolean {
    return this.versions.get(version)?.deprecated ?? false;
  }

  listVersions(): VersionConfig[] {
    return Array.from(this.versions.values());
  }
}

/**
 * Parse version from request URL
 * Supports: /api/v1, /api/v2, etc.
 */
export function parseVersion(pathname: string): string | null {
  const match = pathname.match(/\/api\/v(\d+)\//);
  return match ? `v${match[1]}` : null;
}

/**
 * Middleware to extract and validate API version
 */
export function createVersionMiddleware(
  registry: VersionRegistry,
  options: {
    defaultToLatest?: boolean;
    requireExplicitVersion?: boolean;
  } = {}
) {
  const { defaultToLatest = true, requireExplicitVersion = false } = options;

  return (req: VersionedRequest, res: Response, next: NextFunction) => {
    const version = parseVersion(req.path);

    if (!version) {
      if (requireExplicitVersion) {
        return res.status(400).json({
          error: 'Version Required',
          message: 'Please specify an API version (e.g., /api/v1/...)',
          availableVersions: registry.listVersions().map((v) => v.version),
        });
      }

      if (defaultToLatest) {
        const latest = registry.getLatest();
        if (latest) {
          req.apiVersion = latest;
          req.versionConfig = registry.get(latest);
          // Note: This doesn't redirect, just sets the version context
        }
      }
      return next();
    }

    const config = registry.get(version);
    if (!config) {
      return res.status(404).json({
        error: 'Version Not Found',
        message: `API version ${version} is not supported`,
        availableVersions: registry.listVersions().map((v) => v.version),
      });
    }

    req.apiVersion = version;
    req.versionConfig = config;

    // Add deprecation headers if applicable
    if (config.deprecated) {
      res.setHeader('Deprecation', 'true');
      
      if (config.deprecationDate) {
        res.setHeader(
          'Deprecation-Date',
          config.deprecationDate.toISOString()
        );
      }

      if (config.sunsetDate) {
        res.setHeader('Sunset', config.sunsetDate.toUTCString());
      }

      const message = `API version ${version} is deprecated`;
      const successor = config.successor ? ` and will be removed. Please migrate to ${config.successor}.` : '.';
      res.setHeader('Warning', `299 - "${message}${successor}"`);
    }

    // Add version header
    res.setHeader('API-Version', version);

    next();
  };
}

/**
 * Create versioned router
 */
export class VersionedRouter {
  private routers = new Map<string, Router>();

  constructor(_registry: VersionRegistry) {
    // Registry can be used in future for validation
  }

  /**
   * Create version-specific router
   */
  createRouter(version: string): Router {
    const router = Router();
    this.routers.set(version, router);
    return router;
  }

  /**
   * Get router for version
   */
  getRouter(version: string): Router | undefined {
    return this.routers.get(version);
  }

  /**
   * Mount all version routers with Express
   */
  mount(mainRouter: Router, basePath = '/api') {
    this.routers.forEach((router, version) => {
      mainRouter.use(`${basePath}/${version}`, router);
    });
  }

  /**
   * Add middleware to specific version
   */
  useMiddleware(version: string, ...middlewares: Array<(req: any, res: any, next: any) => void>) {
    const router = this.getRouter(version);
    if (router) {
      router.use(...middlewares);
    }
  }
}

/**
 * Helper to respond with version info
 */
export function sendVersionInfo(
  res: Response,
  data: any,
  version?: string
) {
  res.json({
    version: version || res.getHeader('API-Version'),
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Middleware to transform response based on version
 */
export function createVersionTransformMiddleware(
  transformers: {
    [version: string]: (data: any) => any;
  }
) {
  return (req: VersionedRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
      if (req.apiVersion && transformers[req.apiVersion]) {
        data = transformers[req.apiVersion](data);
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Create version compatibility layer
 *
 * Map endpoints from one version to another
 * Useful for gradual API migration
 */
export function createVersionCompatibilityRouter(
  fromVersion: string,
  toVersion: string,
  routes: Array<{
    method: 'get' | 'post' | 'put' | 'delete' | 'patch';
    path: string;
    handler?: (req: any, res: any, next: any) => void;
  }>
): Router {
  const router = Router();

  routes.forEach(({ method, path, handler }) => {
    router[method](path, (req: any, res: any, next: any) => {
      // Mark that this is a compatibility route
      req.compatibilityRoute = {
        sourceVersion: fromVersion,
        targetVersion: toVersion,
      };

      // Log the deprecated route usage
      console.warn(
        `[Deprecation] ${method.toUpperCase()} ${fromVersion}${path} forwarded to ${toVersion}`
      );

      if (handler) {
        handler(req, res, next);
      } else {
        next();
      }
    });
  });

  return router;
}

/**
 * Example version registry setup
 */
export function setupVersionRegistry(): VersionRegistry {
  const registry = new VersionRegistry();

  registry.register('v1', {
    deprecated: false,
  });

  registry.register('v2', {
    deprecated: false,
    successor: 'v3',
  });

  registry.register('v3', {
    deprecated: false,
  });

  return registry;
}
