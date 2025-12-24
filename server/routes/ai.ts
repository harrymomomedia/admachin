/**
 * AI API Routes - Express version
 * Converted from Vercel serverless functions
 */

import { Router, Request, Response } from 'express';
import { generateContent, getAvailableProviders, AIProvider, AIGenerateRequest } from '../services/ai.js';
// Import centralized AI model configuration - single source of truth
// NOTE: This is a copy of src/lib/ai-models.ts for server-side use
import { AI_MODELS, getApiModelId, type AIModel as CentralAIModel } from '../lib/ai-models.js';

const router = Router();

// Types for legacy endpoint - extend central types with legacy aliases
type ClaudeModel = 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5';
type AIModel = CentralAIModel | 'claude' | 'claude-sonnet' | 'claude-haiku' | 'claude-opus';

interface LegacyAIRequest {
    model: AIModel;
    systemPrompt: string;
    userPrompt: string;
}

// ============================================
// Legacy endpoint: POST /api/ai-generate
// ============================================
async function callClaude(model: ClaudeModel, systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        throw new Error('Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.');
    }

    // Use centralized model ID lookup
    const apiModelId = getApiModelId(model);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: apiModelId,
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content[0].text;
}

async function callGPT(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 8192
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        throw new Error('Google API key not configured. Please add GOOGLE_API_KEY to your environment variables.');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
    return data.candidates[0].content.parts[0].text;
}

// Legacy endpoint (mounted at /api/ai-generate by the main server)
router.post('/', async (req: Request, res: Response) => {
    try {
        const { model, systemPrompt, userPrompt } = req.body as LegacyAIRequest;

        if (!model || !systemPrompt || !userPrompt) {
            return res.status(400).json({ error: 'Missing required fields: model, systemPrompt, userPrompt' });
        }

        let response: string;

        // Normalize model name - handle legacy values
        let normalizedModel: ClaudeModel | 'gpt' | 'gemini' = model as ClaudeModel | 'gpt' | 'gemini';
        if (model === 'claude' || model === 'claude-sonnet') normalizedModel = 'claude-sonnet-4.5';
        if (model === 'claude-haiku') normalizedModel = 'claude-haiku-4.5';
        if (model === 'claude-opus') normalizedModel = 'claude-opus-4.5';

        switch (normalizedModel) {
            case 'claude-sonnet-4.5':
            case 'claude-opus-4.5':
            case 'claude-haiku-4.5':
                response = await callClaude(normalizedModel, systemPrompt, userPrompt);
                break;
            case 'gpt':
                response = await callGPT(systemPrompt, userPrompt);
                break;
            case 'gemini':
                response = await callGemini(systemPrompt, userPrompt);
                break;
            default:
                return res.status(400).json({ error: `Unsupported model: ${model}` });
        }

        return res.json({ response });
    } catch (error) {
        console.error('AI API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: errorMessage });
    }
});

// ============================================
// New unified endpoint: /api/ai/generate
// GET - Return available providers
// POST - Generate content
// ============================================
router.get('/generate', (_req: Request, res: Response) => {
    const providers = getAvailableProviders();
    return res.json({
        availableProviders: providers,
        defaultProvider: providers[0] || null,
    });
});

router.post('/generate', async (req: Request, res: Response) => {
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
        return res.json(result);
    } catch (error) {
        console.error('[AI Generate] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error during AI generation',
        });
    }
});

export default router;
