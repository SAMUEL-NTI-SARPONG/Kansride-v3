import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { getDatabaseUrl } from './database-env';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const migrationsFolder = resolve(__dirname, '..', 'src', 'migrations');

function equivalentLineEndingHash(timestamp: number, appliedHash: string): boolean {
  const journal = JSON.parse(readFileSync(resolve(migrationsFolder, 'meta/_journal.json'), 'utf8')) as { entries: Array<{ when: number; tag: string }> };
  const entry = journal.entries.find((item) => item.when === timestamp);
  if (!entry) return false;
  const sql = readFileSync(resolve(migrationsFolder, `${entry.tag}.sql`), 'utf8').replace(/\r\n/g, '\n');
  // Git on Windows may check SQL out as CRLF while Render uses LF. Accept
  // only this byte-level equivalent; never rewrite applied SQL or journal rows.
  return [sql, sql.replace(/\n/g, '\r\n')].some((value) => createHash('sha256').update(value).digest('hex') === appliedHash);
}

/** Refuse drift: previously applied SQL is history, not a reset mechanism. */
export function assertMigrationHistory(
  applied: Array<{ created_at: string | number; hash: string }>,
  expected = readMigrationFiles({ migrationsFolder }),
): void {
  for (const [index, row] of applied.entries()) {
    const migration = expected[index];
    if (!migration || migration.folderMillis !== Number(row.created_at)
      || (migration.hash !== row.hash && !equivalentLineEndingHash(migration.folderMillis, row.hash))) {
      throw new Error('Applied migration history differs from this build; refusing to change the database');
    }
  }
}

export async function runMigrations(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Migration connection must use PostgreSQL');
  if (url.hostname.includes('-pooler.')) {
    throw new Error('Use the direct Neon connection in MIGRATION_DATABASE_URL; transaction pooling cannot safely hold a session migration lock');
  }
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
  try {
    const client = await pool.connect();
    try {
      await client.query("SET lock_timeout = '10s'");
      await client.query("SET statement_timeout = '60s'");
      // Serialize deploys on the same connection used for migration execution.
      await client.query('SELECT pg_advisory_lock(74621001)');
      const historyExists = await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS name");
      if (historyExists.rows[0]?.name) {
        const history = await client.query('SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at');
        assertMigrationHistory(history.rows);
      }
      const ridesExist = await client.query("SELECT to_regclass('public.rides') AS name");
      if (ridesExist.rows[0]?.name) {
        const duplicates = await client.query(`SELECT passenger_id FROM rides
          WHERE status IN ('requested', 'searching', 'driver_offered', 'driver_assigned',
            'driver_en_route', 'driver_arrived', 'waiting_for_passenger', 'passenger_verified',
            'in_progress', 'emergency_hold')
          GROUP BY passenger_id HAVING count(*) > 1 LIMIT 1`);
        if (duplicates.rowCount) {
          throw new Error('Conflicting active passenger rides exist; resolve them through normal operations before migrating. No trips were changed');
        }
        const driverConflicts = await client.query(`SELECT driver_id FROM rides
          WHERE driver_id IS NOT NULL AND status IN ('driver_assigned', 'driver_en_route',
            'driver_arrived', 'waiting_for_passenger', 'passenger_verified', 'in_progress', 'emergency_hold')
          GROUP BY driver_id HAVING count(*) > 1 LIMIT 1`);
        if (driverConflicts.rowCount) {
          throw new Error('Conflicting active driver rides exist; resolve them through normal operations before migrating. No trips were changed');
        }
      }
      console.log('Migration preflight passed; applying append-only migrations...');
      await migrate(drizzle(client), { migrationsFolder });
      console.log('Migrations completed successfully.');
    } finally {
      // Pool shutdown releases the advisory lock even if an earlier step fails.
      client.release();
    }
  } finally {
    await pool.end();
  }
}

// CLI entry point
if (require.main === module) {
  const url = getDatabaseUrl();
  runMigrations(process.env.MIGRATION_DATABASE_URL || url)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err instanceof Error ? err.message : 'unknown error');
      process.exit(1);
    });
}
