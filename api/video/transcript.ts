import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateTranscript, isTranscriptServiceConfigured } from '../services/video';

/**
 * POST /api/video/transcript
 *
 * Generate a transcript from a video URL using Gemini
 *
 * Request Body:
 * {
 *   videoUrl: string  // The URL of the video to transcribe
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   transcript?: string,
 *   error?: string
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
            configured: isTranscriptServiceConfigured(),
        });
    }

    // POST: Generate transcript
    if (req.method === 'POST') {
        const { videoUrl } = req.body;

        // Validate required fields
        if (!videoUrl) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: videoUrl',
            });
        }

        // Validate URL format
        try {
            new URL(videoUrl);
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Invalid video URL format',
            });
        }

        console.log(`[Video Transcript API] Generating transcript for: ${videoUrl}`);

        try {
            const result = await generateTranscript(videoUrl);

            if (!result.success) {
                console.error(`[Video Transcript API] Failed:`, result.error);
                return res.status(422).json(result);
            }

            console.log(`[Video Transcript API] Success. Transcript length: ${result.transcript?.length || 0}`);
            return res.status(200).json(result);
        } catch (error) {
            console.error('[Video Transcript API] Unexpected error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error during transcript generation',
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
