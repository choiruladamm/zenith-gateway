import { db } from '../db/index.js';
import { usageLogs } from '../db/schema.js';
import { redis } from './redis.js';
import { REDIS_KEYS } from '../constants/index.js';
import { logger } from './logger.js';

const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 10000;

/**
 * Initializes and starts the background worker for asynchronous log processing.
 *
 * The worker runs a periodic cycle (default 10s) to:
 * 1. Read all accumulated usage logs from the Redis queue (`usage_logs_buffer`).
 * 2. Parse the JSON log data and perform a bulk insert into the PostgreSQL `usage_logs` table.
 * 3. Atomically trim the Redis queue to remove only the processed entries.
 *
 * This strategy decouples hot path request handling from slower database writes,
 * ensuring high throughput for the gateway proxy.
 */
export const startWorker = () => {
  logger.info('Zenith Background Worker started');

  setInterval(async () => {
    if (!redis) return;

    try {
      const queueSize = await redis.llen(REDIS_KEYS.USAGE_LOG_QUEUE);
      if (queueSize === 0) return;

      logger.debug({ queue_size: queueSize }, 'Processing usage logs batch');

      const rawLogs = await redis.lrange(REDIS_KEYS.USAGE_LOG_QUEUE, 0, -1);

      if (rawLogs.length === 0) return;

      const logs = rawLogs.map((log: any) => JSON.parse(log));

      await db.insert(usageLogs).values(logs);

      await redis.ltrim(REDIS_KEYS.USAGE_LOG_QUEUE, rawLogs.length, -1);

      logger.info(
        { count: logs.length },
        'Successfully flushed usage logs to DB',
      );
    } catch (err: any) {
      logger.error({ error: err.message }, 'Worker Error during flushing logs');
    }
  }, FLUSH_INTERVAL_MS);
};
