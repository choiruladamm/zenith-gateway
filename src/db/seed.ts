import 'dotenv/config';
import { db } from './index.js';
import { organizations, plans, apiKeys, usageLogs } from './schema.js';
import { hashApiKey } from '../utils/crypto.js';
import { logger } from '../services/logger.js';
import { sql } from 'drizzle-orm';

async function seed() {
  logger.info('🌱 Starting database seeding...');

  try {
    await db.execute(
      sql`TRUNCATE TABLE usage_logs, api_keys, organizations, plans CASCADE`,
    );
    logger.info('✅ Database cleaned successfully.');

    const insertedPlans = await db
      .insert(plans)
      .values([
        {
          name: 'Basic',
          rate_limit_per_min: 60,
          monthly_quota: 10000,
          price_per_1k_req: '0.50',
          allowed_paths: ['*'],
        },
        {
          name: 'Pro',
          rate_limit_per_min: 1000,
          monthly_quota: 1000000,
          price_per_1k_req: '0.10',
          allowed_paths: ['*'],
        },
        {
          name: 'Enterprise',
          rate_limit_per_min: 10000,
          monthly_quota: 100000000,
          price_per_1k_req: '0.05',
          allowed_paths: ['*'],
        },
      ])
      .returning();

    const basicPlan = insertedPlans.find((p) => p.name === 'Basic');

    if (!basicPlan) {
      throw new Error('Failed to create Basic plan');
    }

    const [defaultOrg] = await db
      .insert(organizations)
      .values({
        name: 'Zenith Labs',
      })
      .returning();

    const testKey = 'zenith_test_key_123';
    const keyHash = await hashApiKey(testKey);

    await db
      .insert(apiKeys)
      .values({
        org_id: defaultOrg.id,
        plan_id: basicPlan.id,
        key_hash: keyHash,
        hint: 'zenith_test',
        status: 'active',
      })
      .onConflictDoNothing();

    logger.info('✅ Seeding completed successfully!');
    logger.info({ test_key: testKey }, 'Seeding details');
    process.exit(0);
  } catch (error) {
    logger.error(error, '❌ Seeding failed');
    process.exit(1);
  }
}

seed();
