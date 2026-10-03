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
      query_timeout: 15000,
      statement_timeout: 15000,
    });
    // Hosted databases can close idle connections during suspension/network
    // outages. pg removes the broken client; an unhandled pool error would
    // otherwise terminate the entire API process.
    pool.on('error', () => {
      console.error('[DB] Idle connection lost; the pool will reconnect on the next request');
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
