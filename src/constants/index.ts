export const HEADERS = {
  API_KEY: 'X-Zenith-Key',
  RATELIMIT_LIMIT: 'X-RateLimit-Limit',
  RATELIMIT_REMAINING: 'X-RateLimit-Remaining',
};

export const REDIS_KEYS = {
  RATELIMIT_PREFIX: 'ratelimit',
};

export const TIME = {
  ONE_MINUTE_IN_SECONDS: 60,
  ONE_MINUTE_IN_MS: 60000,
};
