import { Context, Next } from 'hono';
import { problems } from '../utils/problems.js';
import { logger } from '../services/logger.js';
import { Variables } from '../types/index.js';

/**
 * Middleware that enforces path-based access control based on the API key's plan.
 *
 * Access logic:
 * 1. Allows access if 'allowed_paths' is null or contains '*' (unrestricted).
 * 2. Matches the request path against the list of permitted patterns.
 * 3. Supports wildcard matching: '/v1/*' matches '/v1/users' but not '/v2/users'.
 *
 * @param c - Hono context containing 'apiKeyInfo' set by authMiddleware.
 * @param next - Next middleware in the chain.
 * @returns 403 Forbidden if path is not permitted, otherwise moves to next middleware.
 */
export const accessMiddleware = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const apiKeyInfo = c.get('apiKeyInfo');
  const allowedPaths = apiKeyInfo?.plans?.allowed_paths;

  // Unrestricted access (default)
  if (
    !allowedPaths ||
    allowedPaths.length === 0 ||
    allowedPaths.includes('*')
  ) {
    return await next();
  }

  // Extract the target path relative to /proxy/
  // Example: c.req.path = '/proxy/v1/users' -> targetPath = '/v1/users'
  const rawPath = c.req.path;
  const targetPath = rawPath.replace(/^\/proxy/, '') || '/';

  const isAllowed = allowedPaths.some((pattern) => {
    // Exact match
    if (pattern === targetPath) return true;

    // Wildcard match (e.g., /v1/*)
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return targetPath === prefix || targetPath.startsWith(prefix + '/');
    }

    return false;
  });

  if (!isAllowed) {
    logger.warn(
      {
        api_key_id: apiKeyInfo?.id,
        target_path: targetPath,
        allowed_paths: allowedPaths,
      },
      'Access Blocked: Path not allowed by plan',
    );

    return problems.forbidden(
      c,
      'Your current plan does not grant access to this endpoint.',
    );
  }

  await next();
};
