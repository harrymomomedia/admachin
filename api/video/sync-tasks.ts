import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_API_BASE = 'https://api.kie.ai/api/v1';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// Helper to append a log entry to video_output
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

async function generateTranscript(videoUrl: string): Promise<string | null> {
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

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow GET requests (for cron) or POST
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!KIE_API_KEY) {
        return res.status(500).json({ error: 'KIE_API_KEY not configured' });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const startTime = Date.now();
    const maxDuration = 25000; // Run for 25 seconds max (leave buffer for response)
    const pollInterval = 10000; // Check every 10 seconds

    let totalChecks = 0;
    let completed = 0;
    let failed = 0;

    try {
        // Poll loop - check every 10 seconds for up to 25 seconds
        while (Date.now() - startTime < maxDuration) {
            // Get all pending/processing video outputs with their logs
            const { data: pendingTasks, error: fetchError } = await supabase
                .from('video_output')
                .select('id, video_generator_id, task_id, task_status, logs')
                .in('task_status', ['pending', 'processing']);

            if (fetchError) {
                console.error('[Sync] Error fetching pending tasks:', fetchError);
                break;
            }

            if (!pendingTasks || pendingTasks.length === 0) {
                console.log('[Sync] No pending tasks');
                break; // No tasks to process, exit loop
            }

            console.log(`[Sync] Checking ${pendingTasks.length} pending tasks...`);

            for (const task of pendingTasks as VideoOutput[]) {
                if (!task.task_id) continue;

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
                            logs = await appendLog(supabase, task.id, 'info', `[Server] Video URL: ${videoUrl}`, logs);

                            // Generate transcript
                            logs = await appendLog(supabase, task.id, 'info', '[Server] Generating transcript...', logs);
                            const transcript = await generateTranscript(videoUrl);

                            if (transcript) {
                                logs = await appendLog(supabase, task.id, 'success', '[Server] Transcript generated', logs);
                            } else {
                                logs = await appendLog(supabase, task.id, 'warning', '[Server] Transcript generation failed or no speech detected', logs);
                            }

                            logs = await appendLog(supabase, task.id, 'success', '[Server] ✓ Complete!', logs);

                            // Update video_output
                            await supabase
                                .from('video_output')
                                .update({
                                    task_status: 'completed',
                                    final_video_url: videoUrl,
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

                            console.log(`[Sync] Task ${task.task_id}: completed`);
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
                    // If still processing, the log was already added above
                } catch (err) {
                    console.error(`[Sync] Error processing task ${task.task_id}:`, err);
                    await appendLog(supabase, task.id, 'error', `[Server] Error checking status: ${err}`, logs);
                }
            }

            // Check if all tasks completed
            const { data: remainingTasks } = await supabase
                .from('video_output')
                .select('id')
                .in('task_status', ['pending', 'processing']);

            if (!remainingTasks || remainingTasks.length === 0) {
                console.log('[Sync] All tasks completed');
                break;
            }

            // Wait before next poll
            if (Date.now() - startTime + pollInterval < maxDuration) {
                await sleep(pollInterval);
            } else {
                break;
            }
        }

        return res.json({
            message: 'Sync complete',
            duration: Date.now() - startTime,
            totalChecks,
            completed,
            failed,
        });
    } catch (error) {
        console.error('[Sync] Error:', error);
        return res.status(500).json({ error: String(error) });
    }
}
