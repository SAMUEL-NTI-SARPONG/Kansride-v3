import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder: './src/migrations' });
  console.log('Migrations completed successfully.');

  await pool.end();
}

// CLI entry point
if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
