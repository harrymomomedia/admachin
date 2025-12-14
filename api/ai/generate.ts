import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateContent, getAvailableProviders, AIProvider, AIGenerateRequest } from '../services/ai';

/**
 * POST /api/ai/generate
 * 
 * Unified endpoint for AI content generation.
 * Supports OpenAI, Gemini, and Claude providers.
 * 
 * Request Body:
 * {
 *   provider: 'openai' | 'gemini' | 'claude',
 *   systemPrompt?: string,
 *   userPrompt: string,
 *   options?: {
 *     temperature?: number,
 *     maxTokens?: number,
 *     model?: string
 *   }
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET: Return available providers
    if (req.method === 'GET') {
        const providers = getAvailableProviders();
        return res.status(200).json({
            availableProviders: providers,
            defaultProvider: providers[0] || null,
        });
    }

    // POST: Generate content
    if (req.method === 'POST') {
        const { provider, systemPrompt, userPrompt, options } = req.body as AIGenerateRequest;

        // Validate required fields
        if (!provider) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: provider',
            });
        }

        if (!userPrompt) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: userPrompt',
            });
        }

        // Validate provider
        const validProviders: AIProvider[] = ['openai', 'gemini', 'claude'];
        if (!validProviders.includes(provider)) {
            return res.status(400).json({
                success: false,
                error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
            });
        }

        console.log(`[AI Generate] Provider: ${provider}, Prompt length: ${userPrompt.length}`);

        try {
            const result = await generateContent({
                provider,
                systemPrompt,
                userPrompt,
                options,
            });

            if (!result.success) {
                console.error(`[AI Generate] Failed:`, result.error);
                return res.status(422).json(result);
            }

            console.log(`[AI Generate] Success. Tokens used: ${result.usage?.totalTokens || 'N/A'}`);
            return res.status(200).json(result);
        } catch (error) {
            console.error('[AI Generate] Unexpected error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error during AI generation',
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
