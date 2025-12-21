import { useState, useEffect } from 'react';
import { Map, Users, Shield, User, Settings, HelpCircle, Check, ChevronRight, Sparkles, Brain, Loader2, AlertCircle } from 'lucide-react';
import type { AIProvider, GeneratedAngle, GeneratedAdVariation } from '../services/ai/types';
import { PROVIDER_INFO } from '../services/ai/types';
import { getAvailableProviders, generateAngles, generateAdVariations } from '../services/ai/api';

// --- Types ---

interface Persona {
    id: string;
    name: string;
    role: string;
    summary: string;
    selected: boolean;
}

// --- Initial Data ---

const INITIAL_PERSONAS: Persona[] = [
    {
        id: 'p1',
        name: 'Brenda',
        role: 'The Grandmother',
        summary: 'Age 62, fears judgement from grandkids, incarcerated \'95-\'05. Believes system is rigged.',
        selected: true,
    },
    {
        id: 'p2',
        name: 'Maria',
        role: 'Recently Released',
        summary: 'Age 51, trying to hold down first job, fears retaliation. Needs financial stability.',
        selected: true,
    },
    {
        id: 'p3',
        name: 'Tanya',
        role: 'Isolated Lifer',
        summary: 'Released last year after 30 years. No family contact. Heavily institutionalized.',
        selected: false,
    },
];

const CAMPAIGN_CONTEXT = "CA Women's Prison Sexual Abuse Survivor Initiative - Target: Women 50-65, focusing on Black & Hispanic demographics. Facilities: CCWF, Valley State, CIW, Folsom Women's.";

export function AiAdCopy() {
    // AI Provider State
    const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
    const [providersLoading, setProvidersLoading] = useState(true);

    // Content State
    const [personas, setPersonas] = useState<Persona[]>(INITIAL_PERSONAS);
    const [triggerType, setTriggerType] = useState('Settlement News');
    const [triggerText, setTriggerText] = useState('A new $50M settlement fund was just established for historical cases before 2010.');
    const [generatedAngles, setGeneratedAngles] = useState<GeneratedAngle[]>([]);
    const [selectedAngleId, setSelectedAngleId] = useState<string | null>(null);
    const [adVariations, setAdVariations] = useState<GeneratedAdVariation[]>([]);

    // Loading & Error States
    const [isGeneratingAngles, setIsGeneratingAngles] = useState(false);
    const [isGeneratingAds, setIsGeneratingAds] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load available providers on mount
    useEffect(() => {
        async function loadProviders() {
            try {
                const response = await getAvailableProviders();
                setAvailableProviders(response.availableProviders);
                if (response.defaultProvider) {
                    setSelectedProvider(response.defaultProvider);
                } else if (response.availableProviders.length > 0) {
                    setSelectedProvider(response.availableProviders[0]);
                }
            } catch (err) {
                console.error('[AI Ad Copy] Failed to load providers:', err);
            } finally {
                setProvidersLoading(false);
            }
        }
        loadProviders();
    }, []);

    // Handlers
    const togglePersona = (id: string) => {
        setPersonas(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
    };

    const handleGenerateAngles = async () => {
        if (!selectedProvider) {
            setError('Please select an AI provider');
            return;
        }

        const selectedPersonas = personas.filter(p => p.selected);
        if (selectedPersonas.length === 0) {
            setError('Please select at least one persona');
            return;
        }

        setError(null);
        setIsGeneratingAngles(true);
        setGeneratedAngles([]);
        setSelectedAngleId(null);
        setAdVariations([]);

        try {
            const result = await generateAngles(selectedProvider, {
                personas: selectedPersonas.map(p => ({
                    id: p.id,
                    name: p.name,
                    role: p.role,
                    summary: p.summary,
                })),
                triggerType,
                triggerContext: triggerText,
                campaignContext: CAMPAIGN_CONTEXT,
            });

            if (result.success && result.angles) {
                setGeneratedAngles(result.angles);
            } else {
                setError(result.error || 'Failed to generate angles');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsGeneratingAngles(false);
        }
    };

    const handleSelectAngle = async (angle: GeneratedAngle) => {
        if (!selectedProvider) return;

        setSelectedAngleId(angle.id);
        setAdVariations([]);
        setIsGeneratingAds(true);
        setError(null);

        try {
            const persona = personas.find(p => p.id === angle.personaId);
            const result = await generateAdVariations(
                selectedProvider,
                angle,
                persona?.name || 'Unknown',
                CAMPAIGN_CONTEXT
            );

            if (result.success && result.variations) {
                setAdVariations(result.variations);
            } else {
                setError(result.error || 'Failed to generate ad variations');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsGeneratingAds(false);
        }
    };

    const handleAdChange = (id: string, newText: string) => {
        setAdVariations(prev => prev.map(ad => ad.id === id ? { ...ad, text: newText } : ad));
    };

    // Provider selector component
    const ProviderSelector = () => {
        if (providersLoading) {
            return (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading AI providers...
                </div>
            );
        }

        if (availableProviders.length === 0) {
            return (
                <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                    <AlertCircle className="w-4 h-4" />
                    No AI providers configured. Add API keys in .env
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 uppercase">Model:</span>
                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                    {(['openai', 'gemini', 'claude'] as AIProvider[]).map(provider => {
                        const info = PROVIDER_INFO[provider];
                        const isAvailable = availableProviders.includes(provider);
                        const isSelected = selectedProvider === provider;

                        return (
                            <button
                                key={provider}
                                onClick={() => isAvailable && setSelectedProvider(provider)}
                                disabled={!isAvailable}
                                title={isAvailable ? info.name : `${info.name} - API key not configured`}
                                className={`
                                    px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5
                                    ${isSelected
                                        ? 'bg-white shadow-sm text-slate-900'
                                        : isAvailable
                                            ? 'text-slate-600 hover:bg-white/50'
                                            : 'text-slate-300 cursor-not-allowed opacity-50'
                                    }
                                `}
                                style={isSelected ? { borderBottom: `2px solid ${info.color}` } : {}}
                            >
                                <span>{info.icon}</span>
                                <span className="hidden sm:inline">{info.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 text-slate-900 font-sans">

            {/* --- HEADER --- */}
            <header className="flex-none bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-900 text-white p-1.5 rounded">
                        <Brain className="w-5 h-5" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Legal Compass: Sensitive Case Ad Generator</h1>
                </div>

                <div className="flex items-center gap-3 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200 text-sm">
                    <span className="font-semibold text-slate-600">Active Campaign:</span>
                    <span className="text-slate-800">CA Women's Prison Sexual Abuse Survivor Initiative</span>
                    <span className="text-slate-500 text-xs px-2 py-0.5 bg-slate-200 rounded-full">Target: Women 50-65</span>
                </div>

                <div className="flex items-center gap-4">
                    <ProviderSelector />
                    <div className="flex items-center gap-2 text-slate-400 border-l border-slate-200 pl-4">
                        <button className="hover:text-slate-600"><User className="w-5 h-5" /></button>
                        <button className="hover:text-slate-600"><Settings className="w-5 h-5" /></button>
                        <button className="hover:text-slate-600"><HelpCircle className="w-5 h-5" /></button>
                    </div>
                </div>
            </header>

            {/* --- Error Banner --- */}
            {error && (
                <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto text-red-500 hover:text-red-700"
                    >
                        Dismiss
                    </button>
                </div>
            )}


            {/* --- MAIN CONTENT (3 COLUMNS) --- */}
            <div className="flex-1 overflow-hidden flex divide-x divide-slate-200">

                {/* --- COLUMN 1: INPUTS & PERSONAS --- */}
                <div className="w-1/3 min-w-[320px] max-w-sm flex flex-col bg-slate-50 overflow-y-auto">
                    <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Step 1</h2>
                        <h3 className="text-lg font-semibold text-slate-800">Select Context</h3>
                    </div>

                    <div className="p-5 space-y-6">
                        {/* Campaign Parameters */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase">Campaign Parameters (Locked)</h4>
                            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-sm text-slate-600 shadow-sm">
                                <div className="flex items-start gap-2">
                                    <Map className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>CCWF, Valley State, CIW, Folsom Women's</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Users className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>Demographics: Black & Hispanic focus, Age 50-65</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Shield className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>Tone Guardrails: Dignified, No sensationalism, "Free/Private" CTAs only</span>
                                </div>
                            </div>
                        </div>

                        {/* Persona Library */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase">Persona Library</h4>
                                <button className="text-xs text-blue-600 font-medium hover:underline">+ Create New</button>
                            </div>

                            <div className="space-y-3">
                                {personas.map(persona => (
                                    <div
                                        key={persona.id}
                                        onClick={() => togglePersona(persona.id)}
                                        className={`cursor-pointer border rounded-lg p-3 transition-all ${persona.selected
                                            ? 'bg-blue-50 border-blue-200 shadow-sm'
                                            : 'bg-white border-slate-200 hover:border-slate-300 opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${persona.selected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'
                                                }`}>
                                                {persona.selected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="font-semibold text-slate-800">{persona.name}</span>
                                            <span className="text-xs text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{persona.role}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed pl-6">
                                            {persona.summary}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- COLUMN 2: ENGINE & ANGLES --- */}
                <div className="w-1/3 min-w-[320px] max-w-sm flex flex-col bg-white border-l border-r border-slate-200">
                    <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Step 2</h2>
                        <h3 className="text-lg font-semibold text-slate-800">Define Urgency & Generate</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6">

                        {/* Trigger Input */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase">Values & Triggers</h4>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Urgency Trigger Type</label>
                                <select
                                    value={triggerType}
                                    onChange={(e) => setTriggerType(e.target.value)}
                                    className="w-full text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                >
                                    <option>New Legislation</option>
                                    <option>Settlement News</option>
                                    <option>Deadline approaching</option>
                                    <option>General Awareness Month</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Context Details</label>
                                <textarea
                                    value={triggerText}
                                    onChange={(e) => setTriggerText(e.target.value)}
                                    className="w-full h-24 text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                    placeholder="Describe the trigger event..."
                                />
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerateAngles}
                            disabled={isGeneratingAngles || !selectedProvider}
                            className={`w-full font-semibold py-3 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 ${isGeneratingAngles || !selectedProvider
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                                }`}
                        >
                            {isGeneratingAngles ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    GENERATING...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    GENERATE ANGLES
                                </>
                            )}
                        </button>

                        {/* Generated Angles List */}
                        <div className="space-y-4 pt-2">
                            {generatedAngles.length > 0 && (
                                <h4 className="text-xs font-semibold text-slate-500 uppercase">Generated Angles ({generatedAngles.length})</h4>
                            )}

                            {generatedAngles.map((angle, idx) => {
                                const persona = personas.find(p => p.id === angle.personaId);
                                const isSelected = selectedAngleId === angle.id;

                                return (
                                    <div
                                        key={angle.id}
                                        onClick={() => handleSelectAngle(angle)}
                                        className={`group cursor-pointer border rounded-lg p-3 transition-all relative ${isSelected
                                            ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400'
                                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Angle #{idx + 1} ({persona?.name})</span>
                                            {isSelected && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                                        </div>
                                        <h5 className="text-sm font-semibold text-slate-800 mb-2 leading-tight">"{angle.hook}"</h5>
                                        <div className="text-xs text-slate-600 space-y-1">
                                            <p><strong className="text-slate-400">Pain:</strong> {angle.pain}</p>
                                            <p><strong className="text-slate-400">Why Now:</strong> {angle.whyNow}</p>
                                        </div>

                                        <div className={`mt-3 flex items-center text-xs font-medium ${isSelected ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`}>
                                            Create Ads for this Angle <ChevronRight className="w-3 h-3 ml-1" />
                                        </div>
                                    </div>
                                );
                            })}
                            {generatedAngles.length === 0 && !isGeneratingAngles && (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    Click "Generate" to see potential angles based on your selection.
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* --- COLUMN 3: OUTPUT --- */}
                <div className="flex-1 flex flex-col bg-slate-50 min-w-[400px]">
                    <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10 flex justify-between items-center">
                        <div>
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Step 3</h2>
                            <h3 className="text-lg font-semibold text-slate-800">Review & Export</h3>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">
                        {isGeneratingAds ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Loader2 className="w-12 h-12 animate-spin mb-4 text-blue-500" />
                                <p className="font-medium">Generating ad variations...</p>
                                <p className="text-sm">Using {selectedProvider ? PROVIDER_INFO[selectedProvider].name : 'AI'}</p>
                            </div>
                        ) : selectedAngleId && adVariations.length > 0 ? (
                            <div className="max-w-2xl mx-auto space-y-8">
                                {/* Context Header */}
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-blue-800 mb-1">Viewing Ads for Angle:</h4>
                                    <p className="text-sm text-blue-600 italic">
                                        "{generatedAngles.find(a => a.id === selectedAngleId)?.hook}"
                                    </p>
                                </div>

                                {/* Ad Variations */}
                                <div className="space-y-6">
                                    {adVariations.map(variation => (
                                        <div key={variation.id} className="group">
                                            <div className="flex justify-between items-end mb-2">
                                                <label className="text-sm font-medium text-slate-700">{variation.label}</label>
                                                {variation.limit && (
                                                    <span className={`text-xs ${variation.text.length > variation.limit ? 'text-red-500' : 'text-slate-400'
                                                        }`}>
                                                        {variation.text.length} / {variation.limit}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <textarea
                                                    value={variation.text}
                                                    onChange={(e) => handleAdChange(variation.id, e.target.value)}
                                                    className="w-full min-h-[100px] p-4 text-base text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none leading-relaxed shadow-sm resize-y"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-4 pt-8 border-t border-slate-200">
                                    <button
                                        onClick={() => selectedAngleId && handleSelectAngle(generatedAngles.find(a => a.id === selectedAngleId)!)}
                                        className="flex-1 py-3 px-4 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white transition-colors"
                                    >
                                        Regenerate Variations
                                    </button>
                                    <button className="flex-[2] py-3 px-4 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 shadow-md transition-colors flex items-center justify-center gap-2">
                                        <Check className="w-5 h-5" />
                                        APPROVE & EXPORT TO CSV
                                    </button>
                                </div>

                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                    <Map className="w-8 h-8" />
                                </div>
                                <p className="font-medium">Select an Angle from Step 2 to view ad variations.</p>
                            </div>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
}
