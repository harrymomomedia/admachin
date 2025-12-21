/**
 * Video Generation Service - Frontend
 * Calls backend API routes (keys stay server-side)
 */

const API_BASE = '/api';

export interface VideoGenerateRequest {
    prompt: string;
    model?: 'sora-2-text-to-video' | 'sora-2-web-t2v';
    duration?: 5 | 10 | 15 | 20;  // Sora 2 supports various durations
    aspectRatio?: 'landscape' | 'portrait' | 'square';  // Sora 2 aspect ratios
}

export interface VideoGenerateResponse {
    success: boolean;
    taskId?: string;
    error?: string;
}

export type VideoTaskState = 'wait' | 'queueing' | 'generating' | 'success' | 'fail';

export interface VideoStatusResponse {
    success: boolean;
    taskId?: string;
    state?: VideoTaskState;
    videoUrl?: string;
    imageUrl?: string;
    failMsg?: string;
    error?: string;
}

/**
 * Start video generation
 */
export async function generateVideo(request: VideoGenerateRequest): Promise<VideoGenerateResponse> {
    try {
        const response = await fetch(`${API_BASE}/video/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Video Service] Generate error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate video',
        };
    }
}

/**
 * Check video generation status
 */
export async function getVideoStatus(taskId: string): Promise<VideoStatusResponse> {
    try {
        const response = await fetch(`${API_BASE}/video/status?taskId=${encodeURIComponent(taskId)}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Video Service] Status error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get video status',
        };
    }
}

/**
 * Poll video status until completion or failure
 */
export async function pollVideoStatus(
    taskId: string,
    onProgress?: (status: VideoStatusResponse) => void,
    intervalMs = 5000,
    maxAttempts = 120
): Promise<VideoStatusResponse> {
    let attempts = 0;

    while (attempts < maxAttempts) {
        const status = await getVideoStatus(taskId);

        if (onProgress) {
            onProgress(status);
        }

        if (!status.success) {
            return status;
        }

        if (status.state === 'success' || status.state === 'fail') {
            return status;
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
        attempts++;
    }

    return {
        success: false,
        taskId,
        error: 'Polling timeout - video generation took too long',
    };
}

/**
 * Check if video service is configured
 */
export async function isVideoServiceConfigured(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/video/generate`);
        const data = await response.json();
        return data.configured === true;
    } catch {
        return false;
    }
}

export interface TranscriptResponse {
    success: boolean;
    transcript?: string;
    error?: string;
}

/**
 * Generate a transcript from a video URL
 */
export async function generateTranscript(videoUrl: string): Promise<TranscriptResponse> {
    try {
        const response = await fetch(`${API_BASE}/video/transcript`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoUrl }),
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Video Service] Transcript error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate transcript',
        };
    }
}
