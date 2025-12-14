import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
    await expect(page).toHaveTitle(/AdMachin/);
});

test('can login and navigate', async ({ page }) => {
    // Mock Supabase users query
    await page.route('**/rest/v1/users*', async route => {
        const json = [
            {
                id: '123e4567-e89b-12d3-a456-426614174000',
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
                password: 'password', // Matching the input
                role: 'admin',
                created_at: new Date().toISOString()
            }
        ];
        await route.fulfill({ json });
    });

    await page.goto('/');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);

    // Perform login
    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('••••••••').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should navigate to dashboard
    await expect(page).toHaveURL('/');

    // Check if sidebar text exists
    await expect(page.getByText('AdMachin', { exact: true })).toBeVisible();

    // Check if "Ad Text" link exists and click it
    const adTextLink = page.getByRole('link', { name: 'Ad Text' });
    await expect(adTextLink).toBeVisible();

    await adTextLink.click();

    // Verify we navigated to the correct page
    await expect(page).toHaveURL(/.*ad-copies/); // href is /ad-copies not /ad-text
});
