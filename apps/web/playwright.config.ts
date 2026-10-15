import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const dbUrl =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/ricoz_endpoint';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  webServer: [
    {
      command: 'node ../api/dist/server.js',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !isCI,
      timeout: 30_000,
      env: { DATABASE_URL: dbUrl, NODE_ENV: 'production' },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run start',
      url: 'http://localhost:5173/',
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: { API_PROXY_TARGET: 'http://localhost:3001' },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
