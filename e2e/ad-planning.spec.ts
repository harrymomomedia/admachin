import { test, expect } from '@playwright/test';

test.describe('Ad Planning', () => {
    // Mock user
    const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        role: 'admin',
        created_at: new Date().toISOString()
    };

    // Initial mock data
    let mockPlans = [
        {
            id: 'plan-1',
            ad_number: 1,
            project_id: 'proj-1',
            subproject_id: null,
            subproject: 'Kitchen', // Legacy text field
            plan_type: 'CClone',
            creative_type: 'Video',
            priority: 5,
            hj_rating: 8,
            spy_url: 'https://example.com/spy',
            description: 'Initial Plan Description',
            status: 'not started',
            user_id: mockUser.id,
            created_at: new Date().toISOString()
        }
    ];

    test.beforeEach(async ({ page }) => {
        // Reset mock data
        mockPlans = [
            {
                id: 'plan-1',
                ad_number: 1,
                project_id: 'proj-1',
                subproject_id: null,
                subproject: 'Kitchen',
                plan_type: 'CClone',
                creative_type: 'Video',
                priority: 5,
                hj_rating: 8,
                spy_url: 'https://example.com/spy',
                description: 'Initial Plan Description',
                status: 'not started',
                user_id: mockUser.id,
                created_at: new Date().toISOString()
            }
        ];

        // Mock Users (Dependency)
        await page.route('**/rest/v1/users*', async route => {
            const method = route.request().method();
            // Auth check or list users
            await route.fulfill({ json: [mockUser] });
        });

        // Mock Projects (Dependency)
        await page.route('**/rest/v1/projects*', async route => {
            await route.fulfill({
                json: [
                    { id: 'proj-1', name: 'Test Project' },
                    { id: 'proj-2', name: 'Another Project' }
                ]
            });
        });

        // Mock Subprojects (Array)
        await page.route('**/rest/v1/subprojects*', async route => {
            await route.fulfill({ json: [] });
        });

        // Stateful Mock for Ad Plans
        // Note: Using a single handler for simplicity, but can split.
        await page.route('**/rest/v1/ad_plans*', async route => {
            const method = route.request().method();
            const url = route.request().url();

            if (method === 'GET') {
                // If it's a count query or selection
                await route.fulfill({ json: mockPlans });
            } else if (method === 'POST') {
                const postData = route.request().postDataJSON();
                const newPlan = {
                    id: `plan-${Date.now()}`,
                    ad_number: mockPlans.length + 1,
                    created_at: new Date().toISOString(),
                    ...postData
                };
                mockPlans.unshift(newPlan);
                await route.fulfill({ json: newPlan });
            } else if (method === 'PATCH') {
                const postData = route.request().postDataJSON();
                const idMatch = url.match(/id=eq\.([^&]+)/);
                const id = idMatch ? idMatch[1] : null;

                if (id) {
                    const index = mockPlans.findIndex(p => p.id === id);
                    if (index !== -1) {
                        mockPlans[index] = { ...mockPlans[index], ...postData };
                        await route.fulfill({ json: mockPlans[index] });
                    } else {
                        await route.fulfill({ status: 404 });
                    }
                }
            } else if (method === 'DELETE') {
                // Not implemented in UI yet likely, but good to have
                await route.fulfill({ status: 204 });
            }
        });

        // Login flow
        await page.goto('/login');
        await page.getByPlaceholder('you@example.com').fill('test@example.com');
        await page.getByPlaceholder('••••••••').fill('password');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await expect(page).toHaveURL('/');

        // Navigate
        await page.goto('/ad-planning');
    });

    test('should display ad plans', async ({ page }) => {
        await expect(page).toHaveURL(/.*ad-planning/);
        await expect(page.getByRole('heading', { name: 'Ad Planning' })).toBeVisible();
        await expect(page.getByText('Initial Plan Description')).toBeVisible();
    });

    test('should create new ad plan', async ({ page }) => {
        await page.getByRole('button', { name: 'New Plan' }).click();

        await expect(page.getByRole('heading', { name: 'New Ad Plan' })).toBeVisible();

        // Use accessible selectors now!
        await page.getByLabel('Project', { exact: true }).selectOption({ label: 'Test Project' });
        await page.getByLabel('Subproject').fill('Bedroom');
        await page.getByLabel('Description').fill('New Video Ad Plan');
        await page.getByLabel('Owner').selectOption({ label: 'Test User' }); // Helper in components maps names
        // Note: The select option text is "Test User" because firstName="Test", lastName="User".

        await page.getByRole('button', { name: 'Create Plan' }).click();

        await expect(page.getByRole('heading', { name: 'New Ad Plan' })).not.toBeVisible();
        await expect(page.getByText('New Video Ad Plan')).toBeVisible();
    });

    test('should inline edit ad plan', async ({ page }) => {
        const cell = page.getByText('Initial Plan Description');
        await cell.click();

        const input = page.locator('textarea').first();
        await input.fill('Updated Plan Description');

        // Blur
        await page.getByRole('heading', { name: 'Ad Planning' }).click();

        await expect(page.getByText('Updated Plan Description')).toBeVisible();
    });
});
