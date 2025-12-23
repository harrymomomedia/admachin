// AI Service for generating personas, angles, and ad copies
// Supports Claude (Anthropic), GPT (OpenAI), and Gemini (Google)

import type { Persona } from './supabase-service';

export type AIModel = 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5' | 'gpt' | 'gemini';

export interface PromptData {
    system: string;
    user: string;
}

interface AutoFillProductParams {
    model: AIModel;
    briefDescription: string;
    maxWordsPerSection?: number; // Default: 100
}

interface AutoFillResult {
    productDescription: string;
    personaInput: string;
    swipeFiles: string;
    productCustomPrompt: string;
    suggestedProjectName?: string;
    suggestedSubprojectName?: string;
}

// History round for iterative refinement
interface HistoryRound {
    round: number;
    personas: Array<{ name: string; description: string }>;
    feedback: string;
}

interface GeneratePersonasParams {
    model: AIModel;
    productDescription: string;
    personaInput?: string;
    swipeFiles?: string;
    customPrompt?: string;
    personaCount?: number; // How many personas to generate
    // Marketing context fields
    keyQualifyingCriteria?: string;
    offerFlow?: string;
    proofPoints?: string;
    primaryObjections?: string;
    // Iterative refinement
    history?: HistoryRound[];
    currentFeedback?: string;
}

// Result type that includes prompts for debugging/viewing
export interface GenerationResult<T> {
    data: T;
    systemPrompt: string;
    userPrompt: string;
    model: AIModel;
}

interface GenerateAnglesParams {
    model: AIModel;
    personas: Persona[];
    productDescription: string;
    angleCount?: number; // How many angles to generate per persona
    customPrompt?: string;
    // Marketing context fields
    keyQualifyingCriteria?: string;
    offerFlow?: string;
    proofPoints?: string;
    primaryObjections?: string;
}

interface GenerateAdCopiesParams {
    model: AIModel;
    angles: Array<{
        id: string;
        angle: string;
        persona_name: string;
        pain_point: string;
        why_now: string;
    }>;
    productDescription: string;
    count: number;
    adCopyType?: 'FB Ad Text' | 'FB Ad Headline' | 'Video Transcript (Only Voice)' | 'Video Ad Script';
    customPrompt?: string;
    // Marketing context fields
    keyQualifyingCriteria?: string;
    offerFlow?: string;
    proofPoints?: string;
    primaryObjections?: string;
}

// ============================================
// AUTO-FILL PRODUCT INFORMATION
// ============================================

export async function autoFillProductInfo(params: AutoFillProductParams): Promise<AutoFillResult> {
    const { model, briefDescription, maxWordsPerSection = 100 } = params;

    console.log('[AI Auto-Fill] Starting auto-fill with:', { model, briefDescriptionLength: briefDescription.length, maxWordsPerSection });

    const systemPrompt = `You are an expert marketing strategist. Given a brief product/service description, expand it into concise marketing inputs for an ad campaign.

IMPORTANT: Each field must be approximately ${maxWordsPerSection} WORDS. Keep responses focused and concise.

Generate:
1. productDescription (~${maxWordsPerSection} words): What the product/service is, who it's for, and key benefits.

2. personaInput (~${maxWordsPerSection} words): Brief description of 2-3 target audience types and their key characteristics.

3. swipeFiles (~${maxWordsPerSection} words): 4-5 compelling headline examples in various styles.

4. productCustomPrompt (~${maxWordsPerSection} words): Special considerations for ad copywriting (tone, legal requirements, sensitivities).

5. suggestedProjectName: A short project name (2-4 words)

6. suggestedSubprojectName: An optional subproject name (2-4 words) or empty string

Return ONLY a valid JSON object with these exact keys, no additional text.`;

    const userPrompt = `Brief Description: ${briefDescription}

Generate product information (~${maxWordsPerSection} words per field) in JSON format.`;

    try {
        let response: string;

        console.log('[AI Auto-Fill] Calling AI model:', model);
        const startTime = Date.now();

        switch (model) {
            case 'claude-sonnet-4.5':
            case 'claude-opus-4.5':
            case 'claude-haiku-4.5':
                response = await callClaude(model, systemPrompt, userPrompt);
                break;
            case 'gpt':
                response = await callGPT(systemPrompt, userPrompt);
                break;
            case 'gemini':
                response = await callGemini(systemPrompt, userPrompt);
                break;
            default:
                throw new Error(`Unsupported AI model: ${model}`);
        }

        console.log('[AI Auto-Fill] Response received in', Date.now() - startTime, 'ms');
        console.log('[AI Auto-Fill] Response length:', response.length);

        // Clean up response - remove markdown code blocks if present
        const cleanedResponse = response
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const result = JSON.parse(cleanedResponse);
        console.log('[AI Auto-Fill] Parsed successfully. Keys:', Object.keys(result));
        return result;
    } catch (error) {
        console.error('[AI Auto-Fill] Error:', error);
        throw new Error(`Failed to auto-fill with ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ============================================
// PERSONA GENERATION
// ============================================

export async function generatePersonas(params: GeneratePersonasParams): Promise<GenerationResult<Persona[]>> {
    const {
        model, productDescription, personaInput, swipeFiles, customPrompt, personaCount = 5,
        keyQualifyingCriteria, offerFlow, proofPoints, primaryObjections,
        history, currentFeedback
    } = params;

    const isRefinement = history && history.length > 0;

    const systemPrompt = isRefinement
        ? `You are an expert marketing strategist refining target audience personas based on user feedback.

Review the previous generation rounds and feedback below, then generate ${personaCount} IMPROVED personas that address the feedback.

Each persona should have:
- name: A short descriptive label (2-4 words, e.g., "Recent Survivor", "Skeptical Family Member")
- description: A single paragraph (max 100 words) describing who they are, their situation, pain points, and what motivates them to act

Apply the feedback to improve the personas. Return ONLY a valid JSON array.`
        : `You are an expert marketing strategist. Generate ${personaCount} target audience personas.

Each persona should have:
- name: A short descriptive label (2-4 words, e.g., "Recent Survivor", "Skeptical Family Member")
- description: A single paragraph (max 100 words) describing who they are, their situation, pain points, and what motivates them to act

Keep each description focused and actionable for ad copywriting. Return ONLY a valid JSON array.`;

    // Build user prompt with history context if refining
    let userPrompt = `Product/Service: ${productDescription}

${personaInput ? `Target Audience Info: ${personaInput}\n` : ''}
${keyQualifyingCriteria ? `Key Qualifying Criteria: ${keyQualifyingCriteria}\n` : ''}
${offerFlow ? `Offer Flow: ${offerFlow}\n` : ''}
${proofPoints ? `Proof Points: ${proofPoints}\n` : ''}
${primaryObjections ? `Primary Objections to Address: ${primaryObjections}\n` : ''}
${swipeFiles ? `Reference Content/Winner Ads: ${swipeFiles}\n` : ''}
${customPrompt ? `Instructions: ${customPrompt}\n` : ''}`;

    if (isRefinement && history) {
        userPrompt += `\n--- PREVIOUS GENERATIONS & FEEDBACK ---\n`;
        for (const round of history) {
            userPrompt += `\nRound ${round.round} Output:\n`;
            userPrompt += round.personas.map(p => `• ${p.name}: ${p.description}`).join('\n');
            if (round.feedback) {
                userPrompt += `\n\nFeedback after Round ${round.round}: "${round.feedback}"\n`;
            }
        }
        if (currentFeedback) {
            userPrompt += `\n--- CURRENT FEEDBACK TO ADDRESS ---\n"${currentFeedback}"\n`;
        }
        userPrompt += `\nGenerate ${personaCount} IMPROVED personas as JSON array with "name" and "description" fields, addressing all feedback above.`;
    } else {
        userPrompt += `Generate ${personaCount} personas as JSON array with "name" and "description" fields only.`;
    }

    try {
        let response: string;

        switch (model) {
            case 'claude-sonnet-4.5':
            case 'claude-opus-4.5':
            case 'claude-haiku-4.5':
                response = await callClaude(model, systemPrompt, userPrompt);
                break;
            case 'gpt':
                response = await callGPT(systemPrompt, userPrompt);
                break;
            case 'gemini':
                response = await callGemini(systemPrompt, userPrompt);
                break;
            default:
                throw new Error(`Unsupported AI model: ${model}`);
        }

        // Clean up response - remove markdown code blocks if present
        const cleanedResponse = response
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        // Parse and validate the response
        const personas = JSON.parse(cleanedResponse);

        // Add IDs and selected flag
        const data = personas.map((p: any, idx: number) => ({
            ...p,
            id: `${Date.now()}-${idx}`,
            selected: false
        }));

        return { data, systemPrompt, userPrompt, model };
    } catch (error) {
        console.error('Error generating personas:', error);
        throw new Error(`Failed to generate personas with ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ============================================
// ANGLE GENERATION
// ============================================

export async function generateAngles(params: GenerateAnglesParams): Promise<GenerationResult<any[]>> {
    const {
        model, personas, productDescription, angleCount = 3, customPrompt,
        keyQualifyingCriteria, offerFlow, proofPoints, primaryObjections
    } = params;

    const hasPersonas = personas && personas.length > 0;
    const personaCount = hasPersonas ? personas.length : 0;

    // Build marketing context section
    const marketingContext = [
        keyQualifyingCriteria ? `Key Qualifying Criteria: ${keyQualifyingCriteria}` : '',
        offerFlow ? `Offer Flow: ${offerFlow}` : '',
        proofPoints ? `Proof Points: ${proofPoints}` : '',
        primaryObjections ? `Primary Objections to Address: ${primaryObjections}` : '',
    ].filter(Boolean).join('\n');

    // Different prompts based on whether personas are provided
    let systemPrompt: string;
    let userPrompt: string;

    if (hasPersonas) {
        // With personas: distribute angles across personas
        const distributionNote = personaCount > 1
            ? `Distribute the ${angleCount} total angles randomly across the ${personaCount} personas. Not all personas need the same number of angles - vary the distribution naturally based on which personas have the strongest angle opportunities.`
            : `Generate all ${angleCount} angles for this single persona.`;

        systemPrompt = `You are an expert copywriter and marketing strategist. Your task is to generate compelling marketing angles tailored to specific customer personas.

Generate exactly ${angleCount} TOTAL unique marketing angles. ${distributionNote}

Each angle should include:
- angle: The main hook/angle (15-25 words)
- pain_point: The specific pain point this addresses
- why_now: Why this matters right now / urgency factor
- persona_id: The ID of the persona this angle is for
- persona_name: The name of the persona
${customPrompt ? `\n**IMPORTANT CUSTOM INSTRUCTIONS (YOU MUST FOLLOW THESE):**\n${customPrompt}\n` : ''}
Return ONLY a valid JSON array, no additional text.`;

        const personasSummary = personas.map(p =>
            `ID: ${p.id}, Name: ${p.name}\n${p.description}`
        ).join('\n\n');

        userPrompt = `Product/Service: ${productDescription}

${marketingContext ? `${marketingContext}\n\n` : ''}Target Personas:
${personasSummary}

${customPrompt ? `Custom Instructions: ${customPrompt}\n` : ''}

Generate exactly ${angleCount} TOTAL marketing angles distributed across these personas. Return as JSON array with format:
[{ "persona_id": "id", "persona_name": "name", "angle": "...", "pain_point": "...", "why_now": "..." }]`;
    } else {
        // Without personas: generate general angles from product description
        systemPrompt = `You are an expert copywriter and marketing strategist. Your task is to generate compelling marketing angles based on the product/service description.

Generate exactly ${angleCount} unique marketing angles that highlight different aspects, benefits, or use cases of the product.

Each angle should include:
- angle: The main hook/angle (15-25 words)
- pain_point: The specific pain point or need this addresses
- why_now: Why this matters right now / urgency factor
- persona_id: Use "general" for all angles
- persona_name: Use "General Audience" for all angles
${customPrompt ? `\n**IMPORTANT CUSTOM INSTRUCTIONS (YOU MUST FOLLOW THESE):**\n${customPrompt}\n` : ''}
Return ONLY a valid JSON array, no additional text.`;

        userPrompt = `Product/Service: ${productDescription}

${marketingContext ? `${marketingContext}\n\n` : ''}${customPrompt ? `Custom Instructions: ${customPrompt}\n` : ''}

Generate exactly ${angleCount} marketing angles based on the product description. Return as JSON array with format:
[{ "persona_id": "general", "persona_name": "General Audience", "angle": "...", "pain_point": "...", "why_now": "..." }]`;
    }

    try {
        let response: string;

        switch (model) {
            case 'claude-sonnet-4.5':
            case 'claude-opus-4.5':
            case 'claude-haiku-4.5':
                response = await callClaude(model, systemPrompt, userPrompt);
                break;
            case 'gpt':
                response = await callGPT(systemPrompt, userPrompt);
                break;
            case 'gemini':
                response = await callGemini(systemPrompt, userPrompt);
                break;
            default:
                throw new Error(`Unsupported AI model: ${model}`);
        }

        // Clean up response - remove markdown code blocks if present
        const cleanedResponse = response
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const angles = JSON.parse(cleanedResponse);

        // Add IDs and selected flag, map persona IDs
        const data = angles.map((a: any, idx: number) => ({
            ...a,
            id: `${Date.now()}-${idx}`,
            persona_id: personas.find(p => p.name === a.persona_name || p.id === a.persona_id)?.id || a.persona_id,
            selected: false
        }));

        return { data, systemPrompt, userPrompt, model };
    } catch (error) {
        console.error('Error generating angles:', error);
        throw new Error(`Failed to generate angles with ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ============================================
// AD COPY GENERATION
// ============================================

export async function generateAdCopies(params: GenerateAdCopiesParams): Promise<GenerationResult<any[]>> {
    const {
        model, angles, productDescription, count, adCopyType = 'FB Ad Text', customPrompt,
        keyQualifyingCriteria, offerFlow, proofPoints, primaryObjections
    } = params;

    const hasAngles = angles && angles.length > 0;

    // Build marketing context section
    const marketingContext = [
        keyQualifyingCriteria ? `Key Qualifying Criteria: ${keyQualifyingCriteria}` : '',
        offerFlow ? `Offer Flow: ${offerFlow}` : '',
        proofPoints ? `Proof Points: ${proofPoints}` : '',
        primaryObjections ? `Primary Objections to Address: ${primaryObjections}` : '',
    ].filter(Boolean).join('\n');

    // Customize instructions based on ad copy type
    const typeInstructions: Record<typeof adCopyType, string> = {
        'FB Ad Text': `Write ad copy that:
- Is attention-grabbing and scroll-stopping
- Addresses the specific angle and pain point
- Creates urgency and desire
- Includes a clear call-to-action
- Is 100-150 words (Facebook optimal length)
- Uses conversational, persuasive language`,
        'FB Ad Headline': `Write ad headlines that:
- Are punchy and attention-grabbing
- Clearly communicate the main benefit or hook
- Create curiosity or urgency
- Are 5-10 words maximum
- Use power words and emotional triggers`,
        'Video Transcript (Only Voice)': `Write video voiceover scripts that:
- Are conversational and natural-sounding
- Hook attention in the first 3 seconds
- Address the pain point and solution clearly
- Build emotional connection
- Are 30-60 seconds when read aloud
- Include natural pauses and emphasis
- NO visual cues or stage directions`,
        'Video Ad Script': `Write complete video ad scripts that:
- Include both voiceover (VO) and visual directions
- Hook attention in the first 3 seconds
- Show the problem, agitate, then present the solution
- Are 30-60 seconds total length
- Include specific shot descriptions
- Format: [VISUAL] description, VO: "dialogue"`
    };

    let systemPrompt: string;
    let userPrompt: string;

    if (hasAngles) {
        // With angles: write ad copy based on specific angles
        systemPrompt = `You are an expert ad copywriter. Your task is to write compelling ${adCopyType} based on specific marketing angles.

${typeInstructions[adCopyType]}

Return ONLY a valid JSON array, no additional text.`;

        const anglesSummary = angles.map(a =>
            `Angle: ${a.angle}\nPersona: ${a.persona_name}\nPain Point: ${a.pain_point}\nWhy Now: ${a.why_now}`
        ).join('\n\n---\n\n');

        userPrompt = `Product/Service: ${productDescription}

${marketingContext ? `${marketingContext}\n\n` : ''}Marketing Angles to write for:
${anglesSummary}

${customPrompt ? `Custom Instructions: ${customPrompt}\n` : ''}

Generate ${count} ad copy variations. Use different angles from the list above. Return as JSON array with format:
[{ "copy": "...", "angle_id": "id", "angle_name": "..." }]`;
    } else {
        // Without angles: generate ad copy directly from product description
        systemPrompt = `You are an expert ad copywriter. Your task is to write compelling ${adCopyType} based on the product/service description.

${typeInstructions[adCopyType]}

Create ads that highlight different benefits, features, and use cases of the product.

Return ONLY a valid JSON array, no additional text.`;

        userPrompt = `Product/Service: ${productDescription}

${marketingContext ? `${marketingContext}\n\n` : ''}${customPrompt ? `Custom Instructions: ${customPrompt}\n` : ''}

Generate ${count} ad copy variations highlighting different aspects of the product. Return as JSON array with format:
[{ "copy": "...", "angle_id": "direct", "angle_name": "Direct from Product" }]`;
    }

    try {
        let response: string;

        switch (model) {
            case 'claude-sonnet-4.5':
            case 'claude-opus-4.5':
            case 'claude-haiku-4.5':
                response = await callClaude(model, systemPrompt, userPrompt);
                break;
            case 'gpt':
                response = await callGPT(systemPrompt, userPrompt);
                break;
            case 'gemini':
                response = await callGemini(systemPrompt, userPrompt);
                break;
            default:
                throw new Error(`Unsupported AI model: ${model}`);
        }

        // Clean up response - remove markdown code blocks if present
        const cleanedResponse = response
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const adCopies = JSON.parse(cleanedResponse);

        // Add IDs and selected flag, map angle IDs
        const data = adCopies.map((ac: any, idx: number) => ({
            id: `${Date.now()}-${idx}`,
            copy: ac.copy,
            angle_ids: [angles.find(a => a.angle === ac.angle_name)?.id || ac.angle_id],
            angle_names: [ac.angle_name],
            selected: false
        }));

        return { data, systemPrompt, userPrompt, model };
    } catch (error) {
        console.error('Error generating ad copies:', error);
        throw new Error(`Failed to generate ad copies with ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ============================================
// AI PROVIDER IMPLEMENTATIONS
// ============================================

// Use serverless function proxy to avoid CORS issues
async function callAIProxy(model: AIModel, systemPrompt: string, userPrompt: string): Promise<string> {
    // Use relative URL - Vite middleware proxies /api routes in dev, Vercel handles in prod
    const apiUrl = '/api/ai-generate';

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            systemPrompt,
            userPrompt
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI API request failed');
    }

    const data = await response.json();
    return data.response;
}

async function callClaude(model: 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5', systemPrompt: string, userPrompt: string): Promise<string> {
    return callAIProxy(model, systemPrompt, userPrompt);
}

async function callGPT(systemPrompt: string, userPrompt: string): Promise<string> {
    return callAIProxy('gpt', systemPrompt, userPrompt);
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    return callAIProxy('gemini', systemPrompt, userPrompt);
}
