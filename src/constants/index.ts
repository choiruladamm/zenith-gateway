export const HEADERS = {
  API_KEY: 'X-Zenith-Key',
  RATELIMIT_LIMIT: 'X-RateLimit-Limit',
  RATELIMIT_REMAINING: 'X-RateLimit-Remaining',
};

export const REDIS_KEYS = {
  RATELIMIT_PREFIX: 'ratelimit',
  API_KEY_CACHE_PREFIX: 'apikey_cache',
  USAGE_LOG_QUEUE: 'usage_logs_buffer',
  MONTHLY_USAGE_PREFIX: 'usage:monthly',
};

export const TIME = {
  ONE_MINUTE_IN_SECONDS: 60,
  ONE_MINUTE_IN_MS: 60000,
};
