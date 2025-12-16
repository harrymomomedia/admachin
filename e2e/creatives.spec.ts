import { test, expect } from '@playwright/test';

test.describe('Creative Library', () => {
    // Mock Data
    const mockCreatives = [
        {
            id: 'c1',
            name: 'test-image.jpg',
            type: 'image',
            storage_path: 'creatives/test-image.jpg',
            file_size: 1024 * 500, // 500KB
            uploaded_by: 'Test User',
            created_at: new Date().toISOString(),
            dimensions: { width: 1080, height: 1080 }
        },
        {
            id: 'c2',
            name: 'test-video.mp4',
            type: 'video',
            storage_path: 'creatives/test-video.mp4',
            file_size: 1024 * 1024 * 5, // 5MB
            uploaded_by: 'Test User',
            created_at: new Date().toISOString(),
            duration: 15
        }
    ];

    // Mock user - must match login credentials
    const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        password: 'password',
        role: 'admin',
        created_at: new Date().toISOString()
    };

    test.beforeEach(async ({ page }) => {
        // Mock Login - must include password for auth check
        await page.route('**/rest/v1/users*', async route => {
            await route.fulfill({ json: [mockUser] });
        });

        // Mock Creatives - handle ALL methods to prevent real DB writes
        await page.route('**/rest/v1/creatives*', async route => {
            const method = route.request().method();
            if (method === 'GET') {
                await route.fulfill({ json: mockCreatives });
            } else if (method === 'DELETE') {
                await route.fulfill({ status: 204 });
            } else if (method === 'POST') {
                // Mock successful insert - NEVER let POST go to real DB
                await route.fulfill({
                    status: 201,
                    json: { id: 'mock-new-id', name: 'new-image.jpg' }
                });
            } else {
                // For any other method, also mock instead of continuing to real server
                await route.fulfill({ status: 200 });
            }
        });

        // Mock Storage uploads - CRITICAL: prevent real file uploads
        await page.route('**/storage/v1/object/creatives/**', async route => {
            await route.fulfill({
                status: 200,
                json: { Key: 'creatives/mock-upload.jpg', publicURL: 'http://mock/url' }
            });
        });

        // Mock Storage list/delete operations
        await page.route('**/storage/v1/object/**/creatives/**', async route => {
            await route.fulfill({ status: 200, json: {} });
        });

        // Login and Navigate
        await page.goto('/login');
        await page.getByPlaceholder('you@example.com').fill('test@example.com');
        await page.getByPlaceholder('••••••••').fill('password');
        await page.getByRole('button', { name: 'Sign In' }).click();

        // Wait for login to complete
        await expect(page).toHaveURL('/');

        // Navigate to Creatives
        await page.goto('/creatives');
        await expect(page).toHaveURL(/.*creatives/);
    });

    test('should display creatives in grid view', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Creative Library' })).toBeVisible();
        // Wait for content to load
        await page.waitForTimeout(500);
        await expect(page.getByText('test-image.jpg')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('test-video.mp4')).toBeVisible({ timeout: 10000 });
    });

    test('should switch to list view', async ({ page }) => {
        // Wait for initial content to load
        await page.waitForTimeout(500);

        // Use accessible label for List View - try different selectors
        const listViewBtn = page.getByLabel('List View').or(page.locator('button[title="List View"]'));
        await listViewBtn.click();

        // In list view, it uses a table
        await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('cell', { name: 'test-image.jpg' })).toBeVisible({ timeout: 10000 });
    });

    test('should upload creative', async ({ page }) => {
        // Wait for page to load
        await page.waitForTimeout(500);

        // Open Uploader - try multiple selectors
        const uploadBtn = page.getByLabel('Upload Media Main').or(page.getByRole('button', { name: /upload/i }));
        await uploadBtn.first().click();

        // Verify Modal opens
        await expect(page.getByRole('heading', { name: 'Upload Creative' })).toBeVisible({ timeout: 10000 });

        // Create a dummy file for testing
        const buffer = Buffer.from('fake image data for testing');
        const fileInput = page.locator('input[type="file"]');

        await fileInput.setInputFiles({
            name: 'test-upload.jpg',
            mimeType: 'image/jpeg',
            buffer
        });

        // Wait for upload to complete - look for green success indicator (text-green-500 class)
        // or any element showing the filename with success state
        await expect(
            page.locator('.text-green-500').first()
        ).toBeVisible({ timeout: 15000 });

        // Close modal - click X button
        await page.locator('button').filter({ has: page.locator('svg') }).first().click();

        // Modal should close (heading no longer visible)
        await expect(page.getByRole('heading', { name: 'Upload Creative' })).not.toBeVisible({ timeout: 5000 });
    });

    test('should delete creative', async ({ page }) => {
        // Wait for content to load
        await page.waitForTimeout(500);

        // Mock window.confirm - set up before clicking
        page.on('dialog', dialog => dialog.accept());

        // Select an item first - hover to show checkbox
        const gridItem = page.locator('.group').first();
        await gridItem.hover();

        // Wait for hover effect
        await page.waitForTimeout(200);

        // Click the checkbox/select button
        await gridItem.locator('button').first().click({ force: true });

        // Now "Delete" button should appear in toolbar
        const deleteBtn = page.getByRole('button', { name: 'Delete' });
        await expect(deleteBtn).toBeVisible({ timeout: 5000 });

        await deleteBtn.click();

        // Wait for deletion to process
        await page.waitForTimeout(500);

        // Item should disappear
        await expect(page.getByText('test-image.jpg')).not.toBeVisible({ timeout: 10000 });
    });
});
