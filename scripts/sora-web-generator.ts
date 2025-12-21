/**
 * Sora Web Generator - Playwright automation for sora.chatgpt.com
 *
 * Usage: npm run sora:generate
 *
 * This script:
 * 1. Queries database for pending web generation tasks
 * 2. Opens a browser with persistent session (stays logged in)
 * 3. Automates video generation on sora.chatgpt.com
 * 4. Downloads the video and uploads to Supabase Storage
 * 5. Updates the database with completion status
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import 'dotenv/config';

// Supabase client for database operations
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Persistent browser data directory (stores cookies/session)
const USER_DATA_DIR = path.join(__dirname, '..', 'playwright-data', 'sora-session');

// Sora web interface URL
const SORA_URL = 'https://sora.chatgpt.com/';

interface VideoTask {
    id: string;
    video_generator_id: string;
    task_id: string;
    task_status: string;
    metadata: {
        model: string;
        prompt: string;
        duration: number;
        aspect_ratio: string;
    };
    logs: Array<{
        id: number;
        timestamp: string;
        type: 'info' | 'success' | 'error' | 'warning';
        message: string;
    }>;
}

let logIdCounter = 1000; // Start high to avoid conflicts with frontend logs

async function appendLog(
    taskId: string,
    type: 'info' | 'success' | 'error' | 'warning',
    message: string,
    existingLogs: VideoTask['logs'] = []
) {
    const newLog = {
        id: logIdCounter++,
        timestamp: new Date().toISOString(),
        type,
        message,
    };

    const updatedLogs = [...existingLogs, newLog];

    await supabase
        .from('video_output')
        .update({ logs: updatedLogs })
        .eq('id', taskId);

    // Also print to console
    const prefix = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : '→';
    console.log(`[${new Date().toLocaleTimeString()}] ${prefix} ${message}`);

    return updatedLogs;
}

async function getPendingTasks(): Promise<VideoTask[]> {
    const { data, error } = await supabase
        .from('video_output')
        .select('*')
        .eq('task_status', 'pending')
        .like('task_id', 'web-%')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Failed to fetch pending tasks:', error);
        return [];
    }

    return (data || []) as VideoTask[];
}

async function updateTaskStatus(taskId: string, status: string, updates: Record<string, unknown> = {}) {
    const { error } = await supabase
        .from('video_output')
        .update({ task_status: status, ...updates })
        .eq('id', taskId);

    if (error) {
        console.error('Failed to update task status:', error);
    }
}

async function updateGeneratorStatus(generatorId: string, status: string) {
    const { error } = await supabase
        .from('video_generator')
        .update({ status })
        .eq('id', generatorId);

    if (error) {
        console.error('Failed to update generator status:', error);
    }
}

async function uploadVideoToSupabase(
    videoBuffer: ArrayBuffer,
    videoOutputId: string
): Promise<{ path: string; url: string }> {
    const filename = `${Date.now()}.mp4`;
    const filePath = `videos/${videoOutputId}/${filename}`;

    const { data, error } = await supabase.storage
        .from('video-generator')
        .upload(filePath, videoBuffer, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'video/mp4',
        });

    if (error) {
        throw new Error(`Failed to upload video: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
        .from('video-generator')
        .getPublicUrl(data.path);

    return {
        path: data.path,
        url: urlData.publicUrl,
    };
}

async function checkLoginState(page: Page): Promise<boolean> {
    // Check if we're on the main Sora page with the prompt input
    try {
        // Look for the prompt textarea or input - this indicates logged in state
        const promptInput = await page.locator('textarea, input[type="text"]').first();
        const isVisible = await promptInput.isVisible({ timeout: 5000 }).catch(() => false);
        return isVisible;
    } catch {
        return false;
    }
}

async function waitForLogin(page: Page, logs: VideoTask['logs'], taskId: string): Promise<VideoTask['logs']> {
    console.log('\n' + '='.repeat(50));
    console.log('🔐 LOGIN REQUIRED');
    console.log('='.repeat(50));
    console.log('Please log in to your OpenAI account in the browser window.');
    console.log('The script will continue automatically after login.');
    console.log('='.repeat(50) + '\n');

    logs = await appendLog(taskId, 'warning', '🔐 Please log in to your OpenAI account in the browser window', logs);

    // Wait for login - check every 5 seconds
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

async function generateVideo(
    context: BrowserContext,
    task: VideoTask
): Promise<void> {
    const page = await context.newPage();
    let logs = task.logs || [];

    try {
        // Update status to processing
        await updateTaskStatus(task.id, 'processing');
        await updateGeneratorStatus(task.video_generator_id, 'generating');

        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
        logs = await appendLog(task.id, 'info', '🌐 SORA WEB AUTOMATION', logs);
        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);

        // Navigate to Sora
        logs = await appendLog(task.id, 'info', `→ Navigating to ${SORA_URL}...`, logs);
        await page.goto(SORA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Check login state
        const isLoggedIn = await checkLoginState(page);
        if (!isLoggedIn) {
            logs = await waitForLogin(page, logs, task.id);
        } else {
            logs = await appendLog(task.id, 'success', '✓ Already logged in', logs);
        }

        // Wait a moment for page to fully load
        await page.waitForTimeout(2000);

        // Find and fill the prompt textarea
        logs = await appendLog(task.id, 'info', '→ Entering prompt...', logs);

        // Try different selectors for the prompt input
        const promptSelectors = [
            'textarea[placeholder*="Describe"]',
            'textarea[placeholder*="prompt"]',
            'textarea',
            'input[type="text"][placeholder*="Describe"]',
        ];

        let promptInput = null;
        for (const selector of promptSelectors) {
            try {
                promptInput = page.locator(selector).first();
                if (await promptInput.isVisible({ timeout: 2000 })) {
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!promptInput) {
            throw new Error('Could not find prompt input field');
        }

        // Clear and fill the prompt
        await promptInput.click();
        await promptInput.fill(task.metadata.prompt);
        logs = await appendLog(task.id, 'success', '✓ Prompt entered', logs);

        // Look for aspect ratio selector if available
        logs = await appendLog(task.id, 'info', `→ Setting aspect ratio: ${task.metadata.aspect_ratio}...`, logs);
        try {
            // Try to find aspect ratio buttons/dropdown
            const aspectMap: Record<string, string[]> = {
                'landscape': ['16:9', 'Landscape', 'Wide'],
                'portrait': ['9:16', 'Portrait', 'Vertical'],
                'square': ['1:1', 'Square'],
            };

            const aspectLabels = aspectMap[task.metadata.aspect_ratio] || [];
            for (const label of aspectLabels) {
                const button = page.getByRole('button', { name: new RegExp(label, 'i') });
                if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await button.click();
                    logs = await appendLog(task.id, 'success', `✓ Selected ${label}`, logs);
                    break;
                }
            }
        } catch {
            logs = await appendLog(task.id, 'warning', '⚠ Could not set aspect ratio, using default', logs);
        }

        // Look for duration selector if available
        logs = await appendLog(task.id, 'info', `→ Setting duration: ${task.metadata.duration}s...`, logs);
        try {
            const durationButton = page.getByRole('button', { name: new RegExp(`${task.metadata.duration}`, 'i') });
            if (await durationButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await durationButton.click();
                logs = await appendLog(task.id, 'success', `✓ Selected ${task.metadata.duration}s duration`, logs);
            }
        } catch {
            logs = await appendLog(task.id, 'warning', '⚠ Could not set duration, using default', logs);
        }

        // Record existing video URLs before generating (to detect new ones)
        const existingVideoUrls = new Set<string>();
        const existingVideos = page.locator('video');
        const existingCount = await existingVideos.count();
        for (let i = 0; i < existingCount; i++) {
            const src = await existingVideos.nth(i).getAttribute('src');
            if (src) existingVideoUrls.add(src);
        }
        logs = await appendLog(task.id, 'info', `📊 Found ${existingVideoUrls.size} existing video(s) on page`, logs);

        // Find and click the generate button (up-arrow icon in bottom right)
        logs = await appendLog(task.id, 'info', '→ Looking for generate button...', logs);

        // The generate button is a circular button with up-arrow icon
        // Located at bottom-right of the prompt area
        let generateButton = null;

        // Try to find the up-arrow/send button
        const buttonSelectors = [
            // SVG with up arrow path
            'button:has(svg path[d*="M12 19V5"])',
            'button:has(svg[data-icon="arrow-up"])',
            // Button near textarea with arrow
            'button:has(svg):near(textarea)',
            // Generic submit buttons
            'button[type="submit"]',
            'form button:last-child',
        ];

        for (const selector of buttonSelectors) {
            try {
                const btn = page.locator(selector).last(); // .last() for bottom-right position
                if (await btn.isVisible({ timeout: 1000 })) {
                    generateButton = btn;
                    logs = await appendLog(task.id, 'info', `Found button with: ${selector}`, logs);
                    break;
                }
            } catch {
                continue;
            }
        }

        // Fallback: find circular buttons and click the one that looks like submit
        if (!generateButton) {
            logs = await appendLog(task.id, 'info', '→ Using fallback button detection...', logs);
            const allButtons = page.locator('button:visible');
            const count = await allButtons.count();

            // Look from the end (bottom-right buttons come last)
            for (let i = count - 1; i >= 0; i--) {
                const btn = allButtons.nth(i);
                const text = (await btn.textContent() || '').trim();

                // Skip buttons with text (the submit button usually has just an icon)
                if (text.length > 5) continue;
                if (text.toLowerCase().includes('character')) continue;
                if (text.toLowerCase().includes('create')) continue;

                // Check if it has an SVG (icon button)
                const hasSvg = await btn.locator('svg').count() > 0;
                if (hasSvg) {
                    generateButton = btn;
                    break;
                }
            }
        }

        if (!generateButton) {
            throw new Error('Could not find generate button. Please check if the Sora interface has changed.');
        }

        // Click generate
        logs = await appendLog(task.id, 'info', '→ Clicking generate button...', logs);
        await generateButton.click();

        // Wait a moment for the click to register
        await page.waitForTimeout(2000);

        logs = await appendLog(task.id, 'success', '✓ Generate button clicked', logs);

        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
        logs = await appendLog(task.id, 'info', '⏳ WAITING FOR VIDEO (2-5 mins)...', logs);
        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
        logs = await appendLog(task.id, 'info', '→ Will check Activity panel for completion...', logs);

        // Wait for video to be generated - check Activity panel for completion
        const maxWaitTime = 10 * 60 * 1000; // 10 minutes max
        const pollInterval = 20000; // 20 seconds
        const startTime = Date.now();

        let videoUrl: string | null = null;

        // Wait initial time for generation to start (Sora takes 2-5 minutes)
        logs = await appendLog(task.id, 'info', '→ Waiting 2 minutes before first check...', logs);
        await page.waitForTimeout(120000); // 2 minutes initial wait

        while (Date.now() - startTime < maxWaitTime) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            logs = await appendLog(task.id, 'info', `⏳ [${elapsed}s] Checking Activity for completion...`, logs);

            try {
                // Navigate to profile/drafts to check for new video
                await page.goto('https://sora.chatgpt.com/profile', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2000);

                // Click on Drafts section
                const draftsButton = page.locator('text=Drafts').first();
                if (await draftsButton.isVisible({ timeout: 3000 })) {
                    await draftsButton.click();
                    await page.waitForTimeout(2000);

                    // Get the first (most recent) video in the grid
                    const firstVideo = page.locator('video').first();
                    if (await firstVideo.isVisible({ timeout: 3000 })) {
                        // Click on it to open
                        await firstVideo.click();
                        await page.waitForTimeout(2000);

                        // Now look for download button or video source
                        const downloadBtn = page.locator('button:has-text("Download"), a[download]').first();
                        if (await downloadBtn.isVisible({ timeout: 3000 })) {
                            logs = await appendLog(task.id, 'success', '✓ Found video in Drafts!', logs);

                            // Try to download
                            const [download] = await Promise.all([
                                page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
                                downloadBtn.click(),
                            ]);

                            if (download) {
                                logs = await appendLog(task.id, 'info', '→ Downloading video...', logs);

                                // Save to temp file
                                const tempPath = path.join(__dirname, '..', 'temp', `${task.id}.mp4`);
                                await fs.promises.mkdir(path.dirname(tempPath), { recursive: true });
                                await download.saveAs(tempPath);

                                // Read the file
                                const videoBuffer = await fs.promises.readFile(tempPath);

                                // Upload to Supabase
                                logs = await appendLog(task.id, 'info', '→ Uploading to Supabase...', logs);
                                const { url } = await uploadVideoToSupabase(videoBuffer.buffer, task.id);
                                videoUrl = url;

                                // Cleanup temp file
                                await fs.promises.unlink(tempPath).catch(() => {});

                                logs = await appendLog(task.id, 'success', '✓ Video uploaded!', logs);
                                break;
                            }
                        }

                        // Try getting video src directly
                        const videoSrc = await firstVideo.getAttribute('src');
                        if (videoSrc && !existingVideoUrls.has(videoSrc)) {
                            logs = await appendLog(task.id, 'success', '✓ Found new video URL!', logs);
                            videoUrl = videoSrc;
                            break;
                        }
                    }
                }

                // Alternative: Check Activity panel
                const activityButton = page.locator('button[aria-label*="Activity"], button[aria-label*="Notification"]').first();
                if (await activityButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await activityButton.click();
                    await page.waitForTimeout(1000);

                    // Look for "ready" notification at top
                    const readyNotification = page.locator('text=/ready|준비되었습니다/i').first();
                    if (await readyNotification.isVisible({ timeout: 2000 }).catch(() => false)) {
                        logs = await appendLog(task.id, 'info', '→ Found completion notification!', logs);
                        await readyNotification.click();
                        await page.waitForTimeout(2000);
                        // Continue to try download from opened video
                    }
                }

            } catch (e) {
                logs = await appendLog(task.id, 'warning', `⚠ Check failed: ${e}`, logs);
            }

            await page.waitForTimeout(pollInterval);
        }

        // If still no video, check one more time
        if (!videoUrl) {
            logs = await appendLog(task.id, 'warning', '⚠ Video not found automatically', logs);
            logs = await appendLog(task.id, 'info', '→ Please manually download from Drafts', logs);
        }

        if (!videoUrl) {
            throw new Error('Timeout: Video did not complete within 10 minutes. Check Drafts manually.');
        }

        // If we got a URL but haven't downloaded yet, fetch it
        if (videoUrl && !videoUrl.includes('supabase')) {
            logs = await appendLog(task.id, 'info', '→ Downloading video...', logs);

            try {
                const response = await fetch(videoUrl);
                if (!response.ok) {
                    throw new Error(`Failed to download video: ${response.status}`);
                }

                const videoBuffer = await response.arrayBuffer();

                logs = await appendLog(task.id, 'info', '→ Uploading to Supabase...', logs);
                const { url, path: storagePath } = await uploadVideoToSupabase(videoBuffer, task.id);

                // Update task with video URL
                await updateTaskStatus(task.id, 'completed', {
                    final_video_url: url,
                    output_storage_path: storagePath,
                });
                await updateGeneratorStatus(task.video_generator_id, 'completed');

                logs = await appendLog(task.id, 'success', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
                logs = await appendLog(task.id, 'success', '🎉 VIDEO GENERATION COMPLETE!', logs);
                logs = await appendLog(task.id, 'success', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
                logs = await appendLog(task.id, 'info', `📹 URL: ${url}`, logs);

            } catch (downloadError) {
                throw new Error(`Failed to download/upload video: ${downloadError}`);
            }
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logs = await appendLog(task.id, 'error', `✗ Error: ${errorMessage}`, logs);

        await updateTaskStatus(task.id, 'failed', { task_error: errorMessage });
        await updateGeneratorStatus(task.video_generator_id, 'failed');

    } finally {
        await page.close();
    }
}

async function main() {
    console.log('\n' + '='.repeat(50));
    console.log('🎬 SORA WEB GENERATOR');
    console.log('='.repeat(50));

    // Ensure user data directory exists
    await fs.promises.mkdir(USER_DATA_DIR, { recursive: true });

    // Check for pending tasks
    console.log('→ Checking for pending tasks...');
    const tasks = await getPendingTasks();

    if (tasks.length === 0) {
        console.log('✓ No pending web generation tasks found.');
        console.log('  Create a task in VideoGenerator with "Sora2 Web" model selected.');
        console.log('='.repeat(50) + '\n');
        return;
    }

    console.log(`✓ Found ${tasks.length} pending task(s)`);
    console.log('='.repeat(50) + '\n');

    // Launch browser with persistent context
    console.log('→ Launching browser...');
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        viewport: { width: 1280, height: 800 },
        args: [
            '--disable-blink-features=AutomationControlled',
        ],
    });

    console.log('✓ Browser launched (session will persist)');
    console.log('');

    try {
        // Process tasks one at a time
        for (const task of tasks) {
            console.log(`\n→ Processing task: ${task.id}`);
            console.log(`  Prompt: "${task.metadata.prompt.substring(0, 50)}..."`);
            console.log(`  Duration: ${task.metadata.duration}s`);
            console.log(`  Aspect: ${task.metadata.aspect_ratio}`);
            console.log('');

            await generateVideo(context, task);
        }

    } finally {
        // Keep browser open for inspection if there were errors
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
