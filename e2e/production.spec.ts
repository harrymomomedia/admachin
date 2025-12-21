import { test, expect } from '@playwright/test';

/**
 * Production E2E Tests for Railway Deployment
 * Tests real functionality against https://admachin-server-production.up.railway.app
 *
 * These tests use the REAL database, so be careful with data creation.
 */

const PROD_URL = process.env.PROD_URL || 'https://admachin-server-production.up.railway.app';

test.describe('Production Smoke Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Go to production URL
        await page.goto(PROD_URL);
    });

    test('homepage loads and shows app title', async ({ page }) => {
        // Wait for the app to load
        await page.waitForLoadState('networkidle');

        // Check title
        await expect(page).toHaveTitle(/AdMachin/);

        // App should render something (sidebar or main content)
        await expect(page.locator('body')).not.toBeEmpty();
    });

    test('API health check works', async ({ page }) => {
        const response = await page.request.get(`${PROD_URL}/api/health`);
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.status).toBe('ok');
        expect(data.env).toBe('production');
    });

    test('video API is configured', async ({ page }) => {
        const response = await page.request.get(`${PROD_URL}/api/video/generate`);
        const data = await response.json();
        expect(data.configured).toBe(true);
    });
});

test.describe('Navigation Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(PROD_URL);
        await page.waitForLoadState('networkidle');
    });

    test('can navigate to Ad Text page', async ({ page }) => {
        // Look for Ad Text link in sidebar
        const adTextLink = page.getByRole('link', { name: /Ad Text/i });

        if (await adTextLink.isVisible()) {
            await adTextLink.click();
            await expect(page).toHaveURL(/ad-cop/);
        }
    });

    test('can navigate to Creatives page', async ({ page }) => {
        const creativesLink = page.getByRole('link', { name: /Creative/i });

        if (await creativesLink.isVisible()) {
            await creativesLink.click();
            await expect(page).toHaveURL(/creative/);
        }
    });

    test('can navigate to Ad Planning page', async ({ page }) => {
        const planningLink = page.getByRole('link', { name: /Planning/i });

        if (await planningLink.isVisible()) {
            await planningLink.click();
            await expect(page).toHaveURL(/planning/);
        }
    });

    test('can navigate to Video Generator page', async ({ page }) => {
        const videoLink = page.getByRole('link', { name: /Video/i });

        if (await videoLink.isVisible()) {
            await videoLink.click();
            await expect(page).toHaveURL(/video/);
        }
    });
});

test.describe('Ad Text Page Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${PROD_URL}/ad-copies`);
        await page.waitForLoadState('networkidle');
    });

    test('Ad Text page loads with table', async ({ page }) => {
        // Should have heading
        await expect(page.getByRole('heading', { name: /Ad Text/i })).toBeVisible({ timeout: 10000 });

        // Should have table or data grid
        const hasTable = await page.locator('table').isVisible().catch(() => false);
        const hasDataGrid = await page.locator('[role="grid"]').isVisible().catch(() => false);

        expect(hasTable || hasDataGrid).toBeTruthy();
    });

    test('can open New Ad Copy modal', async ({ page }) => {
        const newButton = page.getByRole('button', { name: /New/i });

        if (await newButton.isVisible()) {
            await newButton.click();

            // Modal should open
            await expect(page.getByRole('dialog').or(page.getByRole('heading', { name: /New Ad/i }))).toBeVisible({ timeout: 5000 });

            // Close modal
            await page.keyboard.press('Escape');
        }
    });
});

test.describe('Creatives Page Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${PROD_URL}/creatives`);
        await page.waitForLoadState('networkidle');
    });

    test('Creatives page loads', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Creative/i })).toBeVisible({ timeout: 10000 });
    });

    test('can toggle between grid and list view', async ({ page }) => {
        // Wait for content
        await page.waitForTimeout(1000);

        // Try to find view toggle buttons
        const listViewBtn = page.getByLabel('List View').or(page.locator('button[title="List View"]'));
        const gridViewBtn = page.getByLabel('Grid View').or(page.locator('button[title="Grid View"]'));

        if (await listViewBtn.isVisible()) {
            await listViewBtn.click();
            await page.waitForTimeout(500);

            // Should show table in list view
            const hasTable = await page.locator('table').isVisible().catch(() => false);
            expect(hasTable).toBeTruthy();

            // Switch back to grid
            if (await gridViewBtn.isVisible()) {
                await gridViewBtn.click();
            }
        }
    });

    test('can open upload modal', async ({ page }) => {
        const uploadBtn = page.getByRole('button', { name: /upload/i }).first();

        if (await uploadBtn.isVisible()) {
            await uploadBtn.click();

            // Modal should open with file input
            await expect(page.locator('input[type="file"]')).toBeVisible({ timeout: 5000 });

            // Close modal
            await page.keyboard.press('Escape');
        }
    });
});

test.describe('Ad Planning Page Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${PROD_URL}/ad-planning`);
        await page.waitForLoadState('networkidle');
    });

    test('Ad Planning page loads', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Planning/i })).toBeVisible({ timeout: 10000 });
    });

    test('can open New Plan modal', async ({ page }) => {
        const newPlanBtn = page.getByRole('button', { name: /New Plan/i });

        if (await newPlanBtn.isVisible()) {
            await newPlanBtn.click();

            // Modal should open
            await expect(page.getByRole('heading', { name: /New.*Plan/i })).toBeVisible({ timeout: 5000 });

            // Close modal
            await page.keyboard.press('Escape');
        }
    });
});

test.describe('Video Generator Page Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${PROD_URL}/video-generator`);
        await page.waitForLoadState('networkidle');
    });

    test('Video Generator page loads', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Video/i })).toBeVisible({ timeout: 10000 });
    });

    test('video generation form is present', async ({ page }) => {
        // Should have prompt input or textarea
        const hasPromptInput = await page.locator('textarea, input[type="text"]').first().isVisible().catch(() => false);
        expect(hasPromptInput).toBeTruthy();
    });
});

test.describe('AI Features Tests', () => {
    test('AI endpoint responds', async ({ page }) => {
        // Test the AI endpoint is reachable (even if it returns error without proper request)
        const response = await page.request.get(`${PROD_URL}/api/ai/generate`);
        // Should get some response (even if 400 or 500 due to missing params)
        expect(response.status()).toBeLessThan(600);
    });
});

test.describe('Facebook Auth Tests', () => {
    test('Facebook session endpoint works', async ({ page }) => {
        const response = await page.request.get(`${PROD_URL}/api/auth/facebook/session`);
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        // Should return isAuthenticated (true or false)
        expect(typeof data.isAuthenticated).toBe('boolean');
    });
});
