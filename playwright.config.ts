import { defineConfig } from '@playwright/test';

// PW_CHROMIUM_PATH lets a machine with its own Chromium skip `npx playwright install`.
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.e2e\.spec\.ts/,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'off', launchOptions: executablePath ? { executablePath } : {} },
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
});
