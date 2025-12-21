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

// Kie.ai API for watermark removal
const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_API_BASE = 'https://api.kie.ai/api/v1';

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
    videoOutputId: string,
    suffix: string = ''
): Promise<{ path: string; url: string }> {
    const filename = `${Date.now()}${suffix}.mp4`;
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

async function removeWatermark(
    videoUrl: string,
    taskId: string,
    logs: VideoTask['logs']
): Promise<{ url: string; logs: VideoTask['logs'] } | null> {
    if (!KIE_API_KEY) {
        logs = await appendLog(taskId, 'warning', '⚠ KIE_API_KEY not set, skipping watermark removal', logs);
        return null;
    }

    try {
        logs = await appendLog(taskId, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
        logs = await appendLog(taskId, 'info', '🧹 REMOVING WATERMARK...', logs);
        logs = await appendLog(taskId, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);

        // Start watermark removal task
        logs = await appendLog(taskId, 'info', '→ Starting watermark removal...', logs);

        const createResponse = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KIE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'sora-watermark-remover',
                input: {
                    video_url: videoUrl,
                },
            }),
        });

        const createData = await createResponse.json();

        if (createData.code !== 200 || !createData.data?.taskId) {
            logs = await appendLog(taskId, 'error', `✗ Failed to start: ${createData.msg}`, logs);
            return { url: videoUrl, logs }; // Return original URL on failure
        }

        const kieTaskId = createData.data.taskId;
        logs = await appendLog(taskId, 'success', `✓ Task started: ${kieTaskId}`, logs);

        // Poll for completion
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes max for watermark removal
        const pollInterval = 10000; // 10 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            const statusResponse = await fetch(
                `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(kieTaskId)}`,
                {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
                }
            );

            const statusData = await statusResponse.json();

            if (statusData.code !== 200 || !statusData.data) {
                logs = await appendLog(taskId, 'warning', `⚠ [${elapsed}s] Status check failed`, logs);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                continue;
            }

            const state = statusData.data.state || statusData.data.status;

            // Parse resultJson to get the clean video URL
            let cleanVideoUrl: string | null = null;
            if (statusData.data.resultJson) {
                try {
                    const resultJson = JSON.parse(statusData.data.resultJson);
                    if (resultJson.resultUrls && resultJson.resultUrls.length > 0) {
                        cleanVideoUrl = resultJson.resultUrls[0];
                    }
                } catch {
                    // Fallback to other formats
                }
            }
            // Fallback to other response formats
            if (!cleanVideoUrl) {
                cleanVideoUrl = statusData.data.output?.video_url || statusData.data.videoUrl;
            }

            if (state === 'completed' || state === 'success') {
                if (cleanVideoUrl) {
                    logs = await appendLog(taskId, 'success', `✓ Watermark removed! (${elapsed}s)`, logs);
                    return { url: cleanVideoUrl, logs };
                }
            } else if (state === 'failed' || state === 'fail') {
                const errorMsg = statusData.data.error || statusData.data.failMsg || 'Unknown error';
                logs = await appendLog(taskId, 'error', `✗ Watermark removal failed: ${errorMsg}`, logs);
                return { url: videoUrl, logs }; // Return original URL on failure
            } else {
                logs = await appendLog(taskId, 'info', `⏳ [${elapsed}s] Processing...`, logs);
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        logs = await appendLog(taskId, 'warning', '⚠ Watermark removal timed out, using original', logs);
        return { url: videoUrl, logs };

    } catch (error) {
        logs = await appendLog(taskId, 'error', `✗ Watermark removal error: ${error}`, logs);
        return { url: videoUrl, logs };
    }
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

        // Fill the prompt using keyboard (safer than clicking around)
        // Use fill() which focuses and types without extra clicks
        await promptInput.fill(task.metadata.prompt);
        logs = await appendLog(task.id, 'success', '✓ Prompt entered', logs);

        // Note: Aspect ratio and duration will use Sora defaults
        // We avoid clicking other UI elements to prevent mis-clicks

        // Record existing video URLs before generating (to detect new ones)
        const existingVideoUrls = new Set<string>();
        const existingVideos = page.locator('video');
        const existingCount = await existingVideos.count();
        for (let i = 0; i < existingCount; i++) {
            const src = await existingVideos.nth(i).getAttribute('src');
            if (src) existingVideoUrls.add(src);
        }
        logs = await appendLog(task.id, 'info', `📊 Found ${existingVideoUrls.size} existing video(s) on page`, logs);

        // Press Enter to submit/generate (fill() already set focus)
        logs = await appendLog(task.id, 'info', '→ Pressing Enter to generate...', logs);
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

        // Wait initial time for video generation (Sora takes 2-5 minutes)
        logs = await appendLog(task.id, 'info', '→ Waiting 2 minutes for video generation...', logs);
        await page.waitForTimeout(120000); // 2 minutes initial wait

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

                        // Click "Post" button to publish the video
                        logs = await appendLog(task.id, 'info', '→ Publishing video (clicking Post)...', logs);
                        const postButton = page.locator('button:has-text("Post"), button[aria-label*="Post"]').first();
                        if (await postButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                            await postButton.click();
                            await page.waitForTimeout(3000);
                            logs = await appendLog(task.id, 'success', '✓ Video posted', logs);
                        } else {
                            logs = await appendLog(task.id, 'warning', '⚠ Post button not found, trying to continue...', logs);
                        }

                        // Go to profile page to get the public URL
                        logs = await appendLog(task.id, 'info', '→ Going to profile page...', logs);
                        await page.goto('https://sora.chatgpt.com/profile', { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await page.waitForTimeout(3000);

                        // Wait for the posted video to appear on profile
                        logs = await appendLog(task.id, 'info', '→ Waiting for video on profile...', logs);
                        let profileVideoUrl: string | null = null;
                        const profileWaitStart = Date.now();
                        const profileMaxWait = 60000; // 1 minute max

                        while (Date.now() - profileWaitStart < profileMaxWait) {
                            await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                            await page.waitForTimeout(3000);

                            // Click on the first video (most recent)
                            const profileVideo = page.locator('video').first();
                            if (await profileVideo.isVisible({ timeout: 3000 }).catch(() => false)) {
                                await profileVideo.click();
                                await page.waitForTimeout(2000);

                                // Get the public URL
                                const publicUrl = page.url();
                                if (publicUrl.includes('sora.chatgpt.com') && !publicUrl.includes('/profile')) {
                                    logs = await appendLog(task.id, 'success', `✓ Got public URL: ${publicUrl}`, logs);
                                    profileVideoUrl = publicUrl;
                                    break;
                                }
                            }

                            const waitElapsed = Math.round((Date.now() - profileWaitStart) / 1000);
                            logs = await appendLog(task.id, 'info', `⏳ [${waitElapsed}s] Waiting for video on profile...`, logs);
                        }

                        if (profileVideoUrl) {
                            videoUrl = profileVideoUrl;
                            break;
                        }

                        // Fallback to draft URL if profile didn't work
                        const draftUrl = page.url();
                        if (draftUrl.includes('sora.chatgpt.com')) {
                            videoUrl = draftUrl;
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

                            // Get Sora page URL
                            const currentUrl = page.url();
                            if (currentUrl.includes('sora.chatgpt.com')) {
                                logs = await appendLog(task.id, 'info', `→ Sora page URL: ${currentUrl}`, logs);
                                videoUrl = currentUrl;
                                break;
                            }

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

        // Pass Sora URL to kie.ai for watermark removal and get clean video
        if (videoUrl) {
            try {
                if (!KIE_API_KEY) {
                    throw new Error('KIE_API_KEY not set - cannot process video');
                }

                // Send Sora URL to kie.ai watermark remover
                const watermarkResult = await removeWatermark(videoUrl, task.id, logs);
                if (!watermarkResult || !watermarkResult.url || watermarkResult.url === videoUrl) {
                    throw new Error('Watermark removal failed');
                }
                logs = watermarkResult.logs;

                // Download clean video from kie.ai
                logs = await appendLog(task.id, 'info', '→ Downloading clean video from kie.ai...', logs);
                const cleanResponse = await fetch(watermarkResult.url);
                if (!cleanResponse.ok) {
                    throw new Error(`Failed to download clean video: ${cleanResponse.status}`);
                }

                const cleanBuffer = await cleanResponse.arrayBuffer();

                // Upload to Supabase
                logs = await appendLog(task.id, 'info', '→ Uploading to Supabase...', logs);
                const { url: finalUrl, path: finalPath } = await uploadVideoToSupabase(cleanBuffer, task.id, '');

                // Update task with final video URL
                await updateTaskStatus(task.id, 'completed', {
                    final_video_url: finalUrl,
                    output_storage_path: finalPath,
                });
                await updateGeneratorStatus(task.video_generator_id, 'completed');

                logs = await appendLog(task.id, 'success', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
                logs = await appendLog(task.id, 'success', '🎉 VIDEO GENERATION COMPLETE!', logs);
                logs = await appendLog(task.id, 'success', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', logs);
                logs = await appendLog(task.id, 'info', `📹 URL: ${finalUrl}`, logs);

            } catch (processError) {
                throw new Error(`Failed to process video: ${processError}`);
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
