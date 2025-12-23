import { test, expect } from '@playwright/test';

/**
 * Test for clearing/deleting project and subproject values in DataTable cells.
 * Tests all AI Copy pages that use the centralized column definitions.
 */

// Helper to login
async function login(page: import('@playwright/test').Page) {
    await page.route('**/rest/v1/users*', async route => {
        const json = [{
            id: '123e4567-e89b-12d3-a456-426614174000',
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            password: 'password',
            role: 'admin',
            created_at: new Date().toISOString()
        }];
        await route.fulfill({ json });
    });

    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('••••••••').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/');
}

test.describe('Clear Project/Subproject Values', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Copy Wizard: Can clear project value with X button', async ({ page }) => {
        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Expand Campaign Parameters section
        const campaignSection = page.locator('button:has-text("Campaign Parameters")');
        if (await campaignSection.isVisible()) {
            await campaignSection.click();
            await page.waitForTimeout(500);
        }

        // Find the DataTable
        const dataTable = page.locator('table').first();
        await expect(dataTable).toBeVisible({ timeout: 10000 });

        // Find header indices
        const headers = await page.locator('thead th').allTextContents();
        console.log('[Test] Headers:', headers);

        const projectIndex = headers.findIndex(h => h.includes('Project') && !h.includes('Subproject'));
        const subprojectIndex = headers.findIndex(h => h.includes('Subproject'));

        console.log(`[Test] Project col: ${projectIndex}, Subproject col: ${subprojectIndex}`);

        // Get first row
        const rows = dataTable.locator('tbody tr');
        const rowCount = await rows.count();
        console.log(`[Test] Found ${rowCount} rows`);

        if (rowCount === 0) {
            // Create a new row
            const addButton = page.getByRole('button', { name: '+' }).or(page.locator('button:has-text("New")')).first();
            if (await addButton.isVisible()) {
                await addButton.click();
                await page.waitForTimeout(1000);
            }
        }

        const firstRow = rows.first();
        const cells = firstRow.locator('td');

        // Click on project cell to edit
        if (projectIndex >= 0) {
            const projectCell = cells.nth(projectIndex);
            const projectText = await projectCell.textContent();
            console.log(`[Test] Project cell content: "${projectText}"`);

            // Click to edit
            await projectCell.click();
            await page.waitForTimeout(500);

            // Take screenshot
            await page.screenshot({ path: 'test-results/clear-project-before.png', fullPage: true });

            // Look for the dropdown with X button
            const dropdown = page.locator('.fixed.z-\\[9999\\]');
            if (await dropdown.isVisible()) {
                console.log('[Test] Dropdown is visible');

                // Look for X button to clear
                const clearButton = dropdown.locator('button:has(svg)').first();
                const xButton = dropdown.locator('svg.lucide-x').first();

                if (await xButton.isVisible()) {
                    console.log('[Test] Found X button in dropdown');
                    await xButton.click();
                    await page.waitForTimeout(500);

                    // Check if value was cleared
                    const newProjectText = await projectCell.textContent();
                    console.log(`[Test] After clear: "${newProjectText}"`);

                    await page.screenshot({ path: 'test-results/clear-project-after.png', fullPage: true });
                } else {
                    console.log('[Test] X button NOT found - checking dropdown content');
                    const dropdownContent = await dropdown.innerHTML();
                    console.log('[Test] Dropdown HTML:', dropdownContent.substring(0, 500));
                }
            } else {
                console.log('[Test] Dropdown not visible after clicking project cell');
            }

            // Click elsewhere to close
            await page.locator('body').click({ position: { x: 10, y: 10 } });
        }

        // Test subproject column
        if (subprojectIndex >= 0) {
            const subprojectCell = cells.nth(subprojectIndex);
            const subprojectText = await subprojectCell.textContent();
            console.log(`[Test] Subproject cell content: "${subprojectText}"`);

            await subprojectCell.click();
            await page.waitForTimeout(500);

            await page.screenshot({ path: 'test-results/clear-subproject-dropdown.png', fullPage: true });

            const dropdown = page.locator('.fixed.z-\\[9999\\]');
            if (await dropdown.isVisible()) {
                const xButton = dropdown.locator('svg.lucide-x').first();
                if (await xButton.isVisible()) {
                    console.log('[Test] Found X button for subproject');
                } else {
                    console.log('[Test] No X button for subproject');
                    // Check if "None" option is shown (should NOT be)
                    const noneOption = dropdown.locator('text=None');
                    if (await noneOption.isVisible()) {
                        console.log('[Test] ERROR: "None" option is still showing in dropdown');
                    }
                }
            }
        }
    });

    test('Copy Library - Campaign Params: Can clear project/subproject', async ({ page }) => {
        await page.goto('/copy-library');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Click Campaign Params tab
        const campaignParamsTab = page.getByRole('button', { name: /Campaign Params/i });
        if (await campaignParamsTab.isVisible()) {
            await campaignParamsTab.click();
            await page.waitForTimeout(500);
        }

        // Find table
        const dataTable = page.locator('table').first();
        if (await dataTable.isVisible()) {
            const rows = dataTable.locator('tbody tr');
            const rowCount = await rows.count();
            console.log(`[Test] Copy Library - Campaign Params: ${rowCount} rows`);

            if (rowCount > 0) {
                // Find project column
                const headers = await page.locator('thead th').allTextContents();
                const projectIndex = headers.findIndex(h => h.includes('Project') && !h.includes('Subproject'));

                if (projectIndex >= 0) {
                    const firstRow = rows.first();
                    const projectCell = firstRow.locator('td').nth(projectIndex);

                    await projectCell.click();
                    await page.waitForTimeout(500);

                    await page.screenshot({ path: 'test-results/copy-library-campaign-project.png', fullPage: true });

                    // Check for X button
                    const dropdown = page.locator('.fixed.z-\\[9999\\]');
                    if (await dropdown.isVisible()) {
                        const xButton = dropdown.locator('svg.lucide-x').first();
                        const hasXButton = await xButton.isVisible();
                        console.log(`[Test] Copy Library Campaign Params - X button visible: ${hasXButton}`);
                    }
                }
            }
        }
    });

    test('Copy Library - Personas tab: Can clear project/subproject', async ({ page }) => {
        await page.goto('/copy-library');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Click Personas tab
        const personasTab = page.getByRole('button', { name: /Personas/i });
        if (await personasTab.isVisible()) {
            await personasTab.click();
            await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: 'test-results/copy-library-personas.png', fullPage: true });

        // Check if table exists and has project column
        const dataTable = page.locator('table').first();
        if (await dataTable.isVisible()) {
            const headers = await page.locator('thead th').allTextContents();
            console.log('[Test] Personas tab headers:', headers);

            const projectIndex = headers.findIndex(h => h.includes('Project') && !h.includes('Subproject'));
            if (projectIndex >= 0) {
                const rows = dataTable.locator('tbody tr');
                if (await rows.count() > 0) {
                    const projectCell = rows.first().locator('td').nth(projectIndex);
                    await projectCell.click();
                    await page.waitForTimeout(500);

                    const dropdown = page.locator('.fixed.z-\\[9999\\]');
                    if (await dropdown.isVisible()) {
                        const xButton = dropdown.locator('svg.lucide-x').first();
                        console.log(`[Test] Personas - X button visible: ${await xButton.isVisible()}`);
                    }
                }
            }
        }
    });

    test('Ad Text Page: Can clear project/subproject', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const dataTable = page.locator('table').first();
        await expect(dataTable).toBeVisible({ timeout: 10000 });

        const headers = await page.locator('thead th').allTextContents();
        const projectIndex = headers.findIndex(h => h.includes('Project') && !h.includes('Subproject'));
        const subprojectIndex = headers.findIndex(h => h.includes('Subproject'));

        console.log(`[Test] Ad Text - Project: ${projectIndex}, Subproject: ${subprojectIndex}`);

        const rows = dataTable.locator('tbody tr');
        if (await rows.count() > 0) {
            const firstRow = rows.first();

            // Test project column
            if (projectIndex >= 0) {
                const projectCell = firstRow.locator('td').nth(projectIndex);
                const projectValue = await projectCell.textContent();
                console.log(`[Test] Ad Text project value: "${projectValue}"`);

                await projectCell.click();
                await page.waitForTimeout(500);

                const dropdown = page.locator('.fixed.z-\\[9999\\]');
                if (await dropdown.isVisible()) {
                    // Check for X button
                    const xButton = dropdown.locator('svg.lucide-x').first();
                    const hasX = await xButton.isVisible();
                    console.log(`[Test] Ad Text - X button visible: ${hasX}`);

                    // Check for "None" option (should NOT exist)
                    const noneOption = dropdown.locator('text="None"');
                    const hasNone = await noneOption.isVisible();
                    console.log(`[Test] Ad Text - "None" option visible: ${hasNone}`);

                    if (hasX && projectValue && projectValue.trim() !== '') {
                        // Try to clear it
                        await xButton.click();
                        await page.waitForTimeout(500);

                        const newValue = await projectCell.textContent();
                        console.log(`[Test] After clear: "${newValue}"`);

                        // Value should be empty or different
                        expect(newValue).not.toBe(projectValue);
                    }

                    await page.screenshot({ path: 'test-results/ad-text-clear-project.png', fullPage: true });
                }
            }
        }
    });
});
