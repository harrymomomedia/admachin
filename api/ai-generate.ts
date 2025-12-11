import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file (for local development)
// Explicitly specify the path since this file might be imported from a different location
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type ClaudeModel = 'claude-sonnet' | 'claude-opus' | 'claude-haiku';
type AIModel = ClaudeModel | 'gpt' | 'gemini';

interface AIRequest {
    model: AIModel;
    systemPrompt: string;
    userPrompt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { model, systemPrompt, userPrompt } = req.body as AIRequest;

        if (!model || !systemPrompt || !userPrompt) {
            return res.status(400).json({ error: 'Missing required fields: model, systemPrompt, userPrompt' });
        }

        let response: string;

        // Normalize model name - handle legacy 'claude' value
        const normalizedModel = model === 'claude' ? 'claude-sonnet' : model;

        switch (normalizedModel) {
            case 'claude-sonnet':
            case 'claude-opus':
            case 'claude-haiku':
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

        return res.status(200).json({ response });
    } catch (error) {
        console.error('AI API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: errorMessage });
    }
}

// Map our model names to Anthropic API model IDs
const CLAUDE_MODEL_MAP: Record<ClaudeModel, string> = {
    'claude-sonnet': 'claude-sonnet-4-20250514',
    'claude-opus': 'claude-opus-4-20250514',
    'claude-haiku': 'claude-haiku-4-20250514'
};

async function callClaude(model: ClaudeModel, systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    // Debug logging
    console.log('Environment check:', {
        hasAnthropicKey: !!apiKey,
        keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'undefined',
        cwd: process.cwd(),
        selectedModel: model,
        anthropicModel: CLAUDE_MODEL_MAP[model]
    });

    if (!apiKey) {
        throw new Error('Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL_MAP[model],
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userPrompt
                }
            ]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json() as any;
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
            max_tokens: 4096
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        throw new Error('Google API key not configured. Please add GOOGLE_API_KEY to your environment variables.');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\n${userPrompt}`
                }]
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

    const data = await response.json() as any;
    return data.candidates[0].content.parts[0].text;
}
