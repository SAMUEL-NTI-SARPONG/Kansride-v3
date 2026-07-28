// Local PostgreSQL / PostGIS probe helper.
//
// Usage:
//   node tools/probe-postgres.cjs "postgresql://USER:PASSWORD@HOST:PORT/DB"
//
// Reads the connection string from argv[2] (NEVER from a hardcoded default
// and never from a committed file) and prints `server_version` plus the count
// of `postgis`-named extensions installed. Exits non-zero on any failure
// (including a `28P01` password-auth error), so the Phase 0B operations
// runbook can chain it under `&&` style validation steps. The probe uses the
// hoisted `pg` npm package; `psql`/`redis-cli` are NOT prerequisites.
//
// This is dev tooling only — it is a Phase 0B operations convenience and is
// not imported by any production code path. It writes nothing to the database.

const { Pool } = require('pg');

const url = process.argv[2];
if (!url) {
  console.error('usage: node tools/probe-postgres.cjs <postgresql://user:pass@host:port/db>');
  process.exit(2);
}

const pool = new Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 3000,
});

(async () => {
  let exitCode = 0;
  try {
    const client = await pool.connect();
    try {
      const version = await client.query('SHOW server_version');
      const ext = await client.query(
        "SELECT count(*)::int AS n FROM pg_extension WHERE extname='postgis'",
      );
      console.log('server_version:', version.rows[0] ? version.rows[0].server_version : 'unknown');
      console.log('postgis_installed:', ext.rows[0] ? ext.rows[0].n : 0);
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const code = error && error.code ? String(error.code) : 'ERR';
    console.error('connection_failed:', code, message);
    exitCode = 1;
  } finally {
    await pool.end();
    process.exit(exitCode);
  }
})();