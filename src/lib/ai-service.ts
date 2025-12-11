// AI Service for generating personas, angles, and ad copies
// Supports Claude (Anthropic), GPT (OpenAI), and Gemini (Google)

import type { Persona } from './supabase-service';

export type AIModel = 'claude-sonnet' | 'claude-opus' | 'claude-haiku' | 'gpt' | 'gemini';

interface AutoFillProductParams {
    model: AIModel;
    briefDescription: string;
}

interface AutoFillResult {
    productDescription: string;
    personaInput: string;
    swipeFiles: string;
    productCustomPrompt: string;
    suggestedProjectName?: string;
    suggestedSubprojectName?: string;
}

interface GeneratePersonasParams {
    model: AIModel;
    productDescription: string;
    personaInput?: string;
    swipeFiles?: string;
    customPrompt?: string;
}

interface GenerateAnglesParams {
    model: AIModel;
    personas: Persona[];
    productDescription: string;
    angleCount?: number; // How many angles to generate per persona
    customPrompt?: string;
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
}

// ============================================
// AUTO-FILL PRODUCT INFORMATION
// ============================================

export async function autoFillProductInfo(params: AutoFillProductParams): Promise<AutoFillResult> {
    const { model, briefDescription } = params;

    const systemPrompt = `You are an expert marketing strategist. Given a brief product/service description, expand it into detailed marketing inputs for an ad campaign.

Generate:
1. productDescription: A comprehensive 3-4 paragraph description covering:
   - What the product/service is
   - Who it's for
   - Key benefits and value proposition
   - Any relevant context or background

2. personaInput: Describe 3-5 potential customer personas/audiences who would be interested, including:
   - Their demographics (age, occupation, situation)
   - What problems they face
   - Why they'd be interested in this product/service

3. swipeFiles: Suggest 5-7 compelling headline examples that could work for this product, varying in style:
   - Question-based headlines
   - Benefit-focused headlines
   - Urgency/scarcity headlines
   - Social proof headlines

4. productCustomPrompt: Any special considerations for ad copywriting (tone, legal requirements, sensitivities, etc.)

5. suggestedProjectName: A short, clear project name (2-4 words)

6. suggestedSubprojectName: An optional subproject name if the campaign could have multiple phases/audiences

Return ONLY a valid JSON object with these exact keys, no additional text.`;

    const userPrompt = `Brief Description: ${briefDescription}

Generate comprehensive product information for an ad campaign in JSON format.`;

    try {
        let response: string;

        switch (model) {
            case 'claude-sonnet':
            case 'claude-opus':
            case 'claude-haiku':
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

        const result = JSON.parse(cleanedResponse);
        return result;
    } catch (error) {
        console.error('Error auto-filling product info:', error);
        throw new Error(`Failed to auto-fill with ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ============================================
// PERSONA GENERATION
// ============================================

export async function generatePersonas(params: GeneratePersonasParams): Promise<Persona[]> {
    const { model, productDescription, personaInput, swipeFiles, customPrompt } = params;

    const systemPrompt = `You are an expert marketing strategist and audience analyst. Your task is to generate detailed customer personas based on the product/service description provided.

Generate 3-5 diverse, realistic personas that would be interested in this product/service. For each persona, provide:
- name: First name only
- age: Realistic age
- role: Their role/occupation/situation
- tagline: A compelling one-line description of their situation
- background: 2-3 sentences about their history and context
- current_situation: Current circumstances and relationship to the product/service
- pain_points: Array of 3-5 specific pain points they're experiencing
- goals: Array of 3-5 concrete goals they want to achieve
- motivations: Array of 3-5 key motivators (short phrases)
- objections: Array of 3-5 potential objections or concerns
- messaging_angles: Array of 3-5 suggested messaging approaches specifically for this persona

Return ONLY a valid JSON array of personas, no additional text.`;

    const userPrompt = `Product/Service: ${productDescription}

${personaInput ? `Additional Persona Context: ${personaInput}\n` : ''}
${swipeFiles ? `Reference Headlines/Content: ${swipeFiles}\n` : ''}
${customPrompt ? `Custom Instructions: ${customPrompt}\n` : ''}

Generate detailed customer personas in JSON format.`;

    try {
        let response: string;

        switch (model) {
            case 'claude-sonnet':
            case 'claude-opus':
            case 'claude-haiku':
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
        return personas.map((p: any, idx: number) => ({
            ...p,
            id: `${Date.now()}-${idx}`,
            selected: false
        }));
    } catch (error) {
        console.error('Error generating personas:', error);
        throw new Error(`Failed to generate personas with ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ============================================
// ANGLE GENERATION
// ============================================

export async function generateAngles(params: GenerateAnglesParams) {
    const { model, personas, productDescription, angleCount = 3, customPrompt } = params;

    const systemPrompt = `You are an expert copywriter and marketing strategist. Your task is to generate compelling marketing angles tailored to specific customer personas.

For each persona provided, generate ${angleCount} unique marketing angles. Each angle should include:
- angle: The main hook/angle (15-25 words)
- pain_point: The specific pain point this addresses
- why_now: Why this matters right now / urgency factor

Return ONLY a valid JSON array, no additional text.`;

    const personasSummary = personas.map(p =>
        `Name: ${p.name}, ${p.age}, ${p.role}\nSituation: ${p.current_situation}\nPain Points: ${p.pain_points.join(', ')}\nGoals: ${p.goals.join(', ')}`
    ).join('\n\n');

    const userPrompt = `Product/Service: ${productDescription}

Target Personas:
${personasSummary}

${customPrompt ? `Custom Instructions: ${customPrompt}\n` : ''}

Generate ${angleCount} compelling marketing angles for EACH persona. Return as JSON array with format:
[{ "persona_id": "id", "persona_name": "name", "angle": "...", "pain_point": "...", "why_now": "..." }]`;

    try {
        let response: string;

        switch (model) {
            case 'claude-sonnet':
            case 'claude-opus':
            case 'claude-haiku':
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
        return angles.map((a: any, idx: number) => ({
            ...a,
            id: `${Date.now()}-${idx}`,
            persona_id: personas.find(p => p.name === a.persona_name)?.id || a.persona_id,
            selected: false
        }));
    } catch (error) {
        console.error('Error generating angles:', error);
        throw new Error(`Failed to generate angles with ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ============================================
// AD COPY GENERATION
// ============================================

export async function generateAdCopies(params: GenerateAdCopiesParams) {
    const { model, angles, productDescription, count, adCopyType = 'FB Ad Text', customPrompt } = params;

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

    const systemPrompt = `You are an expert ad copywriter. Your task is to write compelling ${adCopyType} based on specific marketing angles.

${typeInstructions[adCopyType]}

Return ONLY a valid JSON array, no additional text.`;

    const anglesSummary = angles.map(a =>
        `Angle: ${a.angle}\nPersona: ${a.persona_name}\nPain Point: ${a.pain_point}\nWhy Now: ${a.why_now}`
    ).join('\n\n---\n\n');

    const userPrompt = `Product/Service: ${productDescription}

Marketing Angles to write for:
${anglesSummary}

${customPrompt ? `Custom Instructions: ${customPrompt}\n` : ''}

Generate ${count} ad copy variations. Use different angles from the list above. Return as JSON array with format:
[{ "copy": "...", "angle_id": "id", "angle_name": "..." }]`;

    try {
        let response: string;

        switch (model) {
            case 'claude-sonnet':
            case 'claude-opus':
            case 'claude-haiku':
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
        return adCopies.map((ac: any, idx: number) => ({
            id: `${Date.now()}-${idx}`,
            copy: ac.copy,
            angle_ids: [angles.find(a => a.angle === ac.angle_name)?.id || ac.angle_id],
            angle_names: [ac.angle_name],
            selected: false
        }));
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
    const apiUrl = import.meta.env.DEV
        ? 'http://localhost:5174/api/ai-generate'  // Local development
        : '/api/ai-generate';  // Production (Vercel)

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

async function callClaude(model: 'claude-sonnet' | 'claude-opus' | 'claude-haiku', systemPrompt: string, userPrompt: string): Promise<string> {
    return callAIProxy(model, systemPrompt, userPrompt);
}

async function callGPT(systemPrompt: string, userPrompt: string): Promise<string> {
    return callAIProxy('gpt', systemPrompt, userPrompt);
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    return callAIProxy('gemini', systemPrompt, userPrompt);
}
