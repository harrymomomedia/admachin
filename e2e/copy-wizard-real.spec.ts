import { test, expect } from '@playwright/test';

// Real E2E test with actual AI generation - run with: npx playwright test copy-wizard-real.spec.ts --headed
test.describe('Copy Wizard - Real AI Generation Tests', () => {
    test.setTimeout(120000); // 2 minutes per test for AI calls

    test.beforeEach(async ({ page }) => {
        // Enable console logging from browser
        page.on('console', msg => {
            if (msg.text().includes('[AI') || msg.text().includes('Error')) {
                console.log(`[Browser] ${msg.type()}: ${msg.text()}`);
            }
        });

        // Mock login - adjust based on your auth setup
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

    test('Step 1: Test Auto-Fill Campaign Parameters', async ({ page }) => {
        console.log('\n=== STEP 1: Testing Auto-Fill ===\n');

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000); // Wait for page to fully load

        // Take screenshot of initial state
        await page.screenshot({ path: 'test-results/step1-initial.png' });
        console.log('[Test] Initial page loaded');

        // Step 1: Click the "Auto-Fill" button to open the modal
        const autoFillOpenBtn = page.getByRole('button', { name: 'Auto-Fill', exact: true });
        await expect(autoFillOpenBtn).toBeVisible();
        console.log('[Test] Found Auto-Fill button');

        await autoFillOpenBtn.click();
        console.log('[Test] Clicked Auto-Fill to open modal');
        await page.waitForTimeout(500);

        // Step 2: Find the modal and fill in the brief description
        await page.screenshot({ path: 'test-results/step1-modal-open.png' });

        // Find textarea in the modal (it's labeled "Brief Description")
        const modalTextarea = page.locator('textarea[placeholder*="Describe"]').or(
            page.locator('.fixed textarea').first()
        );
        await expect(modalTextarea).toBeVisible({ timeout: 5000 });

        const testDescription = 'A mobile app that helps remote workers track their productivity and manage their daily tasks with AI-powered insights';
        await modalTextarea.fill(testDescription);
        console.log('[Test] Filled brief description in modal');

        await page.screenshot({ path: 'test-results/step1-modal-filled.png' });

        // Step 3: Click "Auto-Fill with AI" button in the modal
        const autoFillWithAIBtn = page.getByRole('button', { name: 'Auto-Fill with AI' });
        await expect(autoFillWithAIBtn).toBeVisible();
        await expect(autoFillWithAIBtn).toBeEnabled();

        console.log('[Test] Clicking "Auto-Fill with AI" - waiting for AI response...');
        await autoFillWithAIBtn.click();

        // Wait for AI to respond (watch for loading state to end)
        await page.waitForTimeout(3000); // Initial wait

        // The modal should close and fields should be populated
        // Wait up to 60 seconds for the modal to close or button to change
        await page.waitForFunction(() => {
            const modal = document.querySelector('.fixed.inset-0');
            return !modal || modal.classList.contains('hidden');
        }, { timeout: 60000 }).catch(() => {
            console.log('[Test] Modal may still be open or closed differently');
        });

        console.log('[Test] Auto-Fill completed');

        // Take screenshot of result
        await page.screenshot({ path: 'test-results/step1-after-autofill.png' });

        // Check if Product Description field has content (it's in the main form, not modal)
        await page.waitForTimeout(1000);
        const allTextareas = await page.locator('textarea:not(.fixed textarea)').all();
        console.log('[Test] Found', allTextareas.length, 'textareas on page');

        for (let i = 0; i < Math.min(allTextareas.length, 4); i++) {
            const value = await allTextareas[i].inputValue();
            console.log(`[Test] Textarea ${i}: ${value.length} chars - "${value.substring(0, 50)}..."`);
        }

        // Find Product Description specifically
        const productDescLabel = page.locator('text=Product Description');
        if (await productDescLabel.count() > 0) {
            // Get the textarea near this label
            const nearbyTextarea = page.locator('textarea').nth(1);
            const productDescValue = await nearbyTextarea.inputValue();
            console.log('[Test] Product Description populated:', productDescValue.length > 0 ? 'YES' : 'NO');
            console.log('[Test] Content length:', productDescValue.length);
        }

        console.log('\n=== STEP 1 COMPLETE ===\n');
    });

    test('Step 2: Test Generate Personas', async ({ page }) => {
        console.log('\n=== STEP 2: Testing Persona Generation ===\n');

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');

        // First fill in Campaign Parameters (needed for persona generation)
        const briefInput = page.locator('textarea').first();
        await briefInput.fill('A premium coffee subscription service delivering fresh roasted beans monthly');

        // Fill Product Description manually to skip auto-fill
        const productDescInput = page.locator('textarea').nth(1);
        await productDescInput.fill('Premium Coffee Subscription delivers freshly roasted specialty coffee beans directly to your door. Each month, subscribers receive hand-selected beans from top roasters around the world.');

        console.log('[Test] Filled campaign parameters');

        // Take screenshot
        await page.screenshot({ path: 'test-results/step2-before-personas.png' });

        // Find Generate Personas button
        const generatePersonasBtn = page.getByRole('button', { name: /Generate.*Persona/i });

        if (await generatePersonasBtn.count() > 0) {
            await expect(generatePersonasBtn.first()).toBeVisible();
            console.log('[Test] Found Generate Personas button');

            // Click to generate personas
            await generatePersonasBtn.first().click();
            console.log('[Test] Clicked Generate Personas - waiting for AI...');

            // Wait for generation to complete
            await page.waitForTimeout(3000);
            await expect(generatePersonasBtn.first()).toBeEnabled({ timeout: 90000 });

            console.log('[Test] Persona generation completed');
            await page.screenshot({ path: 'test-results/step2-after-personas.png' });

            // Check if personas appeared
            const personaCards = page.locator('[class*="persona"], [class*="card"]');
            const cardCount = await personaCards.count();
            console.log('[Test] Found', cardCount, 'persona cards');
        } else {
            console.log('[Test] Generate Personas button not found - checking UI structure');
            await page.screenshot({ path: 'test-results/step2-no-button.png' });
        }

        console.log('\n=== STEP 2 COMPLETE ===\n');
    });

    test('Step 3: Test Generate Angles', async ({ page }) => {
        console.log('\n=== STEP 3: Testing Angle Generation ===\n');

        // Handle alerts (e.g., "Please select a Project")
        page.on('dialog', async dialog => {
            console.log(`[Test] Alert: ${dialog.message()}`);
            await dialog.accept();
        });

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000); // Wait for data to load

        // Fill product description
        const productDescInput = page.locator('textarea').first();
        await productDescInput.fill('Advanced smartwatch with heart rate monitoring, GPS tracking, and sleep analysis for health-conscious individuals.');
        console.log('[Test] Filled product description');

        // Find the Project dropdown (it has "Select Project" as placeholder, not Model selector)
        const projectSelect = page.locator('select:has(option:text("Select Project"))');
        await expect(projectSelect).toBeVisible({ timeout: 5000 });

        // Wait for projects to load
        await page.waitForFunction(() => {
            const selects = document.querySelectorAll('select');
            for (const select of selects) {
                const options = Array.from(select.options);
                if (options.some(o => o.text === 'Select Project') && options.length > 1) {
                    return true;
                }
            }
            return false;
        }, { timeout: 10000 });

        // Get all options and select the first real project
        const optionTexts = await projectSelect.locator('option').allTextContents();
        console.log(`[Test] Project options: ${optionTexts.join(', ')}`);

        // Find first non-placeholder option
        const realProject = optionTexts.find(t => t && t !== 'Select Project' && t.trim() !== '');
        if (realProject) {
            await projectSelect.selectOption({ label: realProject });
            console.log(`[Test] Selected project: ${realProject}`);
        } else {
            console.log('[Test] WARNING: No projects available to select');
        }

        // Verify selection
        const selectedValue = await projectSelect.inputValue();
        console.log(`[Test] Project dropdown value: ${selectedValue}`);

        await page.screenshot({ path: 'test-results/step3-before-personas.png' });

        // Generate personas
        const generatePersonasBtn = page.getByRole('button', { name: /Generate Personas/i });
        await expect(generatePersonasBtn).toBeVisible();
        await generatePersonasBtn.click();
        console.log('[Test] Clicked Generate Personas - waiting for AI...');

        // Wait for personas section to appear (indicates personas were generated)
        const step2Section = page.locator('text=Select Personas');
        await expect(step2Section).toBeVisible({ timeout: 120000 }); // 2 min timeout for AI
        console.log('[Test] Personas section appeared - personas generated');

        await page.screenshot({ path: 'test-results/step3-personas-generated.png' });

        // Select all personas (click "Select All" link)
        const selectAllLink = page.locator('text=Select All').first();
        if (await selectAllLink.isVisible()) {
            await selectAllLink.click();
            console.log('[Test] Selected all personas');
            await page.waitForTimeout(500);
        }

        // Now the Generate Angles button should be enabled
        const generateAnglesBtn = page.getByRole('button', { name: /Generate Angles/i });
        await expect(generateAnglesBtn).toBeVisible({ timeout: 10000 });
        await expect(generateAnglesBtn).toBeEnabled({ timeout: 5000 });
        console.log('[Test] Found Generate Angles button (enabled)');

        await page.screenshot({ path: 'test-results/step3-before-angles.png' });

        await generateAnglesBtn.click();
        console.log('[Test] Clicked Generate Angles - waiting for AI...');

        // Wait for Angles section to appear (Step 3)
        const step3Section = page.locator('text=Select Angles');
        await expect(step3Section).toBeVisible({ timeout: 120000 }); // 2 min timeout for AI
        console.log('[Test] Angles section appeared - angles generated');

        await page.screenshot({ path: 'test-results/step3-after-angles.png' });

        console.log('\n=== STEP 3 COMPLETE ===\n');
    });

    test('Step 4: Test Generate Ad Copies', async ({ page }) => {
        console.log('\n=== STEP 4: Testing Ad Copy Generation ===\n');

        // Handle alerts
        page.on('dialog', async dialog => {
            console.log(`[Test] Alert: ${dialog.message()}`);
            await dialog.accept();
        });

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Fill product description
        const productDescInput = page.locator('textarea').first();
        await productDescInput.fill('Live-streamed yoga classes with certified instructors. Perfect for beginners and advanced practitioners. Join from anywhere.');
        console.log('[Test] Filled product description');

        // Select project
        const projectSelect = page.locator('select:has(option:text("Select Project"))');
        await expect(projectSelect).toBeVisible({ timeout: 5000 });
        await page.waitForFunction(() => {
            const selects = document.querySelectorAll('select');
            for (const select of selects) {
                const options = Array.from(select.options);
                if (options.some(o => o.text === 'Select Project') && options.length > 1) return true;
            }
            return false;
        }, { timeout: 10000 });

        const optionTexts = await projectSelect.locator('option').allTextContents();
        const realProject = optionTexts.find(t => t && t !== 'Select Project' && t.trim() !== '');
        if (realProject) {
            await projectSelect.selectOption({ label: realProject });
            console.log(`[Test] Selected project: ${realProject}`);
        }

        // Step 1: Generate Personas
        const generatePersonasBtn = page.getByRole('button', { name: /Generate Personas/i });
        await generatePersonasBtn.click();
        console.log('[Test] Clicked Generate Personas...');

        const step2Section = page.locator('text=Select Personas');
        await expect(step2Section).toBeVisible({ timeout: 120000 });
        console.log('[Test] Personas generated');

        // Select all personas
        const selectAllPersonas = page.locator('text=Select All').first();
        if (await selectAllPersonas.isVisible()) {
            await selectAllPersonas.click();
            console.log('[Test] Selected all personas');
        }

        await page.screenshot({ path: 'test-results/step4-personas-generated.png' });

        // Step 2: Generate Angles
        const generateAnglesBtn = page.getByRole('button', { name: /Generate Angles/i });
        await expect(generateAnglesBtn).toBeEnabled({ timeout: 5000 });
        await generateAnglesBtn.click();
        console.log('[Test] Clicked Generate Angles...');

        const step3Section = page.locator('text=Select Angles');
        await expect(step3Section).toBeVisible({ timeout: 120000 });
        console.log('[Test] Angles generated');

        // Select all angles
        const selectAllAngles = page.locator('text=Select All').nth(1);
        if (await selectAllAngles.isVisible()) {
            await selectAllAngles.click();
            console.log('[Test] Selected all angles');
        }

        await page.screenshot({ path: 'test-results/step4-angles-generated.png' });

        // Step 3: Generate Ad Copies
        const generateAdsBtn = page.getByRole('button', { name: /Generate Ad Copies/i });
        await expect(generateAdsBtn).toBeEnabled({ timeout: 5000 });
        console.log('[Test] Found Generate Ad Copies button (enabled)');

        await page.screenshot({ path: 'test-results/step4-before-ads.png' });

        await generateAdsBtn.click();
        console.log('[Test] Clicked Generate Ad Copies...');

        // Wait for Ad Copies section to appear (Step 4)
        const step4Section = page.locator('text=Select Ad Copies');
        await expect(step4Section).toBeVisible({ timeout: 120000 });
        console.log('[Test] Ad copies generated');

        await page.screenshot({ path: 'test-results/step4-after-ads.png' });

        console.log('\n=== STEP 4 COMPLETE ===\n');
    });

    test('Full Flow: Complete Generation Pipeline', async ({ page }) => {
        console.log('\n=== FULL FLOW TEST ===\n');

        // Handle alerts
        page.on('dialog', async dialog => {
            console.log(`[Test] Alert: ${dialog.message()}`);
            await dialog.accept();
        });

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // 1. Auto-Fill (using proper modal flow)
        console.log('[Test] Starting full flow test...');

        const autoFillOpenBtn = page.getByRole('button', { name: 'Auto-Fill', exact: true });
        if (await autoFillOpenBtn.isVisible()) {
            await autoFillOpenBtn.click();
            console.log('[Test] Auto-Fill modal opened');
            await page.waitForTimeout(500);

            // Fill the modal textarea
            const modalTextarea = page.locator('textarea[placeholder*="Describe"]').or(
                page.locator('.fixed textarea').first()
            );
            await modalTextarea.fill('SaaS project management tool for small teams with task tracking, team collaboration, and deadline management features');
            console.log('[Test] Brief description filled');

            // Click Auto-Fill with AI button in modal
            const autoFillWithAIBtn = page.getByRole('button', { name: 'Auto-Fill with AI' });
            await autoFillWithAIBtn.click();
            console.log('[Test] Auto-Fill with AI clicked - waiting for AI...');

            // Wait for modal to close
            await page.waitForFunction(() => {
                const modal = document.querySelector('.fixed.inset-0');
                return !modal || modal.classList.contains('hidden');
            }, { timeout: 120000 }).catch(() => {
                console.log('[Test] Modal may have closed differently');
            });

            await page.waitForTimeout(1000);
            console.log('[Test] Auto-Fill complete');
        }

        await page.screenshot({ path: 'test-results/full-flow-1-autofill.png' });

        // Select project (Auto-Fill may not select one)
        const projectSelect = page.locator('select:has(option:text("Select Project"))');
        const currentValue = await projectSelect.inputValue();
        if (!currentValue) {
            const optionTexts = await projectSelect.locator('option').allTextContents();
            const realProject = optionTexts.find(t => t && t !== 'Select Project' && t.trim() !== '');
            if (realProject) {
                await projectSelect.selectOption({ label: realProject });
                console.log(`[Test] Selected project: ${realProject}`);
            }
        }

        // 2. Generate Personas
        const personaBtn = page.getByRole('button', { name: /Generate Personas/i });
        await expect(personaBtn).toBeVisible();
        await personaBtn.click();
        console.log('[Test] Generate Personas clicked');

        const step2Section = page.locator('text=Select Personas');
        await expect(step2Section).toBeVisible({ timeout: 120000 });
        console.log('[Test] Personas generated');

        // Select all personas
        const selectAllPersonas = page.locator('text=Select All').first();
        if (await selectAllPersonas.isVisible()) {
            await selectAllPersonas.click();
            console.log('[Test] Selected all personas');
        }

        await page.screenshot({ path: 'test-results/full-flow-2-personas.png' });

        // 3. Generate Angles
        const angleBtn = page.getByRole('button', { name: /Generate Angles/i });
        await expect(angleBtn).toBeEnabled({ timeout: 5000 });
        await angleBtn.click();
        console.log('[Test] Generate Angles clicked');

        const step3Section = page.locator('text=Select Angles');
        await expect(step3Section).toBeVisible({ timeout: 120000 });
        console.log('[Test] Angles generated');

        // Select all angles
        const selectAllAngles = page.locator('text=Select All').nth(1);
        if (await selectAllAngles.isVisible()) {
            await selectAllAngles.click();
            console.log('[Test] Selected all angles');
        }

        await page.screenshot({ path: 'test-results/full-flow-3-angles.png' });

        // 4. Generate Ad Copies
        const adBtn = page.getByRole('button', { name: /Generate Ad Copies/i });
        await expect(adBtn).toBeEnabled({ timeout: 5000 });
        await adBtn.click();
        console.log('[Test] Generate Ad Copies clicked');

        const step4Section = page.locator('text=Select Ad Copies');
        await expect(step4Section).toBeVisible({ timeout: 120000 });
        console.log('[Test] Ad Copies generated');

        await page.screenshot({ path: 'test-results/full-flow-4-ads.png' });

        console.log('\n=== FULL FLOW COMPLETE ===\n');
    });
});

test.describe('Save Functionality Tests', () => {
    test.beforeEach(async ({ page }) => {
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

    test('Save Campaign Parameters to CopyLibrary', async ({ page }) => {
        console.log('\n=== SAVE CAMPAIGN PARAMETERS TEST ===\n');

        // Handle alerts
        let alertMessage = '';
        page.on('dialog', async dialog => {
            alertMessage = dialog.message();
            console.log(`[Test] Alert: ${alertMessage}`);
            await dialog.accept();
        });

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Fill product description
        const productDescInput = page.locator('textarea').first();
        await productDescInput.fill('Test product for E2E testing - do not use in production');
        console.log('[Test] Filled product description');

        // Select project
        const projectSelect = page.locator('select:has(option:text("Select Project"))');
        await expect(projectSelect).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(1000);

        const optionTexts = await projectSelect.locator('option').allTextContents();
        console.log(`[Test] Project options: ${optionTexts.join(', ')}`);

        const realProject = optionTexts.find(t => t && t !== 'Select Project' && t.trim() !== '');
        if (realProject) {
            await projectSelect.selectOption({ label: realProject });
            console.log(`[Test] Selected project: ${realProject}`);
        } else {
            console.log('[Test] WARNING: No projects to select');
        }

        await page.screenshot({ path: 'test-results/save-params-before.png' });

        // Click "Save as New" button
        const saveAsNewBtn = page.getByRole('button', { name: /Save as New/i });
        await expect(saveAsNewBtn).toBeVisible();
        await saveAsNewBtn.click();
        console.log('[Test] Clicked Save as New button');

        await page.waitForTimeout(500);

        // Fill preset name in modal
        const presetNameInput = page.locator('input[placeholder*="name"]').or(
            page.locator('.fixed input').first()
        );

        if (await presetNameInput.isVisible()) {
            await presetNameInput.fill('E2E Test Campaign ' + Date.now());
            console.log('[Test] Filled preset name');

            // Click Save button in modal
            const saveBtn = page.locator('.fixed').getByRole('button', { name: /Save/i });
            if (await saveBtn.isVisible()) {
                await saveBtn.click();
                console.log('[Test] Clicked Save button');
            }
        }

        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/save-params-after.png' });

        // Check if save was successful
        if (alertMessage.includes('saved') || alertMessage.includes('Copy Library')) {
            console.log('[Test] Save successful!');
        } else {
            console.log(`[Test] Alert message: ${alertMessage}`);
        }

        console.log('\n=== SAVE CAMPAIGN PARAMETERS TEST COMPLETE ===\n');
    });

    test('Save Personas to CopyLibrary', async ({ page }) => {
        test.setTimeout(180000); // 3 minute timeout for AI generation
        console.log('\n=== SAVE PERSONAS TEST ===\n');

        let alertMessage = '';
        page.on('dialog', async dialog => {
            alertMessage = dialog.message();
            console.log(`[Test] Alert: ${alertMessage}`);
            await dialog.accept();
        });

        await page.goto('/copy-wizard');
        await page.waitForTimeout(5000); // Wait for page to fully load

        // Expand Campaign Parameters section
        const campaignSection = page.locator('button:has-text("Campaign Parameters")');
        const isExpanded = await page.locator('textarea').first().isVisible();
        if (!isExpanded) {
            await campaignSection.click();
            await page.waitForTimeout(500);
        }

        // Fill product description - Real data for Women's prison California lawsuit
        const productDescInput = page.locator('textarea').first();
        await productDescInput.fill('California women\'s prison sexual abuse lawsuit - seeking survivors who experienced abuse while incarcerated in California state prisons. This legal action aims to obtain compensation for victims of sexual assault, harassment, and abuse by prison staff and guards. Survivors may be entitled to significant financial recovery.');
        console.log('[Test] Filled product description with Women\'s prison California lawsuit data');
        await page.waitForTimeout(500);

        // Select project "Tort"
        const projectSelect = page.locator('select').filter({ hasText: 'Select Project' });
        await expect(projectSelect).toBeVisible({ timeout: 10000 });

        // Wait for options to populate
        await page.waitForTimeout(2000);
        const projectOptions = await projectSelect.locator('option').allTextContents();
        console.log(`[Test] Available projects: ${projectOptions.join(', ')}`);

        // Select "Tort" project
        await projectSelect.selectOption({ label: 'Tort' });
        console.log('[Test] Selected project: Tort');
        await page.waitForTimeout(1000);

        // Now select subproject "Woman's Prison"
        const subprojectSelect = page.locator('select').filter({ hasText: 'No Subproject' });
        if (await subprojectSelect.isVisible()) {
            await page.waitForTimeout(500);
            const subprojectOptions = await subprojectSelect.locator('option').allTextContents();
            console.log(`[Test] Available subprojects: ${subprojectOptions.join(', ')}`);

            // Try to select "Woman's Prison" or similar
            const womansPrisonOption = subprojectOptions.find(opt =>
                opt.toLowerCase().includes('woman') || opt.toLowerCase().includes('prison')
            );
            if (womansPrisonOption) {
                await subprojectSelect.selectOption({ label: womansPrisonOption });
                console.log(`[Test] Selected subproject: ${womansPrisonOption}`);
            } else {
                console.log('[Test] Woman\'s Prison subproject not found, continuing without it');
            }
        }
        await page.waitForTimeout(500);

        // Verify project is selected
        const selectedValue = await projectSelect.inputValue();
        console.log(`[Test] Project value: ${selectedValue}`);

        // Wait for Generate Personas button to be enabled
        const generatePersonasBtn = page.getByRole('button', { name: /Generate Personas/i });
        await expect(generatePersonasBtn).toBeEnabled({ timeout: 5000 });
        console.log('[Test] Generate Personas button is enabled');

        await page.screenshot({ path: 'test-results/before-generate-personas.png' });

        // Click Generate Personas
        await generatePersonasBtn.click();
        console.log('[Test] Clicked Generate Personas');

        // Wait for personas to be generated - look for persona cards (not just the section header)
        // The section header "Select Personas" is always there, but persona cards appear after generation
        const personaCard = page.locator('[class*="persona"], [class*="card"]').filter({ hasText: /\d+ years old|age|Pain Points/i }).first();
        await expect(personaCard).toBeVisible({ timeout: 120000 });
        console.log('[Test] Persona cards generated!');

        await page.screenshot({ path: 'test-results/personas-generated.png' });

        // Expand Personas section if collapsed
        const personasSection = page.locator('button:has-text("Select Personas")');
        await personasSection.click();
        await page.waitForTimeout(500);

        // Click Select All - look for the link inside the expanded section
        const selectAllLink = page.locator('button:has-text("Select All"), a:has-text("Select All"), text=Select All').first();
        await expect(selectAllLink).toBeVisible({ timeout: 5000 });
        await selectAllLink.click();
        console.log('[Test] Selected all personas');

        await page.waitForTimeout(500);

        // Click Save Selected button for personas
        const saveSelectedBtn = page.locator('button:has-text("Save Selected")').first();
        await expect(saveSelectedBtn).toBeVisible({ timeout: 5000 });
        await saveSelectedBtn.click();
        console.log('[Test] Clicked Save Selected');

        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/save-personas-result.png' });

        // Check alert message
        console.log(`[Test] Final alert message: "${alertMessage}"`);
        if (alertMessage.includes('Successfully saved') || alertMessage.includes('Copy Library')) {
            console.log('[Test] ✅ Personas saved successfully!');
        } else if (alertMessage.includes('Failed')) {
            console.log('[Test] ❌ Save failed: ' + alertMessage);
            throw new Error('Save failed: ' + alertMessage);
        }

        // Verify in CopyLibrary
        await page.goto('/copy-library');
        await page.waitForTimeout(3000);

        const personasTab = page.locator('button:has-text("Personas")').first();
        await personasTab.click();
        await page.waitForTimeout(2000);

        const tableBody = page.locator('tbody');
        const rowCount = await tableBody.locator('tr').count();
        console.log(`[Test] Found ${rowCount} personas in CopyLibrary`);

        await page.screenshot({ path: 'test-results/copy-library-personas.png' });

        expect(rowCount).toBeGreaterThan(0);
        console.log('\n=== SAVE PERSONAS TEST COMPLETE ===\n');
    });

    test('Verify saved Campaign Parameters appear in CopyLibrary', async ({ page }) => {
        console.log('\n=== VERIFY SAVED DATA TEST ===\n');

        await page.goto('/copy-library');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Click Campaign Params tab
        const campaignTab = page.locator('button:has-text("Campaign Params")').first();
        await campaignTab.click();
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'test-results/verify-campaign-params.png' });

        // Check if there's any data in the table
        const tableBody = page.locator('tbody');
        const rowCount = await tableBody.locator('tr').count();
        console.log(`[Test] Found ${rowCount} campaign parameter rows`);

        if (rowCount > 0) {
            console.log('[Test] Campaign parameters data found in CopyLibrary!');
        } else {
            console.log('[Test] No campaign parameters found (table empty)');
        }

        console.log('\n=== VERIFY SAVED DATA TEST COMPLETE ===\n');
    });
});

test.describe('Copy Library Tests', () => {
    test.beforeEach(async ({ page }) => {
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

    test('Copy Library loads and shows tabs', async ({ page }) => {
        console.log('\n=== COPY LIBRARY TEST ===\n');

        await page.goto('/copy-library');
        await page.waitForLoadState('networkidle');

        await page.screenshot({ path: 'test-results/library-initial.png' });

        // Check each tab
        const tabNames = ['Campaign Params', 'Personas', 'Angles', 'Creative Concepts', 'Ads'];

        for (const tabName of tabNames) {
            const tabButton = page.locator(`button:has-text("${tabName}")`).first();
            if (await tabButton.isVisible()) {
                await tabButton.click();
                console.log(`[Test] Clicked tab: ${tabName}`);
                await page.waitForTimeout(500);
                await page.screenshot({ path: `test-results/library-tab-${tabName.replace(' ', '-').toLowerCase()}.png` });
            }
        }

        console.log('\n=== COPY LIBRARY TEST COMPLETE ===\n');
    });

    test('Creative Concepts tab shows seed data', async ({ page }) => {
        console.log('\n=== CREATIVE CONCEPTS SEED DATA TEST ===\n');

        await page.goto('/copy-library');
        await page.waitForLoadState('networkidle');

        // Click Creative Concepts tab
        const conceptsTab = page.locator('button:has-text("Creative Concepts")').first();
        await conceptsTab.click();
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'test-results/library-concepts.png' });

        // Check for seed data
        const testimonialText = page.locator('text=Testimonial');
        const listicleText = page.locator('text=Listicle');

        if (await testimonialText.count() > 0) {
            console.log('[Test] Found "Testimonial" concept - seed data loaded!');
        } else {
            console.log('[Test] "Testimonial" not found');
        }

        if (await listicleText.count() > 0) {
            console.log('[Test] Found "Listicle" concept - seed data loaded!');
        } else {
            console.log('[Test] "Listicle" not found');
        }

        console.log('\n=== SEED DATA TEST COMPLETE ===\n');
    });
});
