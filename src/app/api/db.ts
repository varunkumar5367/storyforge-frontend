// src/app/api/db.ts
import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set in Vercel environment variables.");
    }
    pool = new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}

