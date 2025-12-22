/**
 * Video API Routes - Express version
 * Converted from Vercel serverless functions
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const router = Router();

// Environment variables
const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_API_BASE = 'https://api.kie.ai/api/v1';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Types
interface LogEntry {
    id: number;
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
}

interface VideoOutput {
    id: string;
    video_generator_id: string;
    task_id: string;
    task_status: string;
    logs: LogEntry[];
}

interface KieStatusResponse {
    code: number;
    msg: string;
    data?: {
        taskId: string;
        state: string;
        status?: string;
        output?: {
            video_url?: string;
            thumbnail_url?: string;
        };
        videoUrl?: string;
        imageUrl?: string;
        error?: string;
        failMsg?: string;
    };
}

// Helper functions
function getSupabaseClient(): SupabaseClient | null {
    if (!supabaseUrl || !supabaseServiceKey) return null;
    return createClient(supabaseUrl, supabaseServiceKey);
}

async function appendLog(
    supabase: SupabaseClient,
    videoOutputId: string,
    type: LogEntry['type'],
    message: string,
    existingLogs: LogEntry[]
): Promise<LogEntry[]> {
    const newLog: LogEntry = {
        id: existingLogs.length > 0 ? Math.max(...existingLogs.map(l => l.id)) + 1 : 1,
        timestamp: new Date().toISOString(),
        type,
        message,
    };
    const updatedLogs = [...existingLogs, newLog];

    await supabase
        .from('video_output')
        .update({ logs: updatedLogs })
        .eq('id', videoOutputId);

    return updatedLogs;
}

/**
 * Download video from URL and upload to Supabase storage
 */
async function uploadVideoToSupabase(
    supabase: SupabaseClient,
    videoUrl: string,
    videoOutputId: string
): Promise<{ path: string; url: string } | null> {
    try {
        // Download video from Kie.ai URL
        const response = await fetch(videoUrl);
        if (!response.ok) {
            console.error(`[Upload] Failed to download video: ${response.status}`);
            return null;
        }

        const videoBuffer = await response.arrayBuffer();
        const filename = `${Date.now()}.mp4`;
        const filePath = `videos/${videoOutputId}/${filename}`;

        // Upload to Supabase storage
        const { data, error } = await supabase.storage
            .from('video-generator')
            .upload(filePath, videoBuffer, {
                cacheControl: '3600',
                upsert: true,
                contentType: 'video/mp4',
            });

        if (error) {
            console.error(`[Upload] Failed to upload to Supabase:`, error.message);
            return null;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('video-generator')
            .getPublicUrl(data.path);

        console.log(`[Upload] Video uploaded: ${urlData.publicUrl}`);
        return {
            path: data.path,
            url: urlData.publicUrl,
        };
    } catch (err) {
        console.error(`[Upload] Error uploading video:`, err);
        return null;
    }
}

async function generateTranscriptFromVideo(videoUrl: string): Promise<string | null> {
    if (!GEMINI_API_KEY) return null;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { fileData: { mimeType: 'video/mp4', fileUri: videoUrl } },
                            { text: 'Please transcribe all spoken words in this video. If there is no speech, describe what is happening visually in 2-3 sentences. Return only the transcript or description.' },
                        ],
                    }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
                }),
            }
        );

        const data = await response.json();
        if (response.ok) {
            return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
        }
        return null;
    } catch {
        return null;
    }
}

// ============================================
// GET /api/video/generate - Check if configured
// POST /api/video/generate - Generate video
// ============================================
router.get('/generate', (_req: Request, res: Response) => {
    res.json({ configured: !!KIE_API_KEY });
});

router.post('/generate', async (req: Request, res: Response) => {
    const { prompt, imageUrl, duration, quality, aspectRatio, callBackUrl } = req.body;

    // Validate required fields
    if (!prompt) {
        return res.status(400).json({
            success: false,
            error: 'Missing required field: prompt',
        });
    }

    // Validate prompt length
    if (prompt.length > 1800) {
        return res.status(400).json({
            success: false,
            error: 'Prompt exceeds maximum length of 1800 characters',
        });
    }

    // Validate n_frames (kie.ai sora-2-text-to-video supports 10, sora-2-pro supports 10, 15)
    const validFrames = [10, 15];
    const requestedFrames = duration || 10;
    if (!validFrames.includes(requestedFrames)) {
        return res.status(400).json({
            success: false,
            error: `Invalid duration: ${requestedFrames}s. Sora 2 supports 10s or 15s videos.`,
        });
    }

    if (!KIE_API_KEY) {
        return res.status(500).json({
            success: false,
            error: 'KIE_API_KEY not configured',
        });
    }

    console.log(`[Video Generate] Prompt: "${prompt.substring(0, 50)}...", ImageUrl: ${imageUrl ? 'yes' : 'no'}, Duration: ${requestedFrames}s`);

    try {
        // Build input object for kie.ai API
        const input: Record<string, unknown> = {
            prompt,
            n_frames: String(requestedFrames), // "10" or "15"
        };

        // Aspect ratio mapping: Sora 2 only supports landscape and portrait
        const aspectRatioMap: Record<string, string> = {
            '16:9': 'landscape',
            '9:16': 'portrait',
        };

        if (imageUrl) {
            // Image-to-video mode
            input.image_url = imageUrl;
        } else {
            // Text-to-video mode - set aspect ratio (defaults to landscape)
            input.aspect_ratio = aspectRatioMap[aspectRatio] || 'landscape';
        }

        const body: Record<string, unknown> = {
            model: imageUrl ? 'sora-2-image-to-video' : 'sora-2-text-to-video',
            input,
        };

        if (callBackUrl) {
            body.callBackUrl = callBackUrl;
        }

        const response = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KIE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        console.log('[Video Generate] Response:', JSON.stringify(data, null, 2));

        if (data.code === 200 && data.data?.taskId) {
            return res.json({
                success: true,
                taskId: data.data.taskId,
            });
        }

        return res.status(422).json({
            success: false,
            error: data.msg || 'Failed to generate video',
        });
    } catch (error) {
        console.error('[Video Generate] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error during video generation',
        });
    }
});

// ============================================
// GET /api/video/status - Check video status
// ============================================
router.get('/status', async (req: Request, res: Response) => {
    const taskId = req.query.taskId as string;

    if (!taskId) {
        return res.status(400).json({
            success: false,
            error: 'Missing taskId parameter',
        });
    }

    if (!KIE_API_KEY) {
        return res.status(500).json({
            success: false,
            error: 'KIE_API_KEY not configured',
        });
    }

    try {
        const response = await fetch(
            `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${KIE_API_KEY}`,
                },
            }
        );

        const data = await response.json();

        if (data.code === 200 && data.data) {
            // Handle both old and new response formats
            const videoUrl = data.data.output?.video_url || data.data.videoUrl;
            const imageUrl = data.data.output?.thumbnail_url || data.data.imageUrl;
            const state = data.data.state || data.data.status;

            return res.json({
                success: true,
                taskId: data.data.taskId,
                state,
                videoUrl,
                imageUrl,
                failMsg: data.data.failMsg || data.data.error,
            });
        }

        return res.json({
            success: false,
            error: data.msg || 'Failed to get video status',
        });
    } catch (error) {
        console.error('[Video Status] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

// ============================================
// POST /api/video/transcript - Generate transcript
// ============================================
router.post('/transcript', async (req: Request, res: Response) => {
    const { videoUrl } = req.body;

    if (!videoUrl) {
        return res.status(400).json({
            success: false,
            error: 'Missing videoUrl',
        });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({
            success: false,
            error: 'GEMINI_API_KEY not configured',
        });
    }

    try {
        const transcript = await generateTranscriptFromVideo(videoUrl);

        if (transcript) {
            return res.json({
                success: true,
                transcript,
            });
        }

        return res.json({
            success: false,
            error: 'Failed to generate transcript',
        });
    } catch (error) {
        console.error('[Video Transcript] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

// ============================================
// POST /api/video/sync-tasks - Sync video tasks (for cron)
// GET /api/video/sync-tasks - Also allowed for cron triggers
// ============================================
router.all('/sync-tasks', async (_req: Request, res: Response) => {
    const result = await syncVideoTasks();
    return res.json(result);
});

/**
 * Sync video tasks - checks kie.ai for status updates
 * Called by cron job every minute
 */
export async function syncVideoTasks(): Promise<{
    message: string;
    duration: number;
    totalChecks: number;
    completed: number;
    failed: number;
    error?: string;
}> {
    if (!KIE_API_KEY) {
        return { message: 'Error', duration: 0, totalChecks: 0, completed: 0, failed: 0, error: 'KIE_API_KEY not configured' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return { message: 'Error', duration: 0, totalChecks: 0, completed: 0, failed: 0, error: 'Supabase not configured' };
    }

    const startTime = Date.now();
    let totalChecks = 0;
    let completed = 0;
    let failed = 0;

    try {
        // Get all pending/processing video outputs
        const { data: pendingTasks, error: fetchError } = await supabase
            .from('video_output')
            .select('id, video_generator_id, task_id, task_status, logs')
            .in('task_status', ['pending', 'processing']);

        if (fetchError) {
            console.error('[Sync] Error fetching pending tasks:', fetchError);
            return { message: 'Error', duration: Date.now() - startTime, totalChecks, completed, failed, error: fetchError.message };
        }

        if (!pendingTasks || pendingTasks.length === 0) {
            console.log('[Sync] No pending tasks');
            return { message: 'No pending tasks', duration: Date.now() - startTime, totalChecks, completed, failed };
        }

        console.log(`[Sync] Checking ${pendingTasks.length} pending tasks...`);

        for (const task of pendingTasks as VideoOutput[]) {
            if (!task.task_id) continue;

            // Skip web generation tasks (handled by Playwright script)
            if (task.task_id.startsWith('web-')) {
                console.log(`[Sync] Skipping web task: ${task.task_id}`);
                continue;
            }

            let logs = task.logs || [];

            try {
                // Check status on kie.ai
                const kieResponse = await fetch(
                    `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(task.task_id)}`,
                    {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
                    }
                );

                const statusData: KieStatusResponse = await kieResponse.json();
                totalChecks++;

                if (statusData.code !== 200 || !statusData.data) {
                    logs = await appendLog(supabase, task.id, 'warning', `[Server] API error: ${statusData.msg}`, logs);
                    continue;
                }

                const state = statusData.data.state || statusData.data.status;
                const videoUrl = statusData.data.output?.video_url || statusData.data.videoUrl;
                const imageUrl = statusData.data.output?.thumbnail_url || statusData.data.imageUrl;

                // Log the status check
                logs = await appendLog(supabase, task.id, 'info', `[Server] Status: ${state}`, logs);

                // Handle completion
                if (state === 'completed' || state === 'success') {
                    if (videoUrl) {
                        logs = await appendLog(supabase, task.id, 'success', '[Server] Video generation completed!', logs);
                        logs = await appendLog(supabase, task.id, 'info', `[Server] Kie.ai URL: ${videoUrl}`, logs);

                        // Upload video to Supabase storage (convert temporary Kie.ai URL to permanent Supabase URL)
                        logs = await appendLog(supabase, task.id, 'info', '[Server] Uploading video to Supabase storage...', logs);
                        const uploadResult = await uploadVideoToSupabase(supabase, videoUrl, task.id);

                        let finalVideoUrl = videoUrl; // Fallback to Kie.ai URL if upload fails
                        let storagePath: string | null = null;

                        if (uploadResult) {
                            finalVideoUrl = uploadResult.url;
                            storagePath = uploadResult.path;
                            logs = await appendLog(supabase, task.id, 'success', '[Server] Video uploaded to Supabase', logs);
                            logs = await appendLog(supabase, task.id, 'info', `[Server] Supabase URL: ${finalVideoUrl}`, logs);
                        } else {
                            logs = await appendLog(supabase, task.id, 'warning', '[Server] Supabase upload failed, using Kie.ai URL', logs);
                        }

                        // Generate transcript using the final video URL
                        logs = await appendLog(supabase, task.id, 'info', '[Server] Generating transcript...', logs);
                        const transcript = await generateTranscriptFromVideo(finalVideoUrl);

                        if (transcript) {
                            logs = await appendLog(supabase, task.id, 'success', '[Server] Transcript generated', logs);
                        } else {
                            logs = await appendLog(supabase, task.id, 'warning', '[Server] Transcript generation failed', logs);
                        }

                        logs = await appendLog(supabase, task.id, 'success', '[Server] ✓ Complete!', logs);

                        // Update video_output with Supabase URL
                        await supabase
                            .from('video_output')
                            .update({
                                task_status: 'completed',
                                final_video_url: finalVideoUrl,
                                output_storage_path: storagePath, // Store Supabase storage path
                                transcript: transcript,
                                logs: logs,
                            })
                            .eq('id', task.id);

                        // Update video_generator status
                        await supabase
                            .from('video_generator')
                            .update({
                                status: 'completed',
                                middle_frame_path: imageUrl || null,
                                transcript: transcript,
                            })
                            .eq('id', task.video_generator_id);

                        console.log(`[Sync] Task ${task.task_id}: completed, URL: ${finalVideoUrl}`);
                        completed++;
                    }
                } else if (state === 'failed' || state === 'fail') {
                    const errorMsg = statusData.data.error || statusData.data.failMsg || 'Unknown error';

                    logs = await appendLog(supabase, task.id, 'error', `[Server] Generation failed: ${errorMsg}`, logs);

                    // Update video_output
                    await supabase
                        .from('video_output')
                        .update({
                            task_status: 'failed',
                            task_error: errorMsg,
                            logs: logs,
                        })
                        .eq('id', task.id);

                    // Update video_generator status
                    await supabase
                        .from('video_generator')
                        .update({ status: 'failed' })
                        .eq('id', task.video_generator_id);

                    console.log(`[Sync] Task ${task.task_id}: failed - ${errorMsg}`);
                    failed++;
                }
            } catch (err) {
                console.error(`[Sync] Error processing task ${task.task_id}:`, err);
                await appendLog(supabase, task.id, 'error', `[Server] Error checking status: ${err}`, logs);
            }
        }

        return {
            message: 'Sync complete',
            duration: Date.now() - startTime,
            totalChecks,
            completed,
            failed,
        };
    } catch (error) {
        console.error('[Sync] Error:', error);
        return {
            message: 'Error',
            duration: Date.now() - startTime,
            totalChecks,
            completed,
            failed,
            error: String(error),
        };
    }
}

export default router;
