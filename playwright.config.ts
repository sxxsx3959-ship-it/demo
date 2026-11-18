import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, reporter: 'list',
  use: { baseURL: 'http://localhost:3101', channel: 'msedge', headless: true },
  webServer: { command: 'npm run start -- --port 3101', url: 'http://localhost:3101', reuseExistingServer: false, timeout: 60000 },
});
