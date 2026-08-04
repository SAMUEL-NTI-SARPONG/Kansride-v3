const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const Redis = require('ioredis');

function loadRootEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath);
}

function report(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}

async function checkDatabase(url) {
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const client = await pool.connect();
    try {
      const version = await client.query('SHOW server_version');
      const postgis = await client.query("SELECT COUNT(*)::int AS count FROM pg_extension WHERE extname = 'postgis'");
      const migrations = await client.query("SELECT COUNT(*)::int AS count FROM drizzle_migrations");
      report('postgresql', true, `${version.rows[0]?.server_version || 'unknown'}; PostGIS ${postgis.rows[0]?.count ? 'installed' : 'missing'}; ${migrations.rows[0]?.count || 0} migrations`);
      return Boolean(postgis.rows[0]?.count) && migrations.rows[0]?.count >= 3;
    } finally {
      client.release();
    }
  } catch (error) {
    report('postgresql', false, error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    await pool.end();
  }
}

async function checkRedis(url) {
  if (!url) {
    report('redis', process.env.NODE_ENV !== 'production', 'REDIS_URL unset; using in-memory development fallback');
    return process.env.NODE_ENV !== 'production';
  }
  const redis = new Redis(url, { lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    const value = await redis.ping();
    report('redis', value === 'PONG', value === 'PONG' ? 'reachable' : value);
    return value === 'PONG';
  } catch (error) {
    report('redis', false, error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    await redis.quit().catch(() => undefined);
  }
}

async function main() {
  loadRootEnv();
  const production = process.env.NODE_ENV === 'production';
  let ready = true;

  if (!process.env.DATABASE_URL) {
    report('configuration', false, 'DATABASE_URL is missing');
    ready = false;
  } else {
    ready = (await checkDatabase(process.env.DATABASE_URL)) && ready;
  }

  ready = (await checkRedis(process.env.REDIS_URL)) && ready;

  const paymentProvider = process.env.PAYMENT_PROVIDER || 'mock';
  const mapsProvider = process.env.MAPS_PROVIDER || 'openstreetmap';
  report('payment-provider', !production && paymentProvider === 'mock', `${paymentProvider}${paymentProvider === 'mock' ? ' (development mock)' : ''}`);
  report('maps-provider', mapsProvider === 'openstreetmap', `${mapsProvider}${mapsProvider === 'openstreetmap' ? ' (Haversine adapter)' : ' (adapter unavailable)'}`);
  if (production && paymentProvider !== 'mock') {
    report('payment-production-adapter', false, `${paymentProvider} is not implemented; activation requires an approved adapter`);
    ready = false;
  }
  if (production && paymentProvider === 'mock') ready = false;
  if (mapsProvider !== 'openstreetmap') ready = false;
  if (production && !process.env.WEB_CORS_ORIGINS) {
    report('production-cors', false, 'WEB_CORS_ORIGINS is required in production');
    ready = false;
  }

  report('overall', ready, ready ? 'environment is ready for the configured checks' : 'one or more readiness checks failed');
  if (!ready) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Doctor failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
