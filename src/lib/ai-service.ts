// AI Service for generating personas, angles, and ad copies
// Supports Claude (Anthropic), GPT (OpenAI), and Gemini (Google)

import type { Persona } from './supabase-service';

export type AIModel = 'claude' | 'gpt' | 'gemini';

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
    customPrompt?: string;
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
            case 'claude':
                response = await callClaude(systemPrompt, userPrompt);
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

        // Parse and validate the response
        const personas = JSON.parse(response);

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
    const { model, personas, productDescription, customPrompt } = params;

    const systemPrompt = `You are an expert copywriter and marketing strategist. Your task is to generate compelling marketing angles tailored to specific customer personas.

For each persona provided, generate 2-3 unique marketing angles. Each angle should include:
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

Generate 2-3 compelling marketing angles for EACH persona. Return as JSON array with format:
[{ "persona_id": "id", "persona_name": "name", "angle": "...", "pain_point": "...", "why_now": "..." }]`;

    try {
        let response: string;

        switch (model) {
            case 'claude':
                response = await callClaude(systemPrompt, userPrompt);
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

        const angles = JSON.parse(response);

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
    const { model, angles, productDescription, count, customPrompt } = params;

    const systemPrompt = `You are an expert Facebook ad copywriter. Your task is to write compelling primary text for Facebook ads based on specific marketing angles.

Write ad copy that:
- Is attention-grabbing and scroll-stopping
- Addresses the specific angle and pain point
- Creates urgency and desire
- Includes a clear call-to-action
- Is 100-150 words (Facebook optimal length)
- Uses conversational, persuasive language

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
            case 'claude':
                response = await callClaude(systemPrompt, userPrompt);
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

        const adCopies = JSON.parse(response);

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

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
        throw new Error('Anthropic API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
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

    const data = await response.json();
    return data.content[0].text;
}

async function callGPT(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file');
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

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

    if (!apiKey) {
        throw new Error('Google API key not configured. Please add VITE_GOOGLE_API_KEY to your .env file');
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

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}
