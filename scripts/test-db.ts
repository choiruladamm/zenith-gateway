import { db } from './src/db/index.js';
import { organizations } from './src/db/schema.js';

async function run() {
  console.log("Testing DB connection...");
  try {
    const orgs = await db.select().from(organizations).limit(1);
    console.log("DB Success, found orgs:", orgs.length);
  } catch (e) {
    console.error("DB Error:", e);
  }
  process.exit(0);
}

run();
