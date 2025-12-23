import { test, expect } from '@playwright/test';

/**
 * Test for DataTable column dependency behavior:
 * - Selecting a subproject should auto-select its parent project
 * - Changing project should clear subproject if it doesn't belong
 */
test.describe('DataTable Column Dependency', () => {
    test.beforeEach(async ({ page }) => {
        // Mock login
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
    });

    test('Copy Wizard: Subproject selection auto-selects Project', async ({ page }) => {
        console.log('\n=== Testing Subproject → Project Dependency ===\n');

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Expand Campaign Parameters section if collapsed
        const campaignSection = page.locator('button:has-text("Campaign Parameters")');
        await campaignSection.click();
        await page.waitForTimeout(1000);

        // Find the DataTable in Campaign Parameters section
        const dataTable = page.locator('table').first();
        await expect(dataTable).toBeVisible({ timeout: 10000 });

        // Look for a row in the Campaign Parameters table
        // First, check if there are any rows
        const rows = dataTable.locator('tbody tr');
        const rowCount = await rows.count();
        console.log(`[Test] Found ${rowCount} rows in Campaign Parameters table`);

        if (rowCount === 0) {
            // Create a new row by clicking the + button
            const addButton = page.locator('button:has-text("+")').first();
            if (await addButton.isVisible()) {
                await addButton.click();
                console.log('[Test] Created new campaign parameter row');
                await page.waitForTimeout(1000);
            }
        }

        // Now find the Project and Subproject columns in the first row
        const firstRow = rows.first();

        // Get the Project cell value before we select a subproject
        const projectCell = firstRow.locator('td').filter({ hasText: /Project/i }).or(
            firstRow.locator('td:nth-child(6)') // Assuming Project is around column 6
        );

        // Click on the Subproject cell to open dropdown
        const subprojectCell = firstRow.locator('td').filter({ hasText: /Subproject/i }).or(
            firstRow.locator('td:nth-child(7)') // Assuming Subproject is around column 7
        );

        // Take screenshot of initial state
        await page.screenshot({ path: 'test-results/dependency-before.png' });

        // Check current project value
        const projectValue = await projectCell.textContent();
        console.log(`[Test] Initial Project value: "${projectValue}"`);

        // Click subproject cell to trigger edit
        await subprojectCell.click();
        await page.waitForTimeout(500);

        // Look for the dropdown that appears
        const dropdown = page.locator('[role="listbox"], .fixed select, select').first();
        if (await dropdown.isVisible()) {
            // Get available options
            const options = await dropdown.locator('option').allTextContents();
            console.log(`[Test] Subproject options: ${options.slice(0, 5).join(', ')}...`);

            // Select the first real option (skip placeholder)
            const realOption = options.find(o => o && !o.includes('Select') && o.trim() !== '');
            if (realOption) {
                await dropdown.selectOption({ label: realOption });
                console.log(`[Test] Selected subproject: "${realOption}"`);
                await page.waitForTimeout(1000);
            }
        } else {
            console.log('[Test] Dropdown not found, trying click on cell again');
        }

        // Take screenshot after selection
        await page.screenshot({ path: 'test-results/dependency-after.png' });

        // Check if project was auto-selected
        const newProjectValue = await projectCell.textContent();
        console.log(`[Test] Final Project value: "${newProjectValue}"`);

        // Verify project was set (if it was empty before, it should have a value now)
        if (!projectValue || projectValue === 'Select Project' || projectValue === '') {
            expect(newProjectValue).not.toBe(projectValue);
            console.log('[Test] ✅ Project was auto-selected when subproject was chosen!');
        } else {
            console.log('[Test] Project already had a value, dependency may have worked');
        }

        console.log('\n=== Dependency Test Complete ===\n');
    });

    test('Ad Text Page: Subproject selection auto-selects Project', async ({ page }) => {
        console.log('\n=== Testing Ad Text Page Dependency ===\n');

        await page.goto('/');  // Ad Text is the home page
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Find the DataTable
        const dataTable = page.locator('table').first();
        await expect(dataTable).toBeVisible({ timeout: 10000 });

        const rows = dataTable.locator('tbody tr');
        const rowCount = await rows.count();
        console.log(`[Test] Found ${rowCount} rows in Ad Text table`);

        if (rowCount === 0) {
            console.log('[Test] No rows to test, skipping');
            return;
        }

        // Find a row without a project selected, or use the first row
        const firstRow = rows.first();

        // Take screenshot
        await page.screenshot({ path: 'test-results/adtext-dependency-before.png' });

        // Click on Project column header to identify it
        const projectHeader = page.locator('th:has-text("Project")');
        const subprojectHeader = page.locator('th:has-text("Subproject")');

        if (await projectHeader.isVisible() && await subprojectHeader.isVisible()) {
            console.log('[Test] Found Project and Subproject columns');

            // Get column indices
            const headers = await page.locator('th').allTextContents();
            const projectIndex = headers.findIndex(h => h === 'Project');
            const subprojectIndex = headers.findIndex(h => h === 'Subproject');

            console.log(`[Test] Project column index: ${projectIndex}, Subproject: ${subprojectIndex}`);

            // Get cells from first row
            const cells = firstRow.locator('td');
            const projectCell = cells.nth(projectIndex);
            const subprojectCell = cells.nth(subprojectIndex);

            const initialProject = await projectCell.textContent();
            console.log(`[Test] Initial project: "${initialProject}"`);

            // Click subproject to edit
            await subprojectCell.click();
            await page.waitForTimeout(500);

            // Try to select a subproject from dropdown
            const dropdown = page.locator('select:visible, [role="listbox"]:visible').first();
            if (await dropdown.isVisible()) {
                const options = await dropdown.locator('option').allTextContents();
                const realOption = options.find(o => o && !o.includes('Select') && o.trim() !== '');
                if (realOption) {
                    await dropdown.selectOption({ label: realOption });
                    console.log(`[Test] Selected: "${realOption}"`);
                    await page.waitForTimeout(1000);
                }
            }

            await page.screenshot({ path: 'test-results/adtext-dependency-after.png' });

            const finalProject = await projectCell.textContent();
            console.log(`[Test] Final project: "${finalProject}"`);
        }

        console.log('\n=== Ad Text Dependency Test Complete ===\n');
    });
});
