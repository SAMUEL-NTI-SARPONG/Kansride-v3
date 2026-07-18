import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

let dbInstance: Database | null = null;
let pool: Pool | null = null;

export function getDb(connectionString: string, poolSize = 10): Database {
  if (!dbInstance) {
    pool = new Pool({
      connectionString,
      max: poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}
