import { defineConfig, devices } from '@playwright/test';

const databaseUrl = process.env.EMS_E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set EMS_E2E_DATABASE_URL to a dedicated local PostgreSQL test database before running E2E tests.');
}

const database = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
  throw new Error('EMS_E2E_DATABASE_URL must use the PostgreSQL protocol.');
}

const databaseHost = database.hostname;
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseHost)) {
  throw new Error('E2E tests only run against localhost PostgreSQL; refusing to connect to a remote database.');
}

const clientUrl = 'http://127.0.0.1:4173';
const jwtSecret = 'local-e2e-only-secret-do-not-use-in-production-123';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: clientUrl,
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'npm --prefix server start',
      url: 'http://127.0.0.1:5000/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: '5000',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: jwtSecret,
        CLIENT_URL: clientUrl,
        ALLOWED_ORIGINS: clientUrl
      }
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 4173 --strictPort',
      url: clientUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_URL: 'http://127.0.0.1:5000/api'
      }
    }
  ]
});
