import { runMigrations } from '@kansride/db/src/migrate';
import { getEnv } from '@kansride/config';

async function main() {
  const url = getEnv().DATABASE_URL;
  console.log('Initializing KansRide database...');
  console.log(`Connecting to: ${url.replace(/\/\/.*@/, '//***@')}`);

  await runMigrations(url);
  console.log('Database initialization complete!');
}

main().catch((err) => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});
