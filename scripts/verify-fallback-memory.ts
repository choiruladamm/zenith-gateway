import { db } from '../src/db';
import { apiKeys } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { hashApiKey } from '../src/utils/crypto';

/**
 * Verification Script for Rate Limit Fallback
 *
 * NOTE: To run this test properly, you must manually simulate a Redis failure.
 * 1. Open `src/services/redis.ts`
 * 2. Set export const redis = null;
 * 3. Restart the server.
 * 4. Run this script.
 */

// Use the existing key generation logic or fetch an existing one?
// For speed, let's just generate a valid one based on known enterprise key or generate new.
// Ideally I should reuse the logic from generate-key but simple is better here.

// I'll just use a hardcoded key that I know works or generate one.
// Actually, let's look at `scripts/gen-enterprise.ts` to see how to get a valid key easily.
// I will create a new key "zenith_fallback_test"

const API_KEY_PREFIX = 'zenith_';

async function main() {
  const key = `fallback_test_${Date.now()}`;
  const fullKey = `${API_KEY_PREFIX}${key}`;
  const hashedKey = await hashApiKey(fullKey);

  // Create a plan-less key or just assume existing plan.
  // I need a plan_id. Let's assume 'plan_free' (id 1) or similar exists.
  // I will just query the first plan.
  const plans = await db.query.plans.findMany({ limit: 1 });
  if (plans.length === 0) throw new Error('No plans found');

  // Find an existing org or create one
  let orgId = (await db.query.organizations.findFirst())?.id;
  if (!orgId) {
    orgId = crypto.randomUUID();
    const organizations = await import('../src/db/schema').then(
      (m) => m.organizations,
    );
    await db.insert(organizations).values({
      id: orgId,
      name: 'Test Org',
    });
  }

  await db.insert(apiKeys).values({
    key_hash: hashedKey,
    hint: key.substring(0, 4),
    plan_id: plans[0].id,
    org_id: orgId,
    status: 'active',
  });

  console.log(`Created test key: ${fullKey}`);

  // Now spam 120 requests
  let blockedCount = 0;
  let successCount = 0;

  for (let i = 1; i <= 150; i++) {
    try {
      const res = await fetch(
        'http://localhost:3000/proxy/jsonplaceholder.typicode.com/todos/1',
        {
          headers: { 'X-Zenith-Key': fullKey, 'Accept-Encoding': 'identity' },
        },
      );

      if (res.status === 429) {
        blockedCount++;
        // Check for specific RFC 7807 body
        const json = await res.json();
        if (
          json.type === 'https://zenith.io/probs/rate-limited' &&
          json.title === 'Rate Limit Exceeded'
        ) {
          // Good
        } else {
          console.error('Unexpected 429 body:', json);
        }
      } else if (res.status === 200) {
        successCount++;
      } else {
        console.log(`Request ${i}: Status ${res.status}`);
      }

      if (i % 20 === 0) process.stdout.write('.');
    } catch (e) {
      console.error(e);
    }
  }
  console.log('\n');
  console.log(`Sent 150 requests.`);
  console.log(`Success: ${successCount}`);
  console.log(`Blocked: ${blockedCount}`);

  if (blockedCount > 0 && successCount >= 100) {
    console.log('PASS: Emergency Rate Limit activated as expected.');
  } else {
    console.log('FAIL: Emergency Rate Limit did not behave as expected.');
  }

  process.exit(0);
}

main();
