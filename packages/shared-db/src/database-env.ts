import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '..', '.env'),
  ];
  const envPath = candidates.find((candidate) => existsSync(candidate));
  if (envPath) {
    process.loadEnvFile(envPath);
  }
}

export function getDatabaseUrl(): string {
  loadRootEnv();
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      'DATABASE_URL is required. Copy .env.example to the repository-root .env and set local credentials.',
    );
  }

  const parsed = new URL(value);
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must use the postgresql:// or postgres:// scheme');
  }
  return value;
}
