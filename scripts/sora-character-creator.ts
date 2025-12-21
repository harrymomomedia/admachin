/**
 * Sora Character Creator - Playwright automation for sora.chatgpt.com
 *
 * Usage: npm run sora:character
 *
 * This script:
 * 1. Queries database for pending character creation tasks
 * 2. Opens a browser with persistent session (stays logged in)
 * 3. Navigates to the source video on sora.chatgpt.com
 * 4. Automates character creation flow
 * 5. Extracts character ID and name from the result page
 * 6. Updates the database with character info
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import 'dotenv/config';

// Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Persistent browser data directory (same as sora-web-generator to share session)
const USER_DATA_DIR = path.join(__dirname, '..', 'playwright-data', 'sora-session');

// Debug output directory for screenshots and traces
const DEBUG_DIR = path.join(__dirname, '..', 'playwright-data', 'debug');

// Check if running in headless mode (set HEADLESS=true for server)
const HEADLESS = process.env.HEADLESS === 'true';

interface CharacterTask {
    id: string;
    source_video_url: string;
    video_output_id: string | null;
    status: string;
    logs: Array<{
        id: number;
        timestamp: string;
        type: 'info' | 'success' | 'error' | 'warning';
        message: string;
    }>;
}

let logIdCounter = 2000; // Start high to avoid conflicts

async function appendLog(
    taskId: string,
    type: 'info' | 'success' | 'error' | 'warning',
    message: string,
    existingLogs: CharacterTask['logs'] = []
) {
    const newLog = {
        id: logIdCounter++,
        timestamp: new Date().toISOString(),
        type,
        message,
    };

    const updatedLogs = [...existingLogs, newLog];

    await supabase
        .from('sora_character')
        .update({ logs: updatedLogs })
        .eq('id', taskId);

    const prefix = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : '→';
    console.log(`[${new Date().toLocaleTimeString()}] ${prefix} ${message}`);

    return updatedLogs;
}

async function getPendingTasks(): Promise<CharacterTask[]> {
    const { data, error } = await supabase
        .from('sora_character')
        .select('*')
        .eq('status', 'pending')
        .not('source_video_url', 'is', null)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Failed to fetch pending tasks:', error);
        return [];
    }

    return (data || []) as CharacterTask[];
}

async function updateTask(taskId: string, updates: Record<string, unknown>) {
    const { error } = await supabase
        .from('sora_character')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', taskId);

    if (error) {
        console.error('Failed to update task:', error);
    }
}

async function checkLoginState(page: Page): Promise<boolean> {
    try {
        // Look for the prompt textarea - indicates logged in state
        const promptInput = await page.locator('textarea, input[type="text"]').first();
        const isVisible = await promptInput.isVisible({ timeout: 5000 }).catch(() => false);
        return isVisible;
    } catch {
        return false;
    }
}

async function waitForLogin(page: Page, logs: CharacterTask['logs'], taskId: string): Promise<CharacterTask['logs']> {
    console.log('\n' + '='.repeat(50));
    console.log('🔐 LOGIN REQUIRED');
    console.log('='.repeat(50));
    console.log('Please log in to your OpenAI account in the browser window.');
    console.log('The script will continue automatically after login.');
    console.log('='.repeat(50) + '\n');

    logs = await appendLog(taskId, 'warning', '🔐 Please log in to your OpenAI account', logs);

    let isLoggedIn = false;
    while (!isLoggedIn) {
        await page.waitForTimeout(5000);
        isLoggedIn = await checkLoginState(page);
        if (!isLoggedIn) {
            console.log('Waiting for login...');
        }
    }

    logs = await appendLog(taskId, 'success', '✓ Login detected, continuing...', logs);
    return logs;
}

async function createCharacter(context: BrowserContext, task: CharacterTask): Promise<void> {
    const page = await context.newPage();
    let logs = task.logs || [];

    try {
        await updateTask(task.id, { status: 'processing' });

        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
        logs = await appendLog(task.id, 'info', '👤 SORA CHARACTER CREATION', logs);
        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);

        // Navigate to the source video
        logs = await appendLog(task.id, 'info', `→ Opening video: ${task.source_video_url}`, logs);
        await page.goto(task.source_video_url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Check login state
        const isLoggedIn = await checkLoginState(page);
        if (!isLoggedIn) {
            logs = await waitForLogin(page, logs, task.id);
        } else {
            logs = await appendLog(task.id, 'success', '✓ Already logged in', logs);
        }

        await page.waitForTimeout(3000);

        // Take screenshot to see current page state
        await page.screenshot({ path: 'sora-page-loaded.png' });
        logs = await appendLog(task.id, 'info', '📸 Screenshot saved: sora-page-loaded.png', logs);

        // Step 1: Find and click the "..." menu button (three dots / ellipsis)
        logs = await appendLog(task.id, 'info', '→ Looking for "..." menu button...', logs);

        // Log all buttons on page for debugging
        const allBtns = page.locator('button');
        const btnCount = await allBtns.count();
        logs = await appendLog(task.id, 'info', `→ Found ${btnCount} buttons on page`, logs);

        // The menu button "..." is on the RIGHT SIDE PANEL (not on video)
        // It's in a row of icons: heart, remix, share, "..."
        // The button may be a <button> OR a <div> with role="button" or just clickable

        let menuFound = false;

        // Strategy 1: Look for ANY clickable element with 3 circles (ellipsis icon)
        // This includes buttons, divs with role="button", and SVGs
        logs = await appendLog(task.id, 'info', '→ Looking for ellipsis button in right panel...', logs);

        // Look for elements containing SVG with 3 circles (ellipsis pattern)
        const clickableSelectors = 'button, [role="button"], [class*="button"], [class*="Button"]';
        const allClickables = page.locator(clickableSelectors);
        const clickableCount = await allClickables.count();
        logs = await appendLog(task.id, 'info', `→ Found ${clickableCount} clickable elements`, logs);

        const allButtons = page.locator('button');
        const buttonCount = await allButtons.count();

        // Collect button info for debugging
        const buttonInfos: Array<{index: number, x: number, y: number, hasCircles: boolean, ariaLabel: string | null}> = [];

        for (let i = 0; i < buttonCount; i++) {
            try {
                const btn = allButtons.nth(i);
                if (!await btn.isVisible({ timeout: 300 }).catch(() => false)) continue;

                const box = await btn.boundingBox();
                if (!box) continue;

                const circleCount = await btn.locator('circle').count();
                const ariaLabel = await btn.getAttribute('aria-label');

                buttonInfos.push({
                    index: i,
                    x: box.x,
                    y: box.y,
                    hasCircles: circleCount >= 3, // Ellipsis has 3 circles
                    ariaLabel
                });
            } catch {
                continue;
            }
        }

        logs = await appendLog(task.id, 'info', `→ Analyzed ${buttonInfos.length} visible buttons`, logs);

        // Find button with 3 circles (ellipsis) on the right side (x > 600)
        const ellipsisButtons = buttonInfos.filter(b => b.hasCircles && b.x > 600);
        logs = await appendLog(task.id, 'info', `→ Found ${ellipsisButtons.length} ellipsis button(s) on right side`, logs);

        if (ellipsisButtons.length > 0) {
            // Click the first ellipsis button found on right side
            const targetBtn = allButtons.nth(ellipsisButtons[0].index);
            await targetBtn.click({ force: true });
            await page.waitForTimeout(1000);

            // Check if menu appeared
            if (await page.locator('text=Create character').isVisible({ timeout: 2000 }).catch(() => false)) {
                menuFound = true;
                logs = await appendLog(task.id, 'success', '✓ Menu opened (ellipsis button)', logs);
            }
        }

        // Strategy 2: Try clicking buttons on right side one by one until menu appears
        if (!menuFound) {
            logs = await appendLog(task.id, 'info', '→ Trying buttons on right side one by one...', logs);

            // Sort by x position (rightmost first) and filter to right side
            const rightSideButtons = buttonInfos.filter(b => b.x > 600).sort((a, b) => b.x - a.x);

            for (const btnInfo of rightSideButtons) {
                try {
                    const btn = allButtons.nth(btnInfo.index);
                    await btn.click({ force: true });
                    await page.waitForTimeout(500);

                    if (await page.locator('text=Create character').isVisible({ timeout: 1000 }).catch(() => false)) {
                        menuFound = true;
                        logs = await appendLog(task.id, 'success', `✓ Menu opened (button at x=${btnInfo.x})`, logs);
                        break;
                    }
                    // Don't press Escape - it navigates away!
                } catch {
                    continue;
                }
            }
        }

        // Strategy 3: Try aria-label selectors
        if (!menuFound) {
            logs = await appendLog(task.id, 'info', '→ Trying aria-label selectors...', logs);

            const menuAriaLabels = [
                'button[aria-label="More"]',
                'button[aria-label="More options"]',
                'button[aria-label="Options"]',
                'button[aria-label*="more"]',
                'button[aria-label*="option"]',
            ];

            for (const selector of menuAriaLabels) {
                try {
                    const btn = page.locator(selector).first();
                    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
                        await btn.click({ force: true });
                        await page.waitForTimeout(500);

                        if (await page.locator('text=Create character').isVisible({ timeout: 1000 }).catch(() => false)) {
                            menuFound = true;
                            logs = await appendLog(task.id, 'success', `✓ Menu opened (${selector})`, logs);
                            break;
                        }
                        // Don't press Escape - it navigates away!
                    }
                } catch {
                    continue;
                }
            }
        }

        // Strategy 4: Find the ellipsis button by looking for circular elements with dots
        if (!menuFound) {
            logs = await appendLog(task.id, 'info', '→ Looking for ellipsis icon (dark circle with 3 dots)...', logs);

            // The "..." button is a dark circular button - look for elements that might contain it
            // It could be a button, div, or SVG

            // Try finding by looking for all elements in the right panel area
            const rightPanelElements = page.locator('button, [role="button"], svg, div').filter({
                has: page.locator('svg, circle, path')
            });
            const rpCount = await rightPanelElements.count();
            logs = await appendLog(task.id, 'info', `→ Found ${rpCount} potential icon elements`, logs);

            // Look for SVG elements specifically - the ellipsis might have circles or paths
            const svgs = page.locator('svg');
            const svgCount = await svgs.count();

            for (let i = 0; i < svgCount; i++) {
                try {
                    const svg = svgs.nth(i);
                    const box = await svg.boundingBox();
                    if (!box || box.x < 600) continue; // Skip left side elements

                    // Check if this SVG has circles (ellipsis pattern) or is small (icon size)
                    const circleCount = await svg.locator('circle').count();
                    const pathCount = await svg.locator('path').count();

                    // Ellipsis icon is typically around 20-30px wide and has 3 circles or paths
                    const isIconSize = box.width < 50 && box.height < 50;

                    if ((circleCount >= 3 || (pathCount > 0 && isIconSize)) && box.x > 700) {
                        logs = await appendLog(task.id, 'info', `→ Potential ellipsis at x=${Math.round(box.x)}, y=${Math.round(box.y)} (circles=${circleCount}, paths=${pathCount})`, logs);

                        // Click the SVG's parent (the button containing it)
                        const parent = svg.locator('..');
                        await parent.click({ force: true }).catch(() => svg.click({ force: true }));
                        await page.waitForTimeout(1000);

                        if (await page.locator('text=Create character').isVisible({ timeout: 2000 }).catch(() => false)) {
                            menuFound = true;
                            logs = await appendLog(task.id, 'success', '✓ Menu opened (SVG parent click)', logs);
                            break;
                        }
                        // Don't press Escape!
                    }
                } catch {
                    continue;
                }
            }
        }

        // Strategy 5: Click by coordinates (last resort) - based on actual screenshot analysis
        if (!menuFound) {
            logs = await appendLog(task.id, 'info', '→ Trying coordinate-based click...', logs);

            // Make sure we're still on the video page
            if (!page.url().includes('sora.chatgpt.com/p/')) {
                logs = await appendLog(task.id, 'warning', '→ Page navigated away, reloading...', logs);
                await page.goto(task.source_video_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(3000);
            }

            // Based on sora-page-loaded.png screenshot:
            // - Right panel starts around x=660
            // - Icon row (heart, remix, share, ...) is at y~130
            // - The "..." button is the rightmost icon, around x=803
            const coordsToTry = [
                { x: 803, y: 130 },  // Ellipsis button position
                { x: 803, y: 128 },  // Slightly higher
                { x: 800, y: 130 },  // Slightly left
                { x: 805, y: 128 },  // Slightly right
            ];

            for (const coord of coordsToTry) {
                logs = await appendLog(task.id, 'info', `→ Clicking at (${coord.x}, ${coord.y})...`, logs);
                await page.mouse.click(coord.x, coord.y);
                await page.waitForTimeout(800);

                // Take screenshot to see what happened
                await page.screenshot({ path: `sora-click-${coord.x}-${coord.y}.png` });

                if (await page.locator('text=Create character').isVisible({ timeout: 1500 }).catch(() => false)) {
                    menuFound = true;
                    logs = await appendLog(task.id, 'success', `✓ Menu opened (click at ${coord.x},${coord.y})`, logs);
                    break;
                }

                // DON'T press Escape - it navigates away from the page!
            }
        }

        if (!menuFound) {
            await page.screenshot({ path: 'sora-debug-no-menu.png' });
            logs = await appendLog(task.id, 'warning', '⚠ Debug screenshot saved to sora-debug-no-menu.png', logs);
            logs = await appendLog(task.id, 'info', `Button analysis: ${JSON.stringify(buttonInfos.slice(0, 5))}`, logs);
            throw new Error('Could not find "..." menu button - check debug screenshot');
        }

        await page.waitForTimeout(1000);

        // Step 2: Click "Create character" option
        logs = await appendLog(task.id, 'info', '→ Clicking "Create character"...', logs);

        // Use text selector like sora-web-generator does
        const createCharBtn = page.locator('text=Create character').first();
        if (!await createCharBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Try alternative selectors
            const altSelectors = [
                '[role="menuitem"]:has-text("Create character")',
                'button:has-text("Create character")',
                'div:has-text("Create character")',
            ];

            let found = false;
            for (const sel of altSelectors) {
                const el = page.locator(sel).first();
                if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await el.click();
                    found = true;
                    break;
                }
            }

            if (!found) {
                throw new Error('Create character option not found in menu');
            }
        } else {
            await createCharBtn.click();
        }
        logs = await appendLog(task.id, 'success', '✓ Create character clicked', logs);

        await page.waitForTimeout(2000);

        // Step 3: Timeline/trim selection - click the right arrow button to proceed
        logs = await appendLog(task.id, 'info', '→ Timeline selection - looking for arrow button...', logs);

        // Take screenshot to see current state
        await page.screenshot({ path: 'sora-trim-step.png' });

        // The arrow button is a WHITE CIRCULAR button with a black right arrow
        // It's in the CENTER of the trim modal, to the right of the video timeline
        // NOT in the top-right corner - it's in the middle of the screen
        let arrowClicked = false;

        // Strategy: Find large circular buttons in the CENTER of the screen (not edges)
        // The arrow button should be around x=400-700, y=300-500 (center area)
        const trimButtons = page.locator('button');
        const trimButtonCount = await trimButtons.count();
        logs = await appendLog(task.id, 'info', `→ Found ${trimButtonCount} buttons, scanning for arrow...`, logs);

        // Collect info about buttons in center area
        const centerButtons: Array<{index: number, x: number, y: number, width: number, height: number}> = [];

        for (let i = 0; i < trimButtonCount; i++) {
            try {
                const btn = trimButtons.nth(i);
                const box = await btn.boundingBox();
                if (!box) continue;

                // Look for buttons in center area (not sidebar, not top bar)
                // Center area: x between 300-900, y between 200-600
                if (box.x > 300 && box.x < 900 && box.y > 200 && box.y < 600) {
                    // Look for circular buttons (width ≈ height, size around 40-80px)
                    const isCircular = Math.abs(box.width - box.height) < 10;
                    const isRightSize = box.width >= 40 && box.width <= 100;

                    if (isCircular && isRightSize) {
                        centerButtons.push({
                            index: i,
                            x: box.x,
                            y: box.y,
                            width: box.width,
                            height: box.height
                        });
                        logs = await appendLog(task.id, 'info', `→ Candidate: button at (${Math.round(box.x)}, ${Math.round(box.y)}) size ${Math.round(box.width)}x${Math.round(box.height)}`, logs);
                    }
                }
            } catch {
                continue;
            }
        }

        // Click the most likely arrow button (rightmost circular button in center)
        if (centerButtons.length > 0) {
            // Sort by x position (rightmost first)
            centerButtons.sort((a, b) => b.x - a.x);
            const target = centerButtons[0];
            logs = await appendLog(task.id, 'info', `→ Clicking arrow at (${Math.round(target.x)}, ${Math.round(target.y)})`, logs);

            const btn = trimButtons.nth(target.index);
            await btn.click({ force: true });
            arrowClicked = true;
            logs = await appendLog(task.id, 'success', '✓ Arrow button clicked', logs);
        }

        // Fallback: click by coordinates - the arrow is at BOTTOM RIGHT of the trim modal
        if (!arrowClicked) {
            logs = await appendLog(task.id, 'info', '→ Trying coordinate click for arrow...', logs);
            // Based on the screenshot, the arrow button is at bottom right of modal
            // Modal is centered, arrow is to the right of the timeline at the bottom
            // Viewport 1280x800 - arrow is around x=905, y=680
            const coordsToTry = [
                { x: 905, y: 680 },  // Exact position from screenshot
                { x: 900, y: 680 },  // Slightly left
                { x: 910, y: 680 },  // Slightly right
                { x: 905, y: 675 },  // Slightly higher
                { x: 905, y: 685 },  // Slightly lower
            ];

            for (const coord of coordsToTry) {
                await page.mouse.click(coord.x, coord.y);
                await page.waitForTimeout(1500);
                logs = await appendLog(task.id, 'info', `→ Clicked at (${coord.x}, ${coord.y})`, logs);

                // Take screenshot to see result
                await page.screenshot({ path: `sora-after-click-${coord.x}-${coord.y}.png` });

                // Check if modal changed or processing started
                const trimModal = page.locator('text=Trim your video');
                const isStillTrimming = await trimModal.isVisible({ timeout: 500 }).catch(() => false);

                if (!isStillTrimming) {
                    arrowClicked = true;
                    logs = await appendLog(task.id, 'success', '✓ Arrow clicked - moved to next step', logs);
                    break;
                }
            }
        }

        await page.waitForTimeout(2000);

        // Step 4: Wait for processing and click Continue
        logs = await appendLog(task.id, 'info', '→ Waiting for character processing...', logs);

        // Wait for Continue button to appear (processing complete)
        const continueButton = page.locator('button:has-text("Continue")').first();
        await continueButton.waitFor({ state: 'visible', timeout: 120000 }); // 2 min timeout for processing
        logs = await appendLog(task.id, 'success', '✓ Processing complete', logs);

        await continueButton.click();
        logs = await appendLog(task.id, 'info', '→ Continue clicked (profile page)', logs);

        await page.waitForTimeout(2000);

        // Step 5: Character profile - accept defaults, click Continue
        logs = await appendLog(task.id, 'info', '→ Accepting default profile...', logs);
        const continueBtn2 = page.locator('button:has-text("Continue")').first();
        if (await continueBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
            await continueBtn2.click();
            logs = await appendLog(task.id, 'success', '✓ Profile accepted', logs);
        }

        await page.waitForTimeout(2000);

        // Step 6: Character description - click Continue
        logs = await appendLog(task.id, 'info', '→ Description page - clicking Continue...', logs);
        const continueBtn3 = page.locator('button:has-text("Continue")').first();
        if (await continueBtn3.isVisible({ timeout: 5000 }).catch(() => false)) {
            await continueBtn3.click();
            logs = await appendLog(task.id, 'success', '✓ Description accepted', logs);
        }

        await page.waitForTimeout(2000);

        // Step 7: Settings page - select "Everyone" and click Save
        logs = await appendLog(task.id, 'info', '→ Setting visibility to "Everyone"...', logs);

        // Find and click "Everyone" option
        const everyoneOption = page.locator('text=Everyone').first();
        if (await everyoneOption.isVisible({ timeout: 5000 }).catch(() => false)) {
            await everyoneOption.click();
            logs = await appendLog(task.id, 'success', '✓ "Everyone" selected', logs);
        }

        await page.waitForTimeout(1000);

        // Click Save button
        logs = await appendLog(task.id, 'info', '→ Saving character...', logs);
        const saveButton = page.locator('button:has-text("Save")').first();
        await saveButton.click({ timeout: 5000 });
        logs = await appendLog(task.id, 'success', '✓ Character saved', logs);

        // Wait for navigation to character page
        await page.waitForTimeout(3000);

        // Step 8: Extract character info from the result page
        logs = await appendLog(task.id, 'info', '→ Extracting character info...', logs);

        // Wait for profile page to fully load
        await page.waitForTimeout(2000);

        // Take screenshot for debugging
        await page.screenshot({ path: 'sora-character-profile.png' });

        // Get character ID from URL (e.g., sora.chatgpt.com/profile/expadz.palmavenue)
        const currentUrl = page.url();
        const urlMatch = currentUrl.match(/\/profile\/([^\/\?]+)/);
        const soraCharacterId = urlMatch ? urlMatch[1] : null;

        if (soraCharacterId) {
            logs = await appendLog(task.id, 'success', `✓ Character ID: ${soraCharacterId}`, logs);
        }

        // Get character name from the page
        // The name "Sunny Walker" appears below the avatar, before "Character by"
        let characterName = null;
        try {
            // Try multiple selectors to find the character name
            const nameSelectors = [
                // The name is typically displayed prominently below the avatar
                'h1',
                'h2',
                '[class*="name"]',
                '[class*="Name"]',
                '[class*="title"]',
                '[class*="Title"]',
            ];

            for (const selector of nameSelectors) {
                const elements = page.locator(selector);
                const count = await elements.count();

                for (let i = 0; i < count; i++) {
                    const el = elements.nth(i);
                    if (!await el.isVisible({ timeout: 500 }).catch(() => false)) continue;

                    const text = await el.textContent();
                    if (!text) continue;

                    const trimmedText = text.trim();

                    // Skip if it's the character ID or "Character by" text
                    if (trimmedText.includes('Character by')) continue;
                    if (trimmedText === soraCharacterId) continue;
                    if (trimmedText.length < 2 || trimmedText.length > 100) continue;

                    // This is likely the character name
                    characterName = trimmedText;
                    logs = await appendLog(task.id, 'info', `→ Found name candidate: "${characterName}" (${selector})`, logs);
                    break;
                }

                if (characterName) break;
            }

            // Alternative: look for text that comes right after the avatar
            if (!characterName) {
                // Try getting text content near "Character by"
                const charByLocator = page.locator('text=Character by');
                if (await charByLocator.isVisible({ timeout: 1000 }).catch(() => false)) {
                    // The name should be the sibling or previous element
                    const parent = charByLocator.locator('..');
                    const parentText = await parent.textContent();
                    if (parentText) {
                        // Extract name from text like "Sunny Walker Character by expadz"
                        const match = parentText.match(/^(.+?)\s*Character by/);
                        if (match) {
                            characterName = match[1].trim();
                        }
                    }
                }
            }
        } catch (e) {
            logs = await appendLog(task.id, 'warning', `⚠ Error extracting name: ${e}`, logs);
        }

        if (characterName) {
            logs = await appendLog(task.id, 'success', `✓ Character name: ${characterName}`, logs);
        } else {
            logs = await appendLog(task.id, 'warning', '⚠ Could not extract character name', logs);
        }

        // Get avatar URL if visible
        let avatarUrl = null;
        try {
            // Look for the circular avatar image on the profile page
            // The avatar is typically a large circular image at the top of the profile
            const avatarSelectors = [
                'img[src*="openai.com"]',  // OpenAI CDN images
                'img[src*="character"]',
                'img[src*="avatar"]',
                'img[src*="profile"]',
                'img[alt*="avatar"]',
                '[class*="avatar"] img',
                '[class*="Avatar"] img',
                'img[class*="rounded-full"]',  // Circular images (Tailwind)
                'img[class*="circle"]',
            ];

            for (const selector of avatarSelectors) {
                const imgs = page.locator(selector);
                const count = await imgs.count();

                for (let i = 0; i < count; i++) {
                    const img = imgs.nth(i);
                    if (!await img.isVisible({ timeout: 300 }).catch(() => false)) continue;

                    const src = await img.getAttribute('src');
                    if (!src) continue;

                    // Look for actual image URLs (not tiny icons)
                    const box = await img.boundingBox();
                    if (box && box.width > 50 && box.height > 50) {
                        avatarUrl = src;
                        logs = await appendLog(task.id, 'success', `✓ Avatar URL found (${Math.round(box.width)}x${Math.round(box.height)})`, logs);
                        break;
                    }
                }

                if (avatarUrl) break;
            }

            // Fallback: try to find any large image on the page
            if (!avatarUrl) {
                const allImgs = page.locator('img');
                const imgCount = await allImgs.count();

                for (let i = 0; i < imgCount; i++) {
                    const img = allImgs.nth(i);
                    const box = await img.boundingBox();

                    // Avatar is typically around 100-200px, positioned near the top center
                    if (box && box.width > 80 && box.width < 300 && box.y < 400 && box.x > 400) {
                        const src = await img.getAttribute('src');
                        if (src && !src.includes('icon') && !src.includes('logo')) {
                            avatarUrl = src;
                            logs = await appendLog(task.id, 'success', `✓ Avatar found by size/position`, logs);
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            logs = await appendLog(task.id, 'warning', `⚠ Error getting avatar: ${e}`, logs);
        }

        if (!avatarUrl) {
            logs = await appendLog(task.id, 'warning', '⚠ Could not find avatar URL', logs);
        }

        // Update database with character info
        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
        logs = await appendLog(task.id, 'success', '🎉 CHARACTER CREATED SUCCESSFULLY!', logs);
        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);

        await updateTask(task.id, {
            status: 'completed',
            sora_character_id: soraCharacterId,
            sora_profile_url: soraCharacterId ? `https://sora.chatgpt.com/profile/${soraCharacterId}` : null,
            character_name: characterName,
            avatar_url: avatarUrl,
            logs,
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logs = await appendLog(task.id, 'error', `✗ Error: ${errorMessage}`, logs);

        // Save debug screenshot and HTML on error
        try {
            const timestamp = Date.now();
            const errorScreenshot = path.join(DEBUG_DIR, `error-${task.id}-${timestamp}.png`);
            const errorHtml = path.join(DEBUG_DIR, `error-${task.id}-${timestamp}.html`);

            await page.screenshot({ path: errorScreenshot, fullPage: true });
            const html = await page.content();
            fs.writeFileSync(errorHtml, html);

            logs = await appendLog(task.id, 'info', `📸 Debug files saved: ${errorScreenshot}`, logs);
            console.log(`[Debug] Screenshot: ${errorScreenshot}`);
            console.log(`[Debug] HTML: ${errorHtml}`);
        } catch (debugError) {
            console.error('Failed to save debug files:', debugError);
        }

        await updateTask(task.id, {
            status: 'failed',
            task_error: errorMessage,
            logs,
        });

    } finally {
        await page.close();
    }
}

async function main() {
    console.log('\n' + '='.repeat(50));
    console.log('👤 SORA CHARACTER CREATOR');
    console.log('='.repeat(50));

    // Check for pending tasks
    console.log('→ Checking for pending character tasks...');
    const tasks = await getPendingTasks();

    if (tasks.length === 0) {
        console.log('✓ No pending character creation tasks found.');
        console.log('  Create a character from an AI-generated video in the app.');
        console.log('='.repeat(50) + '\n');
        return;
    }

    console.log(`✓ Found ${tasks.length} pending task(s)`);
    console.log('='.repeat(50) + '\n');

    // Ensure debug directory exists
    if (!fs.existsSync(DEBUG_DIR)) {
        fs.mkdirSync(DEBUG_DIR, { recursive: true });
    }

    // Launch browser with persistent context (shares session with video generator)
    console.log(`→ Launching browser (headless: ${HEADLESS})...`);
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: HEADLESS,
        viewport: { width: 1280, height: 800 },
        args: ['--disable-blink-features=AutomationControlled'],
        // Record video for debugging in headless mode
        recordVideo: HEADLESS ? {
            dir: DEBUG_DIR,
            size: { width: 1280, height: 800 }
        } : undefined,
    });

    console.log('✓ Browser launched (session will persist)');
    if (HEADLESS) {
        console.log('  ⚠ Running in HEADLESS mode - videos saved to:', DEBUG_DIR);
        console.log('  ⚠ Make sure you logged in previously in non-headless mode');
    }
    console.log('');

    try {
        // Process tasks one at a time
        for (const task of tasks) {
            console.log(`\n→ Processing task: ${task.id}`);
            console.log(`  Source video: ${task.source_video_url}`);
            console.log('');

            await createCharacter(context, task);
        }

    } finally {
        console.log('\n→ Closing browser in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await context.close();
    }

    console.log('\n' + '='.repeat(50));
    console.log('✓ All tasks processed');
    console.log('='.repeat(50) + '\n');
}

// Run the script
main().catch(console.error);
