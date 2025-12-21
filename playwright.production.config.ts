import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for testing against production Railway deployment
 */
export default defineConfig({
    testDir: './e2e',
    testMatch: 'production.spec.ts',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 1,
    workers: 1, // Run sequentially to avoid overwhelming production
    reporter: [['html', { open: 'never' }], ['list']],
    timeout: 30000,
    use: {
        baseURL: process.env.PROD_URL || 'https://admachin-server-production.up.railway.app',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // No webServer - we're testing against production
});
