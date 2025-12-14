/**
 * AI Service Types
 * Shared types for AI functionality across the application
 */

export type AIProvider = 'openai' | 'gemini' | 'claude';

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

export interface AIProvidersResponse {
    availableProviders: AIProvider[];
    defaultProvider: AIProvider | null;
}

// Ad Copy specific types
export interface GeneratedAngle {
    id: string;
    personaId: string;
    hook: string;
    pain: string;
    whyNow: string;
}

export interface GeneratedAdVariation {
    id: string;
    label: string;
    text: string;
    limit?: number;
}

export interface AdCopyGenerationRequest {
    personas: {
        id: string;
        name: string;
        role: string;
        summary: string;
    }[];
    triggerType: string;
    triggerContext: string;
    campaignContext: string;
}

// Provider display info
export const PROVIDER_INFO: Record<AIProvider, { name: string; icon: string; color: string }> = {
    openai: { name: 'OpenAI', icon: '🤖', color: '#10a37f' },
    gemini: { name: 'Gemini', icon: '✨', color: '#4285f4' },
    claude: { name: 'Claude', icon: '🧠', color: '#d97706' },
};
