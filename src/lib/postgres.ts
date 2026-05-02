import { Pool } from "pg";

import { env } from "../config/env.js";

export const pgPool = new Pool({
  connectionString: env.DATABASE_URL
});

export async function checkPostgresHealth(): Promise<void> {
  const client = await pgPool.connect();

  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
