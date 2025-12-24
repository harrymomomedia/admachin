// AI Service for generating personas, angles, and ad copies
// Supports Claude (Anthropic), GPT (OpenAI), and Gemini (Google)

import type { Persona } from './supabase-service';
// Import AIModel type from centralized config - single source of truth
import type { AIModel } from './ai-models';

// Re-export AIModel for consumers of this module
export type { AIModel };

export interface PromptData {
    system: string;
    user: string;
}

// History round for Auto-Fill iterative refinement
interface AutoFillHistoryRound {
    round: number;
    output: {
        productDescription: string;
        personaInput: string;
        keyQualifyingCriteria?: string;
        offerFlow?: string;
        proofPoints?: string;
        primaryObjections?: string;
        swipeFiles: string;
        // customPrompt intentionally not tracked - always left empty
    };
    feedback: string;
}

// Field key type for partial refinement - exported for use in CopyWizard
export type AutoFillFieldKey =
    | 'productDescription'
    | 'personaInput'
    | 'keyQualifyingCriteria'
    | 'offerFlow'
    | 'proofPoints'
    | 'primaryObjections'
    | 'swipeFiles';
// Note: customPrompt is intentionally excluded - it's always left empty by auto-fill

interface AutoFillProductParams {
    model: AIModel;
    briefDescription: string;
    maxWordsPerSection?: number; // Default: 100
    customSystemPrompt?: string; // Optional custom system prompt
    customUserPrompt?: string; // Optional custom user prompt
    // Iterative refinement
    history?: AutoFillHistoryRound[];
    currentFeedback?: string;
    // Current content to refine (full text)
    currentContent?: {
        productDescription: string;
        personaInput: string;
        keyQualifyingCriteria: string;
        offerFlow: string;
        proofPoints: string;
        primaryObjections: string;
        swipeFiles: string;
    };
    // Partial field refinement - only refine these fields (empty/undefined = refine all)
    fieldsToRefine?: AutoFillFieldKey[];
}

interface AutoFillResult {
    productDescription: string;
    personaInput: string;
    keyQualifyingCriteria: string;
    offerFlow: string;
    proofPoints: string;
    primaryObjections: string;
    swipeFiles: string;
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
    const { model, briefDescription, maxWordsPerSection = 100, customSystemPrompt, customUserPrompt, history, currentFeedback, currentContent, fieldsToRefine } = params;

    // Refinement mode if we have current content AND feedback
    const isRefinement = !!(currentContent && currentFeedback);
    const hasHistory = history && history.length > 0;
    // Partial refinement mode - only refine selected fields
    const isPartialRefinement = isRefinement && fieldsToRefine && fieldsToRefine.length > 0;

    // Field display names for prompts
    const fieldDisplayNames: Record<AutoFillFieldKey, string> = {
        productDescription: 'Product/Service Description',
        personaInput: 'Target Audience',
        keyQualifyingCriteria: 'Key Qualifying Criteria',
        offerFlow: 'Offer Flow',
        proofPoints: 'Proof Points',
        primaryObjections: 'Primary Objections',
        swipeFiles: 'Swipe Files/Headlines'
    };

    // Field descriptions for prompts
    const fieldDescriptions: Record<AutoFillFieldKey, string> = {
        productDescription: 'What the product/service is, who it\'s for, and key benefits.',
        personaInput: 'Brief description of 2-3 target audience types and their key characteristics.',
        keyQualifyingCriteria: 'Specific criteria that qualify ideal customers (demographics, behaviors, pain points, budget, timeline).',
        offerFlow: 'The customer journey from awareness to purchase - what they see, click, and experience.',
        proofPoints: 'Evidence that builds trust: testimonials, case studies, statistics, awards, credentials.',
        primaryObjections: 'Common objections prospects have and brief responses to overcome them.',
        swipeFiles: '4-5 compelling headline examples in various styles (curiosity, benefit, fear, social proof).'
    };

    console.log('[AI Auto-Fill] Starting auto-fill with:', {
        model,
        briefDescriptionLength: briefDescription.length,
        maxWordsPerSection,
        hasCustomPrompts: !!(customSystemPrompt || customUserPrompt),
        isRefinement,
        isPartialRefinement,
        fieldsToRefine: fieldsToRefine || 'all',
        hasHistory,
        historyRounds: history?.length || 0
    });

    // Build system prompt - different for refinement
    let defaultSystemPrompt: string;

    // All fields to generate (in order)
    const allFields: AutoFillFieldKey[] = [
        'productDescription',
        'personaInput',
        'keyQualifyingCriteria',
        'offerFlow',
        'proofPoints',
        'primaryObjections',
        'swipeFiles'
    ];

    if (isPartialRefinement && fieldsToRefine) {
        // Partial refinement - only ask for selected fields
        const fieldInstructions = fieldsToRefine.map((field, idx) => {
            return `${idx + 1}. ${field} (~${maxWordsPerSection} words): ${fieldDescriptions[field]}`;
        }).join('\n\n');

        defaultSystemPrompt = `You are an expert marketing strategist refining SPECIFIC marketing fields based on user feedback.

IMPORTANT: You are ONLY refining these specific fields:
${fieldsToRefine.map(f => `- ${fieldDisplayNames[f]}`).join('\n')}

Do NOT include any other fields in your response. Focus ONLY on improving the selected fields based on the feedback.

Each field must be approximately ${maxWordsPerSection} WORDS. Keep responses focused and concise.

Generate improved versions of ONLY these fields:
${fieldInstructions}

Apply the feedback to improve these specific fields. Return ONLY a valid JSON object with ONLY the selected field keys, no additional text or fields.`;
    } else if (isRefinement) {
        const fieldInstructions = allFields.map((field, idx) => {
            return `${idx + 1}. ${field} (~${maxWordsPerSection} words): ${fieldDescriptions[field]}`;
        }).join('\n\n');

        defaultSystemPrompt = `You are an expert marketing strategist refining marketing inputs based on user feedback.

Review the CURRENT CONTENT and feedback below, then generate IMPROVED marketing inputs that address the feedback while preserving what works well.

IMPORTANT: Each field must be approximately ${maxWordsPerSection} WORDS. Keep responses focused and concise.

Generate improved versions of:
${fieldInstructions}

8. suggestedProjectName: A short project name (2-4 words)

9. suggestedSubprojectName: An optional subproject name (2-4 words) or empty string

Apply the feedback to improve the content. Return ONLY a valid JSON object with these exact keys, no additional text.`;
    } else {
        const fieldInstructions = allFields.map((field, idx) => {
            return `${idx + 1}. ${field} (~${maxWordsPerSection} words): ${fieldDescriptions[field]}`;
        }).join('\n\n');

        defaultSystemPrompt = `You are an expert marketing strategist. Given a brief product/service description, expand it into comprehensive marketing inputs for an ad campaign.

IMPORTANT: Each field must be approximately ${maxWordsPerSection} WORDS. Keep responses focused and concise.

Generate:
${fieldInstructions}

8. suggestedProjectName: A short project name (2-4 words)

9. suggestedSubprojectName: An optional subproject name (2-4 words) or empty string

Return ONLY a valid JSON object with these exact keys, no additional text.`;
    }

    const systemPrompt = customSystemPrompt || defaultSystemPrompt;

    // Build user prompt
    let defaultUserPrompt = `Brief Description: ${briefDescription}\n`;

    if (isRefinement && currentContent) {
        if (isPartialRefinement && fieldsToRefine) {
            // Partial refinement - only include selected fields in the prompt
            defaultUserPrompt += `\n=== CURRENT CONTENT OF SELECTED FIELDS TO REFINE ===\n`;
            for (const field of fieldsToRefine) {
                const value = currentContent[field];
                defaultUserPrompt += `\n[${fieldDisplayNames[field]}]\n${value}\n`;
            }
        } else {
            // Full refinement - include all current content
            defaultUserPrompt += `\n=== CURRENT CONTENT TO REFINE ===\n`;
            for (const field of allFields) {
                defaultUserPrompt += `\n[${fieldDisplayNames[field]}]\n${currentContent[field]}\n`;
            }
        }

        // Include history context (truncated summaries of previous rounds)
        if (hasHistory && history) {
            defaultUserPrompt += `\n=== PREVIOUS REFINEMENT HISTORY ===\n`;
            for (const round of history) {
                defaultUserPrompt += `\nRound ${round.round}:\n`;
                defaultUserPrompt += `Feedback given: "${round.feedback}"\n`;
            }
        }

        // Current feedback to apply
        defaultUserPrompt += `\n=== FEEDBACK TO ADDRESS NOW ===\n"${currentFeedback}"\n`;

        if (isPartialRefinement) {
            defaultUserPrompt += `\nGenerate IMPROVED versions of ONLY the selected fields as JSON, applying the feedback. Do NOT include other fields.`;
        } else {
            defaultUserPrompt += `\nGenerate IMPROVED marketing inputs as JSON, applying the feedback while keeping what works well.`;
        }
    } else {
        defaultUserPrompt += `\nGenerate comprehensive marketing inputs (~${maxWordsPerSection} words per field) in JSON format.`;
    }

    const userPrompt = customUserPrompt || defaultUserPrompt;

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

        const parsedResult = JSON.parse(cleanedResponse);
        console.log('[AI Auto-Fill] Parsed successfully. Keys:', Object.keys(parsedResult));

        // For partial refinement, merge AI results with unchanged fields from currentContent
        if (isPartialRefinement && currentContent && fieldsToRefine) {
            const mergedResult: AutoFillResult = {
                // Start with unchanged values from currentContent
                productDescription: currentContent.productDescription,
                personaInput: currentContent.personaInput,
                keyQualifyingCriteria: currentContent.keyQualifyingCriteria,
                offerFlow: currentContent.offerFlow,
                proofPoints: currentContent.proofPoints,
                primaryObjections: currentContent.primaryObjections,
                swipeFiles: currentContent.swipeFiles,
                // No project/subproject changes for partial refinement
            };

            // Override with refined values
            for (const field of fieldsToRefine) {
                if (parsedResult[field]) {
                    mergedResult[field] = parsedResult[field];
                }
            }

            console.log('[AI Auto-Fill] Partial refinement - merged result with unchanged fields');
            return mergedResult;
        }

        return parsedResult;
    } catch (error) {
        console.error('[AI Auto-Fill] Error:', error);
        throw new Error(`Failed to auto-fill with ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ============================================
// SINGLE FIELD REFINEMENT
// ============================================

export type CampaignFieldKey =
    | 'description'
    | 'persona_input'
    | 'key_qualifying_criteria'
    | 'offer_flow'
    | 'proof_points'
    | 'primary_objections'
    | 'swipe_files'
    | 'custom_prompt';

const FIELD_LABELS: Record<CampaignFieldKey, string> = {
    description: 'Product/Service Description',
    persona_input: 'Target Audience',
    key_qualifying_criteria: 'Key Qualifying Criteria',
    offer_flow: 'Offer Flow',
    proof_points: 'Proof Points',
    primary_objections: 'Primary Objections',
    swipe_files: 'Swipe Files/Headlines',
    custom_prompt: 'Custom Prompt'
};

const FIELD_INSTRUCTIONS: Record<CampaignFieldKey, string> = {
    description: 'A clear description of the product/service, who it\'s for, and key benefits.',
    persona_input: 'Brief description of 2-3 target audience types and their key characteristics.',
    key_qualifying_criteria: 'Specific criteria that qualify or disqualify potential customers.',
    offer_flow: 'The customer journey and offer structure.',
    proof_points: 'Evidence, testimonials, statistics that support claims.',
    primary_objections: 'Common objections and how to address them.',
    swipe_files: '4-5 compelling headline examples in various styles.',
    custom_prompt: 'Special considerations for ad copywriting (tone, legal requirements, sensitivities).'
};

interface RefineSingleFieldParams {
    model: AIModel;
    fieldKey: CampaignFieldKey;
    currentValue: string;
    feedback: string;
    // Context from other fields
    context?: {
        campaignName?: string;
        description?: string;
        personaInput?: string;
        keyQualifyingCriteria?: string;
        offerFlow?: string;
        proofPoints?: string;
        primaryObjections?: string;
        swipeFiles?: string;
        customPrompt?: string;
    };
    maxWords?: number;
}

interface RefineSingleFieldResult {
    refinedValue: string;
    fieldKey: CampaignFieldKey;
}

export async function refineSingleField(params: RefineSingleFieldParams): Promise<RefineSingleFieldResult> {
    const { model, fieldKey, currentValue, feedback, context, maxWords = 100 } = params;

    const fieldLabel = FIELD_LABELS[fieldKey];
    const fieldInstruction = FIELD_INSTRUCTIONS[fieldKey];

    const systemPrompt = `You are an expert marketing strategist. Your task is to refine a SINGLE field based on user feedback.

You are refining the "${fieldLabel}" field.
Field purpose: ${fieldInstruction}

IMPORTANT:
- Keep the output to approximately ${maxWords} words
- ONLY return the refined content for this field
- Do NOT include any labels, prefixes, or JSON formatting
- Return ONLY the plain text content for this field`;

    let userPrompt = `CURRENT "${fieldLabel}" CONTENT:
${currentValue || '(empty)'}

USER FEEDBACK TO APPLY:
"${feedback}"
`;

    // Add context from other fields if available
    if (context) {
        userPrompt += `\nCONTEXT FROM OTHER CAMPAIGN FIELDS:`;
        if (context.campaignName) userPrompt += `\n- Campaign: ${context.campaignName}`;
        if (context.description && fieldKey !== 'description') userPrompt += `\n- Product Description: ${context.description.substring(0, 200)}...`;
        if (context.personaInput && fieldKey !== 'persona_input') userPrompt += `\n- Target Audience: ${context.personaInput.substring(0, 200)}...`;
        if (context.keyQualifyingCriteria && fieldKey !== 'key_qualifying_criteria') userPrompt += `\n- Key Criteria: ${context.keyQualifyingCriteria.substring(0, 150)}...`;
    }

    userPrompt += `\n\nRefine the "${fieldLabel}" based on the feedback above. Return ONLY the refined text content (~${maxWords} words), no formatting or labels.`;

    console.log('[AI Refine Field] Refining:', fieldKey, 'with feedback:', feedback.substring(0, 50) + '...');

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

        // Clean up the response - remove any accidental formatting
        const cleanedResponse = response
            .replace(/^["']|["']$/g, '') // Remove surrounding quotes
            .replace(/^(Product Description|Target Audience|.*?):\s*/i, '') // Remove any label prefix
            .trim();

        console.log('[AI Refine Field] Success. Response length:', cleanedResponse.length);

        return {
            refinedValue: cleanedResponse,
            fieldKey
        };
    } catch (error) {
        console.error('[AI Refine Field] Error:', error);
        throw new Error(`Failed to refine ${fieldLabel}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
// PERSONA FRAMEWORK GENERATION
// ============================================

// History round for framework iterative refinement
interface FrameworkHistoryRound {
    round: number;
    frameworks: Array<{ title: string; content: string }>;
    feedback: string;
}

interface GeneratePersonaFrameworksParams {
    model: AIModel;
    productDescription: string;
    personaInput?: string;
    swipeFiles?: string;
    customPrompt?: string;
    frameworkCount?: number;
    // Marketing context fields
    keyQualifyingCriteria?: string;
    offerFlow?: string;
    proofPoints?: string;
    primaryObjections?: string;
    // Iterative refinement
    history?: FrameworkHistoryRound[];
    currentFeedback?: string;
    // Custom prompts override
    customSystemPrompt?: string;
    customUserPrompt?: string;
}

export interface PersonaFrameworkResult {
    id: string;
    title: string;
    content: string;
    selected: boolean;
}

export async function generatePersonaFrameworks(params: GeneratePersonaFrameworksParams): Promise<GenerationResult<PersonaFrameworkResult[]>> {
    const {
        model, productDescription, personaInput, swipeFiles, customPrompt, frameworkCount = 5,
        keyQualifyingCriteria, offerFlow, proofPoints, primaryObjections,
        history, currentFeedback,
        customSystemPrompt, customUserPrompt
    } = params;

    const isRefinement = history && history.length > 0;

    // Default system prompt - strategic framework approach
    const defaultSystemPrompt = isRefinement
        ? `You are a senior advertising strategist refining persona frameworks based on user feedback.

Review the previous generation rounds and feedback below, then generate ${frameworkCount} IMPROVED persona frameworks that address the feedback.

Each framework should have:
- title: A short descriptive label (2-5 words)
- content: A strategic description (50-150 words) of this archetype and why it matters for ad creative

Apply the feedback to improve the frameworks. Return ONLY a valid JSON array.`
        : `You are a senior advertising strategist helping to develop a persona framework for an ad campaign.

Your task is to analyze the campaign and propose ${frameworkCount} persona frameworks—not actual personas, but strategic lenses we should use to generate them.

Think through:
- What makes this campaign unique?
- What's the core psychological journey for this audience?
- What dimensions would create the most meaningful variation in ad creative?
- What does the winner ad/swipe file tell us about what works, and what's left unexplored?

Be direct and strategic. Each framework should have:
- title: A short descriptive label (2-5 words, e.g., "The Skeptical Professional", "The Overwhelmed Caregiver")
- content: A strategic description (50-150 words) explaining this archetype, their core characteristics, psychological drivers, and why this framework matters for ad creative

Don't force a template. Think through the best way to slice this audience for creative development.

Return ONLY a valid JSON array with objects containing "title" and "content" fields.`;

    // Default user prompt
    let defaultUserPrompt = `## Campaign Parameters
- Product/Service: ${productDescription}
${personaInput ? `- Target Audience: ${personaInput}` : ''}
${keyQualifyingCriteria ? `- Key Qualifying Criteria: ${keyQualifyingCriteria}` : ''}
${offerFlow ? `- Offer Flow: ${offerFlow}` : ''}
${proofPoints ? `- Proof Points: ${proofPoints}` : ''}
${primaryObjections ? `- Primary Objections: ${primaryObjections}` : ''}
${swipeFiles ? `- Swipe File/Winner Ad: ${swipeFiles}` : ''}
${customPrompt ? `\n## Additional Instructions\n${customPrompt}` : ''}`;

    if (isRefinement && history) {
        defaultUserPrompt += `\n\n--- PREVIOUS GENERATIONS & FEEDBACK ---\n`;
        for (const round of history) {
            defaultUserPrompt += `\nRound ${round.round} Output:\n`;
            defaultUserPrompt += round.frameworks.map(f => `• ${f.title}: ${f.content}`).join('\n');
            if (round.feedback) {
                defaultUserPrompt += `\n\nFeedback after Round ${round.round}: "${round.feedback}"\n`;
            }
        }
        if (currentFeedback) {
            defaultUserPrompt += `\n--- CURRENT FEEDBACK TO ADDRESS ---\n"${currentFeedback}"\n`;
        }
        defaultUserPrompt += `\nGenerate ${frameworkCount} IMPROVED persona frameworks as JSON array with "title" and "content" fields, addressing all feedback above.`;
    } else {
        defaultUserPrompt += `\n\nGenerate ${frameworkCount} distinct persona frameworks as JSON array with "title" and "content" fields only.`;
    }

    // Use custom prompts if provided, otherwise use defaults
    const systemPrompt = customSystemPrompt || defaultSystemPrompt;
    const userPrompt = customUserPrompt || defaultUserPrompt;

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
        const frameworks = JSON.parse(cleanedResponse);

        // Add IDs and selected flag
        const data: PersonaFrameworkResult[] = frameworks.map((f: any, idx: number) => ({
            id: `framework-${Date.now()}-${idx}`,
            title: f.title,
            content: f.content,
            selected: false
        }));

        return { data, systemPrompt, userPrompt, model };
    } catch (error) {
        console.error('Error generating persona frameworks:', error);
        throw new Error(`Failed to generate persona frameworks with ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        // Handle empty response body gracefully
        let errorMessage = `AI API request failed with status ${response.status}`;
        try {
            const text = await response.text();
            if (text) {
                const error = JSON.parse(text);
                errorMessage = error.error || errorMessage;
            }
        } catch {
            // Response body was empty or not valid JSON
        }
        throw new Error(errorMessage);
    }

    // Handle empty successful response
    const text = await response.text();
    if (!text) {
        throw new Error('AI API returned empty response');
    }

    try {
        const data = JSON.parse(text);
        return data.response;
    } catch {
        throw new Error(`AI API returned invalid JSON: ${text.substring(0, 100)}...`);
    }
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
