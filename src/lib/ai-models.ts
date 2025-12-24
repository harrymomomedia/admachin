// ============================================
// CENTRALIZED AI MODEL CONFIGURATION
// Single source of truth for all AI model info
// ============================================
//
// IMPORTANT: This file is the ONLY place where AI model IDs should be defined.
// All other files (server/routes/ai.ts, ai-service.ts, etc.) must import from here.
//
// ## How to Update Models
// 1. Check Anthropic docs: https://platform.claude.com/docs/en/about-claude/models
// 2. Or list via API: GET https://api.anthropic.com/v1/models (requires x-api-key header)
// 3. Update the apiModelId values below
// 4. Restart the server - changes propagate automatically
//
// ## Model ID Format (Anthropic)
// Pattern: claude-{tier}-{version}-{date}
// - Tier: haiku (fast/cheap), sonnet (balanced), opus (powerful/expensive)
// - Version: 4-5 = Claude 4.5 family
// - Date: YYYYMMDD snapshot date (ensures consistent behavior)
//
// ## Common Mistakes
// - NEVER use '-latest' aliases in production (they change without notice)
// - NEVER hardcode model IDs outside this file
// - NEVER guess model IDs - always verify with docs/API
//
// ## Pricing (as of Dec 2024)
// | Model | Input (per MTok) | Output (per MTok) |
// |-------|------------------|-------------------|
// | Haiku 4.5 | $1 | $5 |
// | Sonnet 4.5 | $3 | $15 |
// | Opus 4.5 | $5 | $25 |
//
// ============================================

// Model identifiers used in the app (internal IDs)
export type AIModel = 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5' | 'gpt' | 'gemini';

// Model configuration interface
export interface ModelConfig {
    id: AIModel;                                    // Internal app ID
    displayName: string;                            // UI display name
    apiModelId: string;                             // Actual API model ID to send
    provider: 'anthropic' | 'openai' | 'google';    // API provider
    description: string;                            // Short description for UI
    maxTokens: number;                              // Max output tokens
    contextWindow?: number;                         // Max context window (input)
    inputPricePerMTok?: number;                     // Price per million input tokens
    outputPricePerMTok?: number;                    // Price per million output tokens
}

// ============================================
// MODEL DEFINITIONS
// Last updated: 2024-12-24
// Source: https://platform.claude.com/docs/en/about-claude/models
// ============================================

export const AI_MODELS: Record<AIModel, ModelConfig> = {
    // Claude Sonnet 4.5 - Best balance of speed/quality/cost
    // Recommended for most use cases
    'claude-sonnet-4.5': {
        id: 'claude-sonnet-4.5',
        displayName: 'Claude Sonnet 4.5',
        apiModelId: 'claude-sonnet-4-5-20250929',   // Snapshot: Sep 29, 2025
        provider: 'anthropic',
        description: 'Fast, intelligent responses',
        maxTokens: 64000,
        contextWindow: 200000,                       // 200K standard, 1M with beta header
        inputPricePerMTok: 3,
        outputPricePerMTok: 15
    },

    // Claude Opus 4.5 - Most capable, premium pricing
    // Use for complex reasoning, analysis, creative tasks
    'claude-opus-4.5': {
        id: 'claude-opus-4.5',
        displayName: 'Claude Opus 4.5',
        apiModelId: 'claude-opus-4-5-20251101',     // Snapshot: Nov 1, 2025
        provider: 'anthropic',
        description: 'Most capable, best for complex tasks',
        maxTokens: 64000,
        contextWindow: 200000,
        inputPricePerMTok: 5,
        outputPricePerMTok: 25
    },

    // Claude Haiku 4.5 - Fastest and most economical
    // Use for high-volume, speed-critical tasks
    'claude-haiku-4.5': {
        id: 'claude-haiku-4.5',
        displayName: 'Claude Haiku 4.5',
        apiModelId: 'claude-haiku-4-5-20251001',    // Snapshot: Oct 1, 2025
        provider: 'anthropic',
        description: 'Fastest, most economical',
        maxTokens: 64000,
        contextWindow: 200000,
        inputPricePerMTok: 1,
        outputPricePerMTok: 5
    },

    // GPT-4o - OpenAI flagship
    'gpt': {
        id: 'gpt',
        displayName: 'GPT-4o',
        apiModelId: 'gpt-4o',
        provider: 'openai',
        description: 'OpenAI flagship model',
        maxTokens: 4096,
        contextWindow: 128000
    },

    // Gemini 1.5 Pro - Google flagship
    'gemini': {
        id: 'gemini',
        displayName: 'Gemini 1.5 Pro',
        apiModelId: 'gemini-1.5-pro',
        provider: 'google',
        description: 'Google flagship model',
        maxTokens: 8192,
        contextWindow: 2000000                       // 2M context window
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get full model configuration
 */
export function getModelConfig(modelId: AIModel): ModelConfig {
    return AI_MODELS[modelId];
}

/**
 * Get the API model ID to send to the provider
 * This is the most commonly used function - use it in API calls
 */
export function getApiModelId(modelId: AIModel): string {
    return AI_MODELS[modelId].apiModelId;
}

/**
 * Get display name for UI
 */
export function getDisplayName(modelId: AIModel): string {
    return AI_MODELS[modelId].displayName;
}

/**
 * Check if model is from Anthropic (Claude)
 */
export function isClaudeModel(modelId: AIModel): boolean {
    return AI_MODELS[modelId].provider === 'anthropic';
}

/**
 * Get max output tokens for a model
 */
export function getModelMaxTokens(modelId: AIModel): number {
    return AI_MODELS[modelId].maxTokens;
}

/**
 * Get provider for a model
 */
export function getProvider(modelId: AIModel): 'anthropic' | 'openai' | 'google' {
    return AI_MODELS[modelId].provider;
}

/**
 * Get all Claude model IDs
 */
export function getClaudeModels(): AIModel[] {
    return ALL_MODEL_IDS.filter(id => isClaudeModel(id));
}

// List of all model IDs for validation
export const ALL_MODEL_IDS: AIModel[] = Object.keys(AI_MODELS) as AIModel[];

// Default model for new generations
export const DEFAULT_MODEL: AIModel = 'claude-sonnet-4.5';

// ============================================
// API CONNECTION NOTES
// ============================================
//
// ## Anthropic API
// - Endpoint: https://api.anthropic.com/v1/messages
// - Auth: x-api-key header with ANTHROPIC_API_KEY
// - Version header: anthropic-version: 2023-06-01
// - Request body: { model, max_tokens, system, messages: [{ role, content }] }
//
// ## Common Errors
// - "model: not found" → Wrong apiModelId, check this file
// - "authentication_error" → Invalid/missing API key
// - "rate_limit_error" → Too many requests, implement backoff
// - "overloaded_error" → API overloaded, retry with delay
//
// ## Testing
// curl -X POST http://localhost:3001/api/ai-generate \
//   -H "Content-Type: application/json" \
//   -d '{"model":"claude-sonnet-4.5","systemPrompt":"Say hi","userPrompt":"Hello"}'
//
// ============================================
