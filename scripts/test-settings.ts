/**
 * Test script to find and click the settings button on Sora
 * Does NOT generate video - just tests settings panel
 */

import { chromium } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_DATA_DIR = path.join(__dirname, '..', 'playwright-data', 'sora-session');
const SORA_DRAFTS_URL = 'https://sora.chatgpt.com/drafts';

async function testSettings() {
    console.log('🧪 Testing Settings Panel Detection');
    console.log('━'.repeat(50));

    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    try {
        // Navigate to drafts
        console.log('→ Navigating to Sora drafts...');
        await page.goto(SORA_DRAFTS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);

        // Check if logged in - wait for textarea to appear
        let promptInput = page.locator('textarea').first();
        let isLoggedIn = await promptInput.isVisible({ timeout: 5000 }).catch(() => false);

        if (!isLoggedIn) {
            console.log('⚠ Not logged in - please log in manually in the browser window');
            console.log('  Waiting up to 2 minutes for login...');

            // Wait for login - check every 5 seconds for up to 2 minutes
            for (let i = 0; i < 24; i++) {
                await page.waitForTimeout(5000);
                isLoggedIn = await promptInput.isVisible({ timeout: 2000 }).catch(() => false);
                if (isLoggedIn) {
                    console.log('✓ Login detected!');
                    break;
                }
                console.log(`  Still waiting for login... (${(i + 1) * 5}s)`);
            }

            if (!isLoggedIn) {
                console.log('✗ Login timeout - exiting');
                await context.close();
                return;
            }
        } else {
            console.log('✓ Already logged in');
        }

        // Fill a test prompt
        console.log('→ Filling test prompt...');
        await promptInput.fill('Test prompt for settings detection');
        await page.waitForTimeout(1000);
        console.log('✓ Prompt filled');

        // Find the Settings button by aria-label (there are 2, we want the one in the prompt bar)
        // The prompt bar one is on the right side (high X), sidebar one is on the left (low X)
        console.log('\n→ Looking for Settings button (aria-label="Settings")...');
        const settingsButtons = page.locator('button[aria-label="Settings"]');
        const settingsCount = await settingsButtons.count();
        console.log(`  Found ${settingsCount} Settings button(s)`);

        // Find the one with highest X (rightmost - in the prompt bar area)
        let settingsBtn = settingsButtons.first();
        let maxX = 0;

        for (let i = 0; i < settingsCount; i++) {
            const btn = settingsButtons.nth(i);
            const box = await btn.boundingBox().catch(() => null);
            if (box) {
                console.log(`  [${i}] at x=${Math.round(box.x)}, y=${Math.round(box.y)}`);
                if (box.x > maxX) {
                    maxX = box.x;
                    settingsBtn = btn;
                }
            }
        }

        console.log(`  → Using Settings button at x=${Math.round(maxX)} (rightmost, in prompt bar)`);

        // Click the settings button
        console.log('\n→ Clicking Settings button...');
        await settingsBtn.click();
        await page.waitForTimeout(1500);

        // Check if Orientation appeared
        const orientationVisible = await page.locator('text=Orientation').isVisible({ timeout: 2000 }).catch(() => false);
        if (orientationVisible) {
            console.log('✓ Settings panel opened! Orientation visible.');

            // Let's examine what's in the settings panel
            console.log('\n→ Examining settings panel contents...');

            // Look for elements containing orientation/duration
            const panelContent = await page.locator('text=Orientation').locator('..').textContent().catch(() => '');
            console.log(`  Parent content: "${panelContent}"`);

            // Check if Landscape/Portrait/Square are already visible
            const landscapeVis = await page.locator('text=Landscape').isVisible({ timeout: 500 }).catch(() => false);
            const portraitVis = await page.locator('text=Portrait').isVisible({ timeout: 500 }).catch(() => false);
            const squareVis = await page.locator('text=Square').isVisible({ timeout: 500 }).catch(() => false);
            console.log(`  Landscape visible: ${landscapeVis}`);
            console.log(`  Portrait visible: ${portraitVis}`);
            console.log(`  Square visible: ${squareVis}`);

            // Check for duration options
            const dur5Vis = await page.locator('text=5s').isVisible({ timeout: 500 }).catch(() => false);
            const dur10Vis = await page.locator('text=10s').isVisible({ timeout: 500 }).catch(() => false);
            const dur15Vis = await page.locator('text=15s').isVisible({ timeout: 500 }).catch(() => false);
            const dur20Vis = await page.locator('text=20s').isVisible({ timeout: 500 }).catch(() => false);
            console.log(`  5s visible: ${dur5Vis}`);
            console.log(`  10s visible: ${dur10Vis}`);
            console.log(`  15s visible: ${dur15Vis}`);
            console.log(`  20s visible: ${dur20Vis}`);

            // Click on the Orientation row - this opens a submenu to the right
            console.log('\n→ Clicking Orientation row to open submenu...');
            await page.locator('text=Orientation').click();
            await page.waitForTimeout(2000); // Wait for submenu

            // The submenu should now show Portrait/Landscape options
            // Look for Portrait option
            console.log('→ Looking for Portrait option in submenu...');
            const portraitOption = page.locator('text=Portrait');
            const portraitNowVis = await portraitOption.isVisible({ timeout: 2000 }).catch(() => false);
            console.log(`  Portrait visible: ${portraitNowVis}`);

            if (portraitNowVis) {
                await portraitOption.click();
                await page.waitForTimeout(1000);
                console.log('✓ Portrait selected!');
            } else {
                console.log('⚠ Portrait not found');
            }

            // Now try duration - need to reopen settings panel first
            console.log('\n→ Opening settings panel again for duration...');
            await page.waitForTimeout(1000); // Wait a moment

            // Check if settings panel is still open (Duration visible)
            let durationVisible = await page.locator('text=Duration').isVisible({ timeout: 1000 }).catch(() => false);
            console.log(`  Duration already visible: ${durationVisible}`);

            if (!durationVisible) {
                console.log('  → Clicking Settings button to reopen...');
                await settingsBtn.click();
                await page.waitForTimeout(2000);
                durationVisible = await page.locator('text=Duration').isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`  Duration visible after reopen: ${durationVisible}`);
            }

            if (durationVisible) {
                // Click on Duration row
                console.log('→ Clicking Duration row...');
                await page.locator('text=Duration').click();
                await page.waitForTimeout(2000); // Wait for submenu

                // Look for "10 seconds" option (text format is "X seconds" not "Xs")
                console.log('→ Looking for 10 seconds option in submenu...');
                const tenSecOption = page.locator('text=10 seconds');
                const tenSecVis = await tenSecOption.isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`  10 seconds visible: ${tenSecVis}`);

                if (tenSecVis) {
                    await tenSecOption.click();
                    await page.waitForTimeout(1000);
                    console.log('✓ 10 seconds selected!');
                } else {
                    console.log('⚠ 10 seconds not found');
                }
            } else {
                console.log('⚠ Could not reopen settings panel');
            }

            // Close the popup by clicking on the prompt area
            console.log('\n→ Closing popup by clicking prompt area...');
            await promptInput.click();
            await page.waitForTimeout(1000);
            console.log('✓ Popup closed');

            console.log('\n' + '━'.repeat(50));
            console.log('✓ Settings test PASSED!');
            console.log('━'.repeat(50));
        } else {
            console.log('✗ Settings panel did not open - Orientation not visible');
        }

        // Keep browser open for inspection
        console.log('\n→ Keeping browser open for 30 seconds for inspection...');
        await page.waitForTimeout(30000);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await context.close();
    }
}

testSettings().catch(console.error);
