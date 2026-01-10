import { db } from '../src/db/index.js';
import { apiKeys, organizations, plans } from '../src/db/schema.js';
import { hashApiKey } from '../src/utils/crypto.js';
import { randomBytes } from 'crypto';

async function generateLimitedKey() {
  const randomPart = randomBytes(8).toString('hex');
  const newKey = `zenith_tiny_${randomPart}`;
  const keyHash = await hashApiKey(newKey);

  try {
    const [org] = await db.select().from(organizations).limit(1);

    // Insert a very limited plan
    const [tinyPlan] = await db
      .insert(plans)
      .values({
        name: `Tiny-${randomPart}`,
        rate_limit_per_min: 100, // High enough so we don't hit rate limit first
        monthly_quota: 5, // Only 5 requests allowed
        price_per_1k_req: '1.00',
        allowed_paths: ['*'],
      })
      .returning();

    await db.insert(apiKeys).values({
      org_id: org.id,
      plan_id: tinyPlan.id,
      key_hash: keyHash,
      hint: 'limited_test',
      status: 'active',
    });

    console.log(newKey);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to generate limited key:', error);
    process.exit(1);
  }
}

generateLimitedKey();
