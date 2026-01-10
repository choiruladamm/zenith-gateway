import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  decimal,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  name: text('name').notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const plans = pgTable('plans', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  name: text('name').notNull().unique(),
  rate_limit_per_min: integer('rate_limit_per_min').notNull(),
  monthly_quota: bigint('monthly_quota', { mode: 'number' }).notNull(),
  price_per_1k_req: decimal('price_per_1k_req', {
    precision: 10,
    scale: 2,
  }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  org_id: uuid('org_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),
  key_hash: text('key_hash').notNull().unique(),
  hint: text('hint').notNull(),
  status: text('status').notNull().default('active'),
  plan_id: uuid('plan_id').references(() => plans.id),
  created_at: timestamp('created_at').defaultNow(),
});

export const usageLogs = pgTable('usage_logs', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  key_id: uuid('key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull().default('GET'),
  status_code: integer('status_code').notNull(),
  latency_ms: integer('latency_ms').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});
