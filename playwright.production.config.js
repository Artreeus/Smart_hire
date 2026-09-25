import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://nadiaproject.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
