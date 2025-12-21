import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateVideo, isVideoServiceConfigured } from '../services/video';

/**
 * POST /api/video/generate
 *
 * Generate a video using kie.ai Runway API
 *
 * Request Body:
 * {
 *   prompt: string,
 *   imageUrl?: string,        // For image-to-video
 *   duration?: 5 | 10,        // Video duration in seconds
 *   quality?: '720p' | '1080p',
 *   aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4',
 *   callBackUrl?: string      // Webhook for completion notification
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET: Check if service is configured
    if (req.method === 'GET') {
        return res.status(200).json({
            configured: isVideoServiceConfigured(),
        });
    }

    // POST: Generate video
    if (req.method === 'POST') {
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

        // Validate duration
        if (duration !== undefined && ![5, 10].includes(duration)) {
            return res.status(400).json({
                success: false,
                error: 'Duration must be 5 or 10 seconds',
            });
        }

        // Validate quality
        if (quality !== undefined && !['720p', '1080p'].includes(quality)) {
            return res.status(400).json({
                success: false,
                error: 'Quality must be 720p or 1080p',
            });
        }

        // 1080p not available for 10-second videos
        if (duration === 10 && quality === '1080p') {
            return res.status(400).json({
                success: false,
                error: '1080p quality is not available for 10-second videos',
            });
        }

        console.log(`[Video Generate API] Prompt: "${prompt.substring(0, 50)}...", ImageUrl: ${imageUrl ? 'yes' : 'no'}`);

        try {
            const result = await generateVideo({
                prompt,
                imageUrl,
                duration,
                quality,
                aspectRatio,
                callBackUrl,
            });

            if (!result.success) {
                console.error(`[Video Generate API] Failed:`, result.error);
                return res.status(422).json(result);
            }

            console.log(`[Video Generate API] Success. TaskId: ${result.taskId}`);
            return res.status(200).json(result);
        } catch (error) {
            console.error('[Video Generate API] Unexpected error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error during video generation',
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
