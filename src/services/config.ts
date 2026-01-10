import { logger } from './logger.js';

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
];

/**
 * Validates that all required environment variables are present.
 * Logs errors for missing essential variables (DB, Redis) and
 * warnings for optional but recommended production settings.
 */
export function validateConfig() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(
      { missing },
      'Missing required environment variables. Application may not function correctly.',
    );
  }

  if (!process.env.ALLOWED_DOMAINS) {
    logger.warn(
      'ALLOWED_DOMAINS is not set. The gateway will block all requests by default or allow all if configured. Please set it for production.',
    );
  } else {
    logger.info('Environment configuration validated successfully.');
  }
}

/**
 * Centralized application configuration.
 * Parses environment variables into typed, easy-to-use properties.
 */
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  isDev: process.env.NODE_ENV !== 'production',
  allowedDomains: process.env.ALLOWED_DOMAINS
    ? process.env.ALLOWED_DOMAINS.split(',').map((d) => d.trim().toLowerCase())
    : [],
};
