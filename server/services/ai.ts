/**
 * Unified AI Service
 * Provides a single interface to call OpenAI, Gemini, and Claude models
 */

export type AIProvider = 'openai' | 'gemini' | 'claude';

export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIGenerateOptions {
    temperature?: number;
    maxTokens?: number;
    model?: string;
}

export interface AIGenerateRequest {
    provider: AIProvider;
    systemPrompt?: string;
    userPrompt: string;
    options?: AIGenerateOptions;
}

export interface AIGenerateResponse {
    success: boolean;
    content?: string;
    error?: string;
    provider: AIProvider;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// Default models for each provider
const DEFAULT_MODELS: Record<AIProvider, string> = {
    openai: 'gpt-4o',
    gemini: 'gemini-1.5-flash',
    claude: 'claude-3-5-sonnet-20241022',
};

/**
 * Generate content using OpenAI API
 */
async function generateWithOpenAI(
    systemPrompt: string,
    userPrompt: string,
    options: AIGenerateOptions
): Promise<AIGenerateResponse> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: 'OpenAI API key not configured (OPENAI_API_KEY)',
            provider: 'openai',
            model: options.model || DEFAULT_MODELS.openai,
        };
    }

    const model = options.model || DEFAULT_MODELS.openai;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens ?? 2000,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return {
                success: false,
                error: error.error?.message || `OpenAI API error: ${response.status}`,
                provider: 'openai',
                model,
            };
        }

        const data = await response.json();
        return {
            success: true,
            content: data.choices[0]?.message?.content || '',
            provider: 'openai',
            model,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
        };
    } catch (error) {
        return {
            success: false,
            error: `OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            provider: 'openai',
            model,
        };
    }
}

/**
 * Generate content using Google Gemini API
 */
async function generateWithGemini(
    systemPrompt: string,
    userPrompt: string,
    options: AIGenerateOptions
): Promise<AIGenerateResponse> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: 'Gemini API key not configured (GEMINI_API_KEY)',
            provider: 'gemini',
            model: options.model || DEFAULT_MODELS.gemini,
        };
    }

    const model = options.model || DEFAULT_MODELS.gemini;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: systemPrompt }],
                    },
                    contents: [{
                        parts: [{ text: userPrompt }],
                    }],
                    generationConfig: {
                        temperature: options.temperature ?? 0.7,
                        maxOutputTokens: options.maxTokens ?? 2000,
                    },
                }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            return {
                success: false,
                error: error.error?.message || `Gemini API error: ${response.status}`,
                provider: 'gemini',
                model,
            };
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            success: true,
            content,
            provider: 'gemini',
            model,
            usage: data.usageMetadata ? {
                promptTokens: data.usageMetadata.promptTokenCount || 0,
                completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount || 0,
            } : undefined,
        };
    } catch (error) {
        return {
            success: false,
            error: `Gemini request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            provider: 'gemini',
            model,
        };
    }
}

/**
 * Generate content using Anthropic Claude API
 */
async function generateWithClaude(
    systemPrompt: string,
    userPrompt: string,
    options: AIGenerateOptions
): Promise<AIGenerateResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: 'Claude API key not configured (ANTHROPIC_API_KEY)',
            provider: 'claude',
            model: options.model || DEFAULT_MODELS.claude,
        };
    }

    const model = options.model || DEFAULT_MODELS.claude;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                max_tokens: options.maxTokens ?? 2000,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt },
                ],
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return {
                success: false,
                error: error.error?.message || `Claude API error: ${response.status}`,
                provider: 'claude',
                model,
            };
        }

        const data = await response.json();
        const content = data.content?.[0]?.text || '';

        return {
            success: true,
            content,
            provider: 'claude',
            model,
            usage: data.usage ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            } : undefined,
        };
    } catch (error) {
        return {
            success: false,
            error: `Claude request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            provider: 'claude',
            model,
        };
    }
}

/**
 * Main entry point: generate content using the specified AI provider
 */
export async function generateContent(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const systemPrompt = request.systemPrompt || 'You are a helpful AI assistant.';
    const options = request.options || {};

    switch (request.provider) {
        case 'openai':
            return generateWithOpenAI(systemPrompt, request.userPrompt, options);
        case 'gemini':
            return generateWithGemini(systemPrompt, request.userPrompt, options);
        case 'claude':
            return generateWithClaude(systemPrompt, request.userPrompt, options);
        default:
            return {
                success: false,
                error: `Unknown provider: ${request.provider}`,
                provider: request.provider,
                model: 'unknown',
            };
    }
}

/**
 * Check which providers have API keys configured
 */
export function getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];

    if (process.env.OPENAI_API_KEY) providers.push('openai');
    if (process.env.GEMINI_API_KEY) providers.push('gemini');
    if (process.env.ANTHROPIC_API_KEY) providers.push('claude');

    return providers;
}

export { DEFAULT_MODELS };
