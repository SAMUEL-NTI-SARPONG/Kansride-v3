import { runMigrations } from '@kansride/db/src/migrate';

async function main() {
  const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kansride';
  console.log('Initializing KansRide database...');
  console.log(`Connecting to: ${url.replace(/\/\/.*@/, '//***@')}`);

  await runMigrations(url);
  console.log('Database initialization complete!');
}

main().catch((err) => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});
