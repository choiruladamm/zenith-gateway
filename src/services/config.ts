import { logger } from './logger.js';

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
];

export function validateConfig() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(
      { missing },
      'Missing required environment variables. Application may not function correctly.',
    );
    // In a real production app, we might want to exit here
    // process.exit(1);
  } else {
    logger.info('Environment configuration validated successfully.');
  }
}

export const config = {
  port: process.env.PORT || 3000,
  isDev: process.env.NODE_ENV !== 'production',
};
