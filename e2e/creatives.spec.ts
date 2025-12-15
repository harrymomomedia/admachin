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

    test.beforeEach(async ({ page }) => {
        // Mock Login
        await page.route('**/rest/v1/users*', async route => {
            await route.fulfill({ json: [{ id: 'user1', email: 'test@example.com' }] });
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
        await page.goto('/creatives');
    });

    test('should display creatives in grid view', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Creative Library' })).toBeVisible();
        await expect(page.getByText('test-image.jpg')).toBeVisible();
        await expect(page.getByText('test-video.mp4')).toBeVisible();
    });

    test('should switch to list view', async ({ page }) => {
        // Use accessible label for List View
        await page.getByLabel('List View').click();

        // In list view, it uses a table
        await expect(page.locator('table')).toBeVisible();
        await expect(page.getByRole('cell', { name: 'test-image.jpg' })).toBeVisible();
    });

    test('should upload creative', async ({ page }) => {
        // Open Uploader using specific aria-label
        await page.getByLabel('Upload Media Main').click();

        // Verify Modal
        await expect(page.getByRole('heading', { name: 'Upload Creative' })).toBeVisible();

        // Create a dummy file for testing
        // Note: Storage and DB routes are mocked in beforeEach, so no real uploads occur
        const buffer = Buffer.from('fake image data for testing');
        const fileInput = page.locator('input[type="file"]');

        await fileInput.setInputFiles({
            name: 'test-upload.jpg',
            mimeType: 'image/jpeg',
            buffer
        });

        // Wait for upload to complete (Green checkmark or success status)
        // CreativeUploader shows CheckCircle on success
        await expect(page.locator('.lucide-check-circle')).toBeVisible({ timeout: 10000 });

        // Close modal
        await page.getByRole('button').filter({ has: page.locator('.lucide-x') }).first().click();

        // The file should appear in the list (added to local state by the app)
        await expect(page.getByText('test-upload.jpg')).toBeVisible();
    });

    test('should delete creative', async ({ page }) => {
        // Select an item first (checkbox or hover action)
        // In Grid view, hover actions appear.
        // Click the trash icon on the first item

        // Force hover to show actions?
        // Or better, select it using checkbox

        // The grid item checkbox is hidden until group hover?
        // "absolute top-2 left-2 ... opacity-0 group-hover:opacity-100"

        // We can force click the hidden button or hover
        await page.locator('.group').first().hover();
        await page.locator('.group').first().locator('button').first().click(); // Checkbox

        // Now "Delete" button should appear in toolbar
        const deleteBtn = page.getByRole('button', { name: 'Delete' });
        await expect(deleteBtn).toBeVisible();

        // Mock window.confirm
        page.on('dialog', dialog => dialog.accept());

        await deleteBtn.click();

        // Item should disappear
        await expect(page.getByText('test-image.jpg')).not.toBeVisible();
    });
});
