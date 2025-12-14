/**
 * AI API Client
 * Frontend service for calling AI generation endpoints
 */

import type {
    AIProvider,
    AIGenerateRequest,
    AIGenerateResponse,
    AIProvidersResponse,
    AdCopyGenerationRequest,
    GeneratedAngle,
    GeneratedAdVariation
} from './types';

const API_BASE = '/api/ai';

/**
 * Get available AI providers (ones with configured API keys)
 */
export async function getAvailableProviders(): Promise<AIProvidersResponse> {
    try {
        const response = await fetch(`${API_BASE}/generate`);
        if (!response.ok) {
            throw new Error(`Failed to fetch providers: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('[AI API] Failed to get providers:', error);
        return { availableProviders: [], defaultProvider: null };
    }
}

/**
 * Generate content using specified AI provider
 */
export async function generateContent(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    try {
        const response = await fetch(`${API_BASE}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        const result = await response.json();
        return result;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error',
            provider: request.provider,
            model: 'unknown',
        };
    }
}

/**
 * Generate marketing angles for ad copy
 */
export async function generateAngles(
    provider: AIProvider,
    request: AdCopyGenerationRequest
): Promise<{ success: boolean; angles?: GeneratedAngle[]; error?: string }> {
    const systemPrompt = `You are an expert marketing strategist specializing in sensitive legal advertising. 
Your task is to generate persuasive but dignified advertising angles for the given personas.
Always maintain a respectful, non-sensationalized tone.
Return your response as valid JSON only, no markdown or other formatting.`;

    const userPrompt = `Generate marketing angles for the following campaign:

Campaign Context: ${request.campaignContext}
Urgency Trigger Type: ${request.triggerType}
Trigger Details: ${request.triggerContext}

Target Personas:
${request.personas.map(p => `- ${p.name} (${p.role}): ${p.summary}`).join('\n')}

For each persona, generate an angle with the following structure:
{
  "angles": [
    {
      "id": "auto-generated-uuid",
      "personaId": "[persona id]",
      "hook": "[A compelling, dignified hook that resonates with this persona]",
      "pain": "[The core pain point being addressed]",
      "whyNow": "[Urgency factor - why they should act now]"
    }
  ]
}

Generate one angle per persona. Return only valid JSON.`;

    const response = await generateContent({
        provider,
        systemPrompt,
        userPrompt,
        options: { temperature: 0.7, maxTokens: 1500 },
    });

    if (!response.success || !response.content) {
        return { success: false, error: response.error || 'No content generated' };
    }

    try {
        // Try to parse the JSON response
        let content = response.content.trim();

        // Remove markdown code blocks if present
        if (content.startsWith('```')) {
            content = content.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }

        const parsed = JSON.parse(content);
        const angles: GeneratedAngle[] = parsed.angles.map((angle: GeneratedAngle, index: number) => ({
            ...angle,
            id: angle.id || `angle-${Date.now()}-${index}`,
        }));

        return { success: true, angles };
    } catch (parseError) {
        console.error('[AI API] Failed to parse angles response:', parseError);
        return { success: false, error: 'Failed to parse AI response as JSON' };
    }
}

/**
 * Generate ad copy variations for a selected angle
 */
export async function generateAdVariations(
    provider: AIProvider,
    angle: GeneratedAngle,
    personaName: string,
    campaignContext: string
): Promise<{ success: boolean; variations?: GeneratedAdVariation[]; error?: string }> {
    const systemPrompt = `You are an expert ad copywriter specializing in sensitive legal advertising.
Generate multiple ad copy variations that are dignified, non-sensationalized, and compliant.
Always include a call-to-action that emphasizes privacy and free consultation.
Return your response as valid JSON only, no markdown or other formatting.`;

    const userPrompt = `Generate ad copy variations for the following angle:

Campaign: ${campaignContext}
Persona: ${personaName}
Hook: ${angle.hook}
Pain Point: ${angle.pain}
Urgency: ${angle.whyNow}

Generate variations in this exact JSON format:
{
  "variations": [
    {
      "id": "v1",
      "label": "Short (Facebook Primary Text)",
      "text": "[Under 150 characters, punchy and direct]",
      "limit": 150
    },
    {
      "id": "v2", 
      "label": "Medium (2-3 Sentences)",
      "text": "[2-3 sentences that expand on the hook and CTA]"
    },
    {
      "id": "v3",
      "label": "Long (Full Facebook Ad)",
      "text": "Headline: [Compelling headline]\\n\\nBody Text: [3-4 sentences with emotional connection and details]\\n\\nCTA: [Call to action]"
    }
  ]
}

Return only valid JSON.`;

    const response = await generateContent({
        provider,
        systemPrompt,
        userPrompt,
        options: { temperature: 0.7, maxTokens: 1500 },
    });

    if (!response.success || !response.content) {
        return { success: false, error: response.error || 'No content generated' };
    }

    try {
        let content = response.content.trim();
        if (content.startsWith('```')) {
            content = content.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }

        const parsed = JSON.parse(content);
        return { success: true, variations: parsed.variations };
    } catch (parseError) {
        console.error('[AI API] Failed to parse variations response:', parseError);
        return { success: false, error: 'Failed to parse AI response as JSON' };
    }
}
