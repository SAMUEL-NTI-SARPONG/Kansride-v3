const { spawn } = require('node:child_process');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const commands = [
  ['backend', ['run', 'dev', '--workspace=apps/backend']],
  ['admin-web', ['run', 'dev', '--workspace=apps/admin-web']],
  ['tracking-web', ['run', 'dev', '--workspace=apps/tracking-web']],
];
const children = [];

console.log('Starting backend (3000), admin-web (3001), and tracking-web (3002).');
console.log('Mobile Expo apps remain separate because they require an interactive simulator or physical-device target.');

for (const [name, args] of commands) {
  const child = spawn(npm, args, { stdio: 'inherit', shell: false, env: process.env });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`${name} exited with code ${code}`);
  });
  children.push(child);
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}
process.on('SIGINT', () => { stopAll(); process.exit(0); });
process.on('SIGTERM', () => { stopAll(); process.exit(0); });
