/**
 * Playwright config for the automated accessibility checks (`npm run test:a11y`).
 * The app is built with fake Supabase env vars and every Supabase request is mocked in
 * `e2e/mocks.ts`, so the suite runs fully offline.
 */
import { defineConfig, devices } from '@playwright/test';
import { FAKE_SUPABASE_KEY, FAKE_SUPABASE_URL } from './e2e/fixtures.ts';

const PORT = 4173;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.output/test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['github'], ['html', { outputFolder: 'e2e/.output/report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: FAKE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: FAKE_SUPABASE_KEY,
    },
  },
});
