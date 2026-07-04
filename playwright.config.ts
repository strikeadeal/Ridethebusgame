import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4173/Ridethebusgame/',
  },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'] }, grepInvert: /@offline/ },
    { name: 'chromium-pwa', use: { ...devices['Pixel 7'] }, grep: /@offline/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/Ridethebusgame/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
