const { spawnSync } = require('node:child_process');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const checks = [
  ['git diff --check', 'git', ['diff', '--check']],
  ['unit tests', npm, ['test']],
  ['shared types', npm, ['run', 'type-check', '--workspace=packages/shared-types']],
  ['shared config', npm, ['run', 'type-check', '--workspace=@kansride/config']],
  ['shared db', npm, ['run', 'type-check', '--workspace=packages/shared-db']],
  ['shared auth', npm, ['run', 'type-check', '--workspace=@kansride/auth']],
  ['backend', npm, ['run', 'type-check', '--workspace=apps/backend']],
  ['passenger mobile', npm, ['run', 'type-check', '--workspace=apps/mobile-passenger']],
  ['driver mobile', npm, ['run', 'type-check', '--workspace=apps/mobile-driver']],
  ['admin web', npm, ['run', 'type-check', '--workspace=@kansride/admin-web']],
  ['tracking web', npm, ['run', 'type-check', '--workspace=@kansride/tracking-web']],
  ['backend build', npm, ['run', 'build', '--workspace=@kansride/backend']],
  ['admin build', npm, ['run', 'build', '--workspace=@kansride/admin-web']],
  ['tracking build', npm, ['run', 'build', '--workspace=@kansride/tracking-web']],
  ['integration journey', npm, ['run', 'test:integration']],
  ['environment doctor', process.execPath, ['tools/doctor.cjs']],
];

for (const [name, command, args] of checks) {
  console.log(`\n== ${name} ==`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`V1 verification stopped at: ${name}`);
    process.exit(result.status || 1);
  }
}
console.log('\nV1 verification passed.');
