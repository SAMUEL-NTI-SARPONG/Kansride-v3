import { describe, expect, it } from 'vitest';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { assertMigrationHistory, migrationsFolder } from '../src/migrate';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('append-only deployment migrations', () => {
  const expected = readMigrationFiles({ migrationsFolder });
  it('loads migration SQL independently of the current workspace directory', () => {
    expect(expected.length).toBeGreaterThanOrEqual(8);
  });
  it('accepts intact previously applied history', () => {
    expect(() => assertMigrationHistory(expected.slice(0, 3).map((item) => ({ created_at: item.folderMillis, hash: item.hash })))).not.toThrow();
  });
  it('refuses rewritten applied SQL and unknown future history', () => {
    expect(() => assertMigrationHistory([{ created_at: expected[0]!.folderMillis, hash: 'rewritten' }])).toThrow('refusing to change');
    expect(() => assertMigrationHistory([{ created_at: Number.MAX_SAFE_INTEGER, hash: 'unknown' }])).toThrow('refusing to change');
  });
  it('refuses gaps that Drizzle would otherwise skip based on the newest timestamp', () => {
    expect(() => assertMigrationHistory([{ created_at: expected[1]!.folderMillis, hash: expected[1]!.hash }])).toThrow('refusing to change');
  });
  it('accepts equivalent Windows/Linux line endings without rewriting history', () => {
    const sql = readFileSync(resolve(migrationsFolder, '0000_unusual_morlun.sql'), 'utf8').replace(/\r\n/g, '\n');
    for (const text of [sql, sql.replace(/\n/g, '\r\n')]) {
      const hash = createHash('sha256').update(text).digest('hex');
      expect(() => assertMigrationHistory([{ created_at: expected[0]!.folderMillis, hash }])).not.toThrow();
    }
  });
});
