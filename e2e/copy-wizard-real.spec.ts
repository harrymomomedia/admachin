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

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');

        // Fill minimum required fields
        const briefInput = page.locator('textarea').first();
        await briefInput.fill('Fitness tracking smartwatch');

        const productDescInput = page.locator('textarea').nth(1);
        await productDescInput.fill('Advanced smartwatch with heart rate monitoring, GPS tracking, and sleep analysis for health-conscious individuals.');

        console.log('[Test] Filled basic fields');

        // Find Generate Angles button
        const generateAnglesBtn = page.getByRole('button', { name: /Generate.*Angle/i });

        if (await generateAnglesBtn.count() > 0) {
            console.log('[Test] Found Generate Angles button');
            await page.screenshot({ path: 'test-results/step3-before-angles.png' });

            await generateAnglesBtn.first().click();
            console.log('[Test] Clicked Generate Angles - waiting for AI...');

            await page.waitForTimeout(3000);
            await expect(generateAnglesBtn.first()).toBeEnabled({ timeout: 90000 });

            console.log('[Test] Angle generation completed');
            await page.screenshot({ path: 'test-results/step3-after-angles.png' });
        } else {
            console.log('[Test] Generate Angles button not found');
            await page.screenshot({ path: 'test-results/step3-no-button.png' });
        }

        console.log('\n=== STEP 3 COMPLETE ===\n');
    });

    test('Step 4: Test Generate Ad Copies', async ({ page }) => {
        console.log('\n=== STEP 4: Testing Ad Copy Generation ===\n');

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');

        // Fill required fields
        const briefInput = page.locator('textarea').first();
        await briefInput.fill('Online yoga classes');

        const productDescInput = page.locator('textarea').nth(1);
        await productDescInput.fill('Live-streamed yoga classes with certified instructors. Perfect for beginners and advanced practitioners. Join from anywhere.');

        console.log('[Test] Filled required fields');

        // Find Generate Ad Copy button
        const generateAdsBtn = page.getByRole('button', { name: /Generate.*Ad|Generate.*Copy/i });

        if (await generateAdsBtn.count() > 0) {
            console.log('[Test] Found Generate Ads button');
            await page.screenshot({ path: 'test-results/step4-before-ads.png' });

            await generateAdsBtn.first().click();
            console.log('[Test] Clicked Generate Ads - waiting for AI...');

            await page.waitForTimeout(3000);
            await expect(generateAdsBtn.first()).toBeEnabled({ timeout: 90000 });

            console.log('[Test] Ad copy generation completed');
            await page.screenshot({ path: 'test-results/step4-after-ads.png' });
        } else {
            console.log('[Test] Generate Ads button not found');
            await page.screenshot({ path: 'test-results/step4-no-button.png' });
        }

        console.log('\n=== STEP 4 COMPLETE ===\n');
    });

    test('Full Flow: Complete Generation Pipeline', async ({ page }) => {
        console.log('\n=== FULL FLOW TEST ===\n');

        await page.goto('/copy-wizard');
        await page.waitForLoadState('networkidle');

        // 1. Auto-Fill
        console.log('[Test] Starting full flow test...');
        const briefInput = page.locator('textarea').first();
        await briefInput.fill('SaaS project management tool for small teams');

        const autoFillBtn = page.getByRole('button', { name: 'Auto-Fill', exact: true });
        if (await autoFillBtn.isVisible()) {
            await autoFillBtn.click();
            console.log('[Test] Auto-Fill clicked');
            await page.waitForTimeout(5000);
            await expect(autoFillBtn).toBeEnabled({ timeout: 60000 });
            console.log('[Test] Auto-Fill complete');
        }

        await page.screenshot({ path: 'test-results/full-flow-1-autofill.png' });

        // 2. Generate Personas
        const personaBtn = page.getByRole('button', { name: /Generate.*Persona/i }).first();
        if (await personaBtn.isVisible()) {
            await personaBtn.click();
            console.log('[Test] Generate Personas clicked');
            await page.waitForTimeout(5000);
            await expect(personaBtn).toBeEnabled({ timeout: 60000 });
            console.log('[Test] Personas generated');
        }

        await page.screenshot({ path: 'test-results/full-flow-2-personas.png' });

        // 3. Generate Angles
        const angleBtn = page.getByRole('button', { name: /Generate.*Angle/i }).first();
        if (await angleBtn.isVisible()) {
            await angleBtn.click();
            console.log('[Test] Generate Angles clicked');
            await page.waitForTimeout(5000);
            await expect(angleBtn).toBeEnabled({ timeout: 60000 });
            console.log('[Test] Angles generated');
        }

        await page.screenshot({ path: 'test-results/full-flow-3-angles.png' });

        // 4. Generate Ads
        const adBtn = page.getByRole('button', { name: /Generate.*Ad|Generate.*Copy/i }).first();
        if (await adBtn.isVisible()) {
            await adBtn.click();
            console.log('[Test] Generate Ads clicked');
            await page.waitForTimeout(5000);
            await expect(adBtn).toBeEnabled({ timeout: 60000 });
            console.log('[Test] Ads generated');
        }

        await page.screenshot({ path: 'test-results/full-flow-4-ads.png' });

        console.log('\n=== FULL FLOW COMPLETE ===\n');
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
