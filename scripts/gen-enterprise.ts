import { db } from '../src/db/index.js';
import { apiKeys, organizations, plans } from '../src/db/schema.js';
import { hashApiKey } from '../src/utils/crypto.js';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

async function generateEnterpriseKey() {
  const randomPart = randomBytes(16).toString('hex');
  const newKey = `zenith_ent_${randomPart}`;
  const keyHash = await hashApiKey(newKey);

  try {
    const [org] = await db.select().from(organizations).limit(1);
    const enterprisePlan = await db
      .select()
      .from(plans)
      .where(eq(plans.name, 'Enterprise'))
      .limit(1);

    if (!org || enterprisePlan.length === 0) {
      console.error('❌ Error: Make sure to run seed first (npm run db:seed)');
      return;
    }

    await db.insert(apiKeys).values({
      org_id: org.id,
      plan_id: enterprisePlan[0].id,
      key_hash: keyHash,
      hint: 'enterprise_test',
      status: 'active',
    });

    console.log(newKey);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to generate key:', error);
    process.exit(1);
  }
}

generateEnterpriseKey();
