import { spawnSync } from 'node:child_process';

const apiBase = process.env.VITE_API_BASE_URL?.trim();
if (!apiBase) {
  console.error('Set VITE_API_BASE_URL to the public HTTPS origin that runs Nexo server.js before building mobile apps.');
  process.exit(1);
}

try {
  const url = new URL(apiBase);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_API_BASE_URL must be an HTTPS origin, for example https://api.example.com');
  }
} catch (error) {
  console.error(error.message || 'VITE_API_BASE_URL must be a valid HTTPS origin.');
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const args of [['vite', 'build'], ['cap', 'sync']]) {
  const result = spawnSync(npx, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
