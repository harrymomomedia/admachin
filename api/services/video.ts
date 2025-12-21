/**
 * Video Generation Service
 * Handles video generation via kie.ai Runway API
 */

const KIE_API_BASE = 'https://api.kie.ai/api/v1';
const KIE_API_KEY = process.env.KIE_API_KEY;

export interface VideoGenerateRequest {
    prompt: string;
    imageUrl?: string;
    duration?: 5 | 10;
    quality?: '720p' | '1080p';
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
    waterMark?: string;
    callBackUrl?: string;
}

export interface VideoGenerateResponse {
    success: boolean;
    taskId?: string;
    error?: string;
}

export interface VideoStatusResponse {
    success: boolean;
    taskId?: string;
    state?: 'wait' | 'queueing' | 'generating' | 'success' | 'fail';
    videoUrl?: string;
    imageUrl?: string;
    failMsg?: string;
    error?: string;
}

/**
 * Generate a video using kie.ai Runway API
 */
export async function generateVideo(request: VideoGenerateRequest): Promise<VideoGenerateResponse> {
    if (!KIE_API_KEY) {
        return {
            success: false,
            error: 'KIE_API_KEY environment variable is not configured',
        };
    }

    try {
        const body: Record<string, unknown> = {
            prompt: request.prompt,
            duration: request.duration || 5,
            quality: request.quality || '720p',
            waterMark: request.waterMark ?? '',
        };

        // Add imageUrl for image-to-video
        if (request.imageUrl) {
            body.imageUrl = request.imageUrl;
        } else {
            // aspectRatio is required for text-to-video (no image)
            body.aspectRatio = request.aspectRatio || '16:9';
        }

        // Add callback URL if provided
        if (request.callBackUrl) {
            body.callBackUrl = request.callBackUrl;
        }

        console.log('[Video Generate] Sending request:', JSON.stringify(body, null, 2));

        const response = await fetch(`${KIE_API_BASE}/runway/generate`, {
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
            return {
                success: true,
                taskId: data.data.taskId,
            };
        }

        return {
            success: false,
            error: data.msg || 'Failed to generate video',
        };
    } catch (error) {
        console.error('[Video Generate] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * Check the status of a video generation task
 */
export async function getVideoStatus(taskId: string): Promise<VideoStatusResponse> {
    if (!KIE_API_KEY) {
        return {
            success: false,
            error: 'KIE_API_KEY environment variable is not configured',
        };
    }

    try {
        const response = await fetch(
            `${KIE_API_BASE}/runway/record-detail?taskId=${encodeURIComponent(taskId)}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${KIE_API_KEY}`,
                },
            }
        );

        const data = await response.json();
        console.log('[Video Status] Response:', JSON.stringify(data, null, 2));

        if (data.code === 200 && data.data) {
            return {
                success: true,
                taskId: data.data.taskId,
                state: data.data.state,
                videoUrl: data.data.videoInfo?.videoUrl,
                imageUrl: data.data.videoInfo?.imageUrl,
                failMsg: data.data.failMsg,
            };
        }

        return {
            success: false,
            error: data.msg || 'Failed to get video status',
        };
    } catch (error) {
        console.error('[Video Status] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * Check if the video generation service is configured
 */
export function isVideoServiceConfigured(): boolean {
    return !!KIE_API_KEY;
}

/**
 * Generate a transcript from a video URL using Gemini
 */
export async function generateTranscript(videoUrl: string): Promise<{
    success: boolean;
    transcript?: string;
    error?: string;
}> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: 'GEMINI_API_KEY environment variable is not configured',
        };
    }

    try {
        console.log('[Video Transcript] Generating transcript for:', videoUrl);

        // Use Gemini 1.5 Pro for video analysis
        const model = 'gemini-1.5-pro';
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                fileData: {
                                    mimeType: 'video/mp4',
                                    fileUri: videoUrl,
                                },
                            },
                            {
                                text: 'Please transcribe all spoken words in this video. If there is no speech, describe what is happening visually in 2-3 sentences. Return only the transcript or description, without any preamble or explanation.',
                            },
                        ],
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2000,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Video Transcript] API error:', errorData);
            return {
                success: false,
                error: errorData.error?.message || `Gemini API error: ${response.status}`,
            };
        }

        const data = await response.json();
        const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('[Video Transcript] Generated transcript:', transcript.substring(0, 100) + '...');

        return {
            success: true,
            transcript: transcript.trim(),
        };
    } catch (error) {
        console.error('[Video Transcript] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * Check if transcript generation is configured
 */
export function isTranscriptServiceConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
}
