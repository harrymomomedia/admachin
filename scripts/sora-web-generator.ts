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

// Sora web interface URLs
const SORA_URL = 'https://sora.chatgpt.com/';
const SORA_DRAFTS_URL = 'https://sora.chatgpt.com/drafts';

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

async function downloadCurrentVideo(
    page: Page,
    taskId: string,
    logs: VideoTask['logs']
): Promise<string | null> {
    try {
        // Look for download button
        const downloadBtn = page.locator('button:has-text("Download"), a[download], button[aria-label*="ownload"]').first();
        if (await downloadBtn.isVisible({ timeout: 3000 })) {
            logs = await appendLog(taskId, 'info', '→ Found download button, clicking...', logs);

            // Try to download
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
                downloadBtn.click(),
            ]);

            if (download) {
                logs = await appendLog(taskId, 'info', '→ Downloading video file...', logs);

                // Save to temp file
                const tempPath = path.join(__dirname, '..', 'temp', `${taskId}.mp4`);
                await fs.promises.mkdir(path.dirname(tempPath), { recursive: true });
                await download.saveAs(tempPath);

                // Read the file
                const videoBuffer = await fs.promises.readFile(tempPath);

                // Upload to Supabase
                logs = await appendLog(taskId, 'info', '→ Uploading to Supabase...', logs);
                const { url } = await uploadVideoToSupabase(videoBuffer.buffer, taskId);

                // Cleanup temp file
                await fs.promises.unlink(tempPath).catch(() => {});

                logs = await appendLog(taskId, 'success', '✓ Video downloaded and uploaded!', logs);
                return url;
            }
        }

        // Fallback: Try to get video src directly
        const videoElement = page.locator('video[src]').first();
        if (await videoElement.isVisible({ timeout: 2000 })) {
            const src = await videoElement.getAttribute('src');
            if (src) {
                return src;
            }
        }

        return null;
    } catch (e) {
        console.error('Download failed:', e);
        return null;
    }
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

        // Navigate to Sora Drafts page
        logs = await appendLog(task.id, 'info', `→ Navigating to ${SORA_DRAFTS_URL}...`, logs);
        await page.goto(SORA_DRAFTS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Check login state
        const isLoggedIn = await checkLoginState(page);
        if (!isLoggedIn) {
            logs = await waitForLogin(page, logs, task.id);
            // After login, navigate to drafts page
            await page.goto(SORA_DRAFTS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        } else {
            logs = await appendLog(task.id, 'success', '✓ Already logged in', logs);
        }

        // Wait a moment for page to fully load
        await page.waitForTimeout(3000);

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

        // Simple approach: Focus the prompt and press Enter to generate
        logs = await appendLog(task.id, 'info', '→ Focusing prompt and pressing Enter to generate...', logs);

        // Click on the prompt textarea to ensure it has focus
        if (promptInput) {
            await promptInput.click();
            await page.waitForTimeout(500);
        }

        // Press Enter to submit/generate
        await page.keyboard.press('Enter');

        // Wait a moment for the generation to start
        await page.waitForTimeout(3000);

        logs = await appendLog(task.id, 'success', '✓ Generation started (Enter pressed)', logs);

        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
        logs = await appendLog(task.id, 'info', '⏳ WAITING FOR VIDEO (2-5 mins)...', logs);
        logs = await appendLog(task.id, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
        logs = await appendLog(task.id, 'info', '→ Will refresh drafts page to check for completion...', logs);

        // Wait for video to be generated by refreshing drafts page
        const maxWaitTime = 10 * 60 * 1000; // 10 minutes max
        const pollInterval = 30000; // 30 seconds between refreshes
        const startTime = Date.now();

        let videoUrl: string | null = null;

        // Get count of existing videos before generation
        const initialVideoCount = existingVideoUrls.size;
        logs = await appendLog(task.id, 'info', `→ Initial draft count: ${initialVideoCount}`, logs);

        // Poll by refreshing the drafts page
        while (Date.now() - startTime < maxWaitTime) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            logs = await appendLog(task.id, 'info', `⏳ [${elapsed}s] Refreshing drafts page...`, logs);

            try {
                // Refresh the drafts page
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(3000);

                // Check for new video in top-left (first item)
                // Look for video elements or thumbnail cards
                const gridItems = page.locator('[class*="grid"] > div, [class*="gallery"] > div, [role="grid"] > div').first();
                const firstVideo = page.locator('video').first();

                // Check if the first video is new (not in our existing set)
                if (await firstVideo.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const src = await firstVideo.getAttribute('src');

                    // Also check if there's a "processing" or loading indicator on first item
                    const firstItemText = await gridItems.textContent().catch(() => '');
                    const isProcessing = firstItemText?.toLowerCase().includes('processing') ||
                                        firstItemText?.toLowerCase().includes('generating') ||
                                        firstItemText?.toLowerCase().includes('loading');

                    if (isProcessing) {
                        logs = await appendLog(task.id, 'info', '→ Video still processing...', logs);
                    } else if (src && !existingVideoUrls.has(src)) {
                        logs = await appendLog(task.id, 'success', '✓ New video found in drafts!', logs);

                        // Click on the first video to open it
                        await firstVideo.click();
                        await page.waitForTimeout(2000);

                        // Try to download
                        videoUrl = await downloadCurrentVideo(page, task.id, logs);
                        if (videoUrl) break;

                        // If download didn't work, try getting the src directly
                        if (!videoUrl && src) {
                            videoUrl = src;
                            break;
                        }
                    }
                }

                // Alternative: Count total videos and see if count increased
                const currentVideos = page.locator('video');
                const currentCount = await currentVideos.count();
                if (currentCount > initialVideoCount) {
                    logs = await appendLog(task.id, 'info', `→ Video count increased: ${initialVideoCount} → ${currentCount}`, logs);

                    // New video should be first, click it
                    const newVideo = currentVideos.first();
                    if (await newVideo.isVisible()) {
                        const newSrc = await newVideo.getAttribute('src');
                        if (newSrc && !existingVideoUrls.has(newSrc)) {
                            await newVideo.click();
                            await page.waitForTimeout(2000);
                            videoUrl = await downloadCurrentVideo(page, task.id, logs);
                            if (!videoUrl) videoUrl = newSrc;
                            if (videoUrl) break;
                        }
                    }
                }

            } catch (e) {
                logs = await appendLog(task.id, 'warning', `⚠ Refresh error: ${e}`, logs);
            }

            await page.waitForTimeout(pollInterval);
        }

        if (!videoUrl) {
            logs = await appendLog(task.id, 'warning', '⚠ Could not find new video after 10 minutes', logs);
            logs = await appendLog(task.id, 'info', '→ Please check Sora drafts manually', logs);
            throw new Error('Timeout: Video not found. Please check Sora drafts manually.');
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
