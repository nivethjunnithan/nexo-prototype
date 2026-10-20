import { defineConfig } from '@playwright/test';

const apiPort = 3102;
const webPort = 5180;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  reporter: 'list',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    browserName: 'chromium',
    headless: true
  },
  webServer: [
    {
      command: 'node server.js',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      env: { PORT: String(apiPort) },
      reuseExistingServer: false,
      timeout: 20_000
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: `http://127.0.0.1:${webPort}`,
      env: { NEXO_API_PORT: String(apiPort) },
      reuseExistingServer: false,
      timeout: 20_000
    }
  ]
});
