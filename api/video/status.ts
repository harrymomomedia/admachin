import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getVideoStatus } from '../services/video';

/**
 * GET /api/video/status
 *
 * Check the status of a video generation task
 *
 * Query Parameters:
 * - taskId: string (required) - The task ID returned from /api/video/generate
 *
 * Response:
 * {
 *   success: boolean,
 *   taskId: string,
 *   state: 'wait' | 'queueing' | 'generating' | 'success' | 'fail',
 *   videoUrl?: string,    // Available when state is 'success'
 *   imageUrl?: string,    // Thumbnail image
 *   failMsg?: string,     // Available when state is 'fail'
 *   error?: string        // Available when success is false
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { taskId } = req.query;

    // Validate required fields
    if (!taskId || typeof taskId !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Missing required query parameter: taskId',
        });
    }

    console.log(`[Video Status API] Checking status for taskId: ${taskId}`);

    try {
        const result = await getVideoStatus(taskId);

        if (!result.success) {
            console.error(`[Video Status API] Failed:`, result.error);
            return res.status(422).json(result);
        }

        console.log(`[Video Status API] TaskId: ${taskId}, State: ${result.state}`);
        return res.status(200).json(result);
    } catch (error) {
        console.error('[Video Status API] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while checking video status',
        });
    }
}
