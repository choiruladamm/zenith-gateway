import { db } from '../src/db/index.js';
import { apiKeys, organizations, plans } from '../src/db/schema.js';
import { hashApiKey } from '../src/utils/crypto.js';
import { randomBytes } from 'crypto';

async function generateNewKey(hint: string = 'manual_gen') {
  const randomPart = randomBytes(16).toString('hex');
  const newKey = `zenith_${randomPart}`;

  const keyHash = await hashApiKey(newKey);

  try {
    const [org] = await db.select().from(organizations).limit(1);
    const [plan] = await db.select().from(plans).limit(1);

    if (!org || !plan) {
      console.error('❌ Error: Make sure to run seed first (npm run db:seed)');
      return;
    }

    await db.insert(apiKeys).values({
      org_id: org.id,
      plan_id: plan.id,
      key_hash: keyHash,
      hint: hint,
      status: 'active',
    });

    console.log('\n✅ New API Key Generated Successfully!');
    console.log('---------------------------------------');
    console.log(`API Key: ${newKey}`);
    console.log(`Hint:    ${hint}`);
    console.log('---------------------------------------');
    console.log(
      '⚠️  IMPORTANT: Copy this key now. It will NOT be shown again!',
    );

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to generate key:', error);
    process.exit(1);
  }
}

// Get hint from command line argument or use default
const inputHint = process.argv[2] || 'manual_gen';
generateNewKey(inputHint);
