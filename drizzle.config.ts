import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

console.log(
  'DATABASE_URL from config:',
  process.env.DATABASE_URL ? 'FOUND' : 'MISSING',
);

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
