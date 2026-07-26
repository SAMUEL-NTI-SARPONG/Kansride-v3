import { defineConfig } from 'drizzle-kit';
import { getDatabaseUrl } from './src/database-env';

const databaseUrl = getDatabaseUrl();

export default defineConfig({
  schema: './src/schema',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
