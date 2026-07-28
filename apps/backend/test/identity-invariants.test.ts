import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const BACKEND_SRC = join(REPO_ROOT, 'apps', 'backend', 'src');

function walkTs(dir: string): string[] {
  const outputs: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      outputs.push(...walkTs(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      outputs.push(full);
    }
  }
  return outputs;
}

const files = walkTs(BACKEND_SRC);
expect(files.length).toBeGreaterThan(0);

// Forbid any comparison between ride.passengerId / ride.driverId and an
// identifier in the *users.id* domain (e.g. authenticatedUserId, userId,
// cancelledBy, ratedBy, user.id). The architectural invariant is that
// `rides.passengerId` is `passengers.id` and `rides.driverId` is
// `drivers.id`; equivalences against a users.id are always a bug and must be
// expressed via a profile-table resolution.
//
// Note: comparisons of ride.passengerId / ride.driverId against
// `passenger.id` / `driver.id` are LEGITIMATE — those are profile-row ids and
// live in the same domain as the ride columns. Those are intentionally not
// matched by the forbidden patterns below.
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\.passengerId\s*[!=]+=?\s*\w*[Uu]serId\b/, description: 'ride.passengerId compared against a *userId identifier' },
  { pattern: /\b\w*[Uu]serId\b\s*[!=]+=?\s*\.passengerId/, description: 'a *userId identifier compared against ride.passengerId' },
  { pattern: /\.driverId\s*[!=]+=?\s*\w*[Uu]serId\b/, description: 'ride.driverId compared against a *userId identifier' },
  { pattern: /\b\w*[Uu]serId\b\s*[!=]+=?\s*\.driverId/, description: 'a *userId identifier compared against ride.driverId' },
  { pattern: /\.passengerId\s*[!=]+=?\s*\b(?:cancelledBy|ratedBy)\b/, description: 'ride.passengerId compared against cancelledBy/ratedBy' },
  { pattern: /\b(?:cancelledBy|ratedBy)\b\s*[!=]+=?\s*\.passengerId/, description: 'cancelledBy/ratedBy compared against ride.passengerId' },
  { pattern: /\.driverId\s*[!=]+=?\s*\b(?:cancelledBy|ratedBy)\b/, description: 'ride.driverId compared against cancelledBy/ratedBy' },
  { pattern: /\b(?:cancelledBy|ratedBy)\b\s*[!=]+=?\s*\.driverId/, description: 'cancelledBy/ratedBy compared against ride.driverId' },
];

describe('Identity invariant: no direct users.id vs rides.passengerId / rides.driverId', () => {
  it('no backend source line compares ride passenger/driver ids with a users.id-domain value', () => {
    const offenders: Array<{ file: string; line: number; text: string; pattern: string }> = [];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        // Skip comment-only lines (a real source-line comparison is never a
        // comment; we still want to fail on inline trailing comments if the
        // offending pattern is outside the comment, so we do not strip them).
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Strip a trailing inline `// comment` portion before matching so we
        // only inspect executable source text.
        const executable = line.replace(/\/\/.*$/, '');

        for (const { pattern, description } of FORBIDDEN_PATTERNS) {
          if (pattern.test(executable)) {
            offenders.push({
              file: relative(REPO_ROOT, file).split(sep).join('/'),
              line: index + 1,
              text: line.trim(),
              pattern: description,
            });
          }
        }
      });
    }

    expect(
      offenders,
      `Forbidden identity comparisons detected:\n${
        offenders
          .map((o) => `  ${o.file}:${o.line} (${o.pattern})\n    ${o.text}`)
          .join('\n')
      }`,
    ).toEqual([]);
  });

  it('resolves passenger.id and driver.id from JWT users.id via profile tables', () => {
    const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    // The profile resolution helpers must exist in the recovery branch a
    // regression of removing them would break identity mapping for ride
    // creation, status updates, cancellation, rating, and history.
    expect(all, 'expected eq(passengers.userId, authenticatedUserId) usage').toMatch(
      /eq\(passengers\.userId,\s*authenticatedUserId\)/,
    );
    expect(all, 'expected eq(drivers.userId, authenticatedUserId) usage').toMatch(
      /eq\(drivers\.userId,\s*authenticatedUserId\)/,
    );
  });
});