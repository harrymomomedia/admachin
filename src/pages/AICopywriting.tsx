import { useState, useEffect } from 'react';
import {
    Sparkles,
    ChevronDown,
    ChevronUp,
    Check,
    Loader2,
    Download,
    X,
    Save,
    Bookmark,
} from 'lucide-react';
import { getProjects, getSubprojects, createAdCopy, type Project, type Subproject, type Persona } from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { cn } from '../utils/cn';
import { PersonaSelector } from '../components/PersonaSelector';

interface Angle {
    id: string;
    angle: string;
    persona_id: string;
    persona_name: string;
    pain_point: string;
    why_now: string;
    selected: boolean;
}

interface AdCopyItem {
    id: string;
    copy: string;
    angle_ids: string[];
    angle_names: string[];
    selected: boolean;
}

interface ProductPreset {
    id: string;
    name: string;
    productDescription: string;
    personaInput: string;
    swipeFiles: string;
    productCustomPrompt: string;
    projectId: string;
    subprojectId: string;
    aiModel: AIModel;
}

type AIModel = 'claude' | 'gpt' | 'gemini';

export function AICopywriting() {
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);

    // Presets
    const [presets, setPresets] = useState<ProductPreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState('');
    const [showSavePresetModal, setShowSavePresetModal] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    // Model Selection
    const [selectedModel, setSelectedModel] = useState<AIModel>('claude');

    // Step 1: Product Info & Project Selection
    const [productDescription, setProductDescription] = useState('');
    const [personaInput, setPersonaInput] = useState('');
    const [swipeFiles, setSwipeFiles] = useState('');
    const [productCustomPrompt, setProductCustomPrompt] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedSubprojectId, setSelectedSubprojectId] = useState('');
    const [productExpanded, setProductExpanded] = useState(true);

    // Step 2: Personas
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [personasCustomPrompt, setPersonasCustomPrompt] = useState('');
    const [personasLoading, setPersonasLoading] = useState(false);
    const [personasExpanded, setPersonasExpanded] = useState(false);

    // Step 3: Angles
    const [angles, setAngles] = useState<Angle[]>([]);
    const [anglesCustomPrompt, setAnglesCustomPrompt] = useState('');
    const [anglesLoading, setAnglesLoading] = useState(false);
    const [anglesExpanded, setAnglesExpanded] = useState(false);

    // Step 4: Ad Copies
    const [adCopies, setAdCopies] = useState<AdCopyItem[]>([]);
    const [adCopiesCount, setAdCopiesCount] = useState(10);
    // const [adCopiesCustomPrompt, setAdCopiesCustomPrompt] = useState(''); // TODO: Add custom prompt input
    const [adCopiesLoading, setAdCopiesLoading] = useState(false);
    const [adCopiesExpanded, setAdCopiesExpanded] = useState(false);

    // Step 5: Export
    const [exportLoading, setExportLoading] = useState(false);

    // Load initial data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const user = await getCurrentUser();
            setCurrentUserId(user?.id || null);
            const [projectsData, subprojectsData] = await Promise.all([
                getProjects(),
                getSubprojects()
            ]);
            setProjects(projectsData);
            setSubprojects(subprojectsData);

            // Load presets from localStorage
            const savedPresets = localStorage.getItem('aiCopywritingPresets');
            if (savedPresets) {
                setPresets(JSON.parse(savedPresets));
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };

    // Preset management
    const savePreset = () => {
        if (!newPresetName.trim()) {
            alert('Please enter a preset name');
            return;
        }

        const newPreset: ProductPreset = {
            id: Date.now().toString(),
            name: newPresetName,
            productDescription,
            personaInput,
            swipeFiles,
            productCustomPrompt,
            projectId: selectedProjectId,
            subprojectId: selectedSubprojectId,
            aiModel: selectedModel
        };

        const updatedPresets = [...presets, newPreset];
        setPresets(updatedPresets);
        localStorage.setItem('aiCopywritingPresets', JSON.stringify(updatedPresets));

        setShowSavePresetModal(false);
        setNewPresetName('');
        alert(`Preset "${newPresetName}" saved successfully!`);
    };

    const updatePreset = () => {
        if (!selectedPresetId) return;

        const preset = presets.find(p => p.id === selectedPresetId);
        if (!preset) return;

        if (!confirm(`Update preset "${preset.name}" with current settings?`)) return;

        const updatedPreset: ProductPreset = {
            ...preset,
            productDescription,
            personaInput,
            swipeFiles,
            productCustomPrompt,
            projectId: selectedProjectId,
            subprojectId: selectedSubprojectId,
            aiModel: selectedModel
        };

        const updatedPresets = presets.map(p =>
            p.id === selectedPresetId ? updatedPreset : p
        );

        setPresets(updatedPresets);
        localStorage.setItem('aiCopywritingPresets', JSON.stringify(updatedPresets));
        alert(`Preset "${preset.name}" updated successfully!`);
    };

    const loadPreset = (presetId: string) => {
        const preset = presets.find(p => p.id === presetId);
        if (!preset) return;

        setProductDescription(preset.productDescription);
        setPersonaInput(preset.personaInput);
        setSwipeFiles(preset.swipeFiles);
        setProductCustomPrompt(preset.productCustomPrompt);
        setSelectedProjectId(preset.projectId);
        setSelectedSubprojectId(preset.subprojectId);
        setSelectedModel(preset.aiModel);
        setSelectedPresetId(presetId);
    };

    const deletePreset = (presetId: string) => {
        if (!confirm('Are you sure you want to delete this preset?')) return;

        const updatedPresets = presets.filter(p => p.id !== presetId);
        setPresets(updatedPresets);
        localStorage.setItem('aiCopywritingPresets', JSON.stringify(updatedPresets));

        if (selectedPresetId === presetId) {
            setSelectedPresetId('');
        }
    };

    // Selection helpers
    const selectedPersonas = personas.filter(p => p.selected);
    const selectedAngles = angles.filter(a => a.selected);
    const selectedAdCopies = adCopies.filter(a => a.selected);

    const filteredSubprojects = selectedProjectId
        ? subprojects.filter(s => s.project_id === selectedProjectId)
        : [];

    // Toggle selection
    const toggleAngleSelection = (id: string) => {
        setAngles(prev => prev.map(a =>
            a.id === id ? { ...a, selected: !a.selected } : a
        ));
    };

    const toggleAdCopySelection = (id: string) => {
        setAdCopies(prev => prev.map(a =>
            a.id === id ? { ...a, selected: !a.selected } : a
        ));
    };

    // Select all/none (personas now handled by PersonaSelector component)

    const selectAllAngles = () => setAngles(prev => prev.map(a => ({ ...a, selected: true })));
    const selectNoneAngles = () => setAngles(prev => prev.map(a => ({ ...a, selected: false })));

    const selectAllAdCopies = () => setAdCopies(prev => prev.map(a => ({ ...a, selected: true })));
    const selectNoneAdCopies = () => setAdCopies(prev => prev.map(a => ({ ...a, selected: false })));

    // Generate functions (placeholder - you'll integrate with actual AI APIs)
    const generatePersonas = async () => {
        if (!productDescription.trim()) {
            alert('Please enter a product description first');
            return;
        }

        setPersonasLoading(true);
        try {
            // TODO: Replace with actual AI API call
            // For now, generating mock data
            await new Promise(resolve => setTimeout(resolve, 2000));

            const mockPersonas: Persona[] = [
                {
                    id: '1',
                    name: 'Maria',
                    age: 58,
                    role: 'Formerly Incarcerated',
                    tagline: 'Seeking justice after years of silence',
                    background: 'Maria served 5 years at Central California Women\'s Facility (CCWF) between 2015-2020. During her incarceration, she experienced multiple incidents of sexual misconduct by correctional staff that went unreported due to fear of retaliation.',
                    current_situation: 'Now living with family in Fresno, working part-time at a local grocery store while rebuilding her life. She has limited financial resources and is still dealing with the psychological trauma from her experiences.',
                    pain_points: [
                        'Fear of retaliation and not being believed',
                        'Financial struggles making it hard to afford legal help',
                        'PTSD and anxiety from past trauma',
                        'Shame and stigma around speaking up'
                    ],
                    goals: [
                        'Get compensation for the trauma she endured',
                        'Feel validated and heard',
                        'Achieve some sense of closure',
                        'Help prevent this from happening to others'
                    ],
                    motivations: [
                        'Justice and accountability',
                        'Financial compensation',
                        'Healing and closure',
                        'Protecting others'
                    ],
                    objections: [
                        'Worried about privacy and publicity',
                        'Concerned the process will be too difficult or triggering',
                        'Unsure if she qualifies or has enough evidence',
                        'Skeptical that anything will actually change'
                    ],
                    messaging_angles: [
                        'Historic $115M settlement - you may qualify for compensation',
                        'Free, confidential case review - no obligation',
                        'Experienced advocates who understand your situation',
                        'Your voice matters - help create systemic change'
                    ],
                    selected: false
                },
                {
                    id: '2',
                    name: 'Janice',
                    age: 62,
                    role: 'Survivor & Advocate',
                    tagline: 'Ready to speak truth to power',
                    background: 'Janice was incarcerated at CCWF from 2012-2018, where she experienced systematic sexual harassment and abuse. After release, she became active in prison reform advocacy and support groups for survivors.',
                    current_situation: 'Released 3 years ago and now works with local advocacy groups. She struggles with PTSD but has found strength in community and wants to use her voice to help others seek justice.',
                    pain_points: [
                        'Ongoing trauma and flashbacks',
                        'Anger at the system that failed to protect her',
                        'Difficulty trusting authority figures',
                        'Financial instability affecting her recovery'
                    ],
                    goals: [
                        'Hold abusers and the system accountable',
                        'Support other survivors in their healing journey',
                        'Secure compensation to aid recovery',
                        'Create lasting policy changes'
                    ],
                    motivations: [
                        'Accountability and reform',
                        'Supporting other survivors',
                        'Personal healing',
                        'Financial stability'
                    ],
                    objections: [
                        'Concerned about re-traumatization through legal process',
                        'Worried about time commitment',
                        'Skeptical of lawyers and the legal system',
                        'Unsure if her case is strong enough'
                    ],
                    messaging_angles: [
                        'Stand with other survivors - you\'re not alone',
                        'Turn your pain into power and policy change',
                        'Compassionate legal team with proven track record',
                        'Join a community of survivors seeking justice together'
                    ],
                    selected: false
                },
                {
                    id: '3',
                    name: 'Rosa',
                    age: 54,
                    role: 'Prison Reform Activist',
                    tagline: 'Fighting for systemic change',
                    background: 'Rosa spent 8 years at CCWF (2010-2018) and became a vocal advocate for prison reform after witnessing widespread abuse. She now runs a non-profit supporting formerly incarcerated women.',
                    current_situation: 'Active in prison reform advocacy, speaking at events and working with lawmakers. She sees this lawsuit as an opportunity to create meaningful systemic change and set precedents.',
                    pain_points: [
                        'Frustration with slow pace of reform',
                        'Exhaustion from fighting for change',
                        'Limited resources for her advocacy work',
                        'Dealing with pushback from institutions'
                    ],
                    goals: [
                        'Create systemic change in prison policies',
                        'Set legal precedents for future cases',
                        'Amplify survivor voices',
                        'Secure resources to expand advocacy work'
                    ],
                    motivations: [
                        'Creating lasting impact',
                        'Justice for all survivors',
                        'Policy and systemic reform',
                        'Community empowerment'
                    ],
                    objections: [
                        'Worried settlements might silence broader reform efforts',
                        'Concerned about how this fits into larger advocacy strategy',
                        'Time constraints with existing commitments',
                        'Potential conflicts with her public advocacy role'
                    ],
                    messaging_angles: [
                        'Use this settlement to fund lasting systemic change',
                        'Set precedents that protect future incarcerated women',
                        'Your advocacy can be amplified through legal action',
                        'Join forces with other advocates for maximum impact'
                    ],
                    selected: false
                }
            ];

            setPersonas(mockPersonas);
            setPersonasExpanded(true);
            setProductExpanded(false);
        } catch (error) {
            console.error('Failed to generate personas:', error);
            alert('Failed to generate personas. Please try again.');
        } finally {
            setPersonasLoading(false);
        }
    };

    const generateAngles = async () => {
        if (selectedPersonas.length === 0) {
            alert('Please select at least one persona first');
            return;
        }

        setAnglesLoading(true);
        try {
            // TODO: Replace with actual AI API call
            await new Promise(resolve => setTimeout(resolve, 2000));

            const mockAngles: Angle[] = selectedPersonas.flatMap((persona) => [
                {
                    id: `${persona.id}-1`,
                    angle: 'Historic $115M settlement - you may qualify for compensation',
                    persona_id: persona.id,
                    persona_name: persona.name,
                    pain_point: 'Years of trauma left unaddressed, feeling powerless',
                    why_now: 'Settlement creates unprecedented opportunity for justice',
                    selected: false
                },
                {
                    id: `${persona.id}-2`,
                    angle: 'Free, confidential case review - no obligation',
                    persona_id: persona.id,
                    persona_name: persona.name,
                    pain_point: 'Fear of speaking up, not knowing who to trust',
                    why_now: 'Safe, private process with experienced advocates',
                    selected: false
                }
            ]);

            setAngles(mockAngles);
            setAnglesExpanded(true);
            setPersonasExpanded(false);
        } catch (error) {
            console.error('Failed to generate angles:', error);
            alert('Failed to generate angles. Please try again.');
        } finally {
            setAnglesLoading(false);
        }
    };

    const generateAdCopies = async () => {
        if (selectedAngles.length === 0) {
            alert('Please select at least one angle first');
            return;
        }

        setAdCopiesLoading(true);
        try {
            // TODO: Replace with actual AI API call
            await new Promise(resolve => setTimeout(resolve, 2000));

            const mockAdCopies: AdCopyItem[] = selectedAngles.slice(0, adCopiesCount).map((angle, idx) => ({
                id: `copy-${idx + 1}`,
                copy: `🚨 Were you abused at ${['CCWF', 'Valley State', 'CIW'][idx % 3]}?\n\n${angle.angle}\n\n${angle.pain_point}\n\nClick below for a free, private case review.\n\n*Compensation amounts may vary by case`,
                angle_ids: [angle.id],
                angle_names: [angle.angle],
                selected: false
            }));

            setAdCopies(mockAdCopies);
            setAdCopiesExpanded(true);
            setAnglesExpanded(false);
        } catch (error) {
            console.error('Failed to generate ad copies:', error);
            alert('Failed to generate ad copies. Please try again.');
        } finally {
            setAdCopiesLoading(false);
        }
    };

    const handleExport = async () => {
        if (!selectedProjectId) {
            alert('Please select a project');
            return;
        }

        if (selectedAdCopies.length === 0) {
            alert('Please select at least one ad copy to export');
            return;
        }

        setExportLoading(true);
        try {
            const project = projects.find(p => p.id === selectedProjectId);

            for (const adCopy of selectedAdCopies) {
                const angle = angles.find(a => adCopy.angle_ids.includes(a.id));
                const persona = angle ? personas.find(p => p.id === angle.persona_id) : null;

                await createAdCopy({
                    user_id: currentUserId,
                    text: adCopy.copy,
                    type: 'primary_text',
                    project: project?.name || undefined,
                    project_id: selectedProjectId,
                    subproject_id: selectedSubprojectId || null,
                    platform: 'FB',
                    source_angle: adCopy.angle_names.join(', ') || null,
                    source_persona: persona?.name || null,
                    ai_model: selectedModel
                });
            }

            alert(`Successfully exported ${selectedAdCopies.length} ad ${selectedAdCopies.length === 1 ? 'copy' : 'copies'} to Ad Text library!`);

            // Reset selections
            setAdCopies(prev => prev.map(a => ({ ...a, selected: false })));
        } catch (error) {
            console.error('Failed to export ad copies:', error);
            alert('Failed to export ad copies. Please try again.');
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto bg-gray-50">
            {/* Header with Model Selector */}
            <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-blue-600" />
                            AI Copywriting
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Generate ad copy using personas and angles
                        </p>
                    </div>

                    {/* Model Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">AI Model:</span>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                            {(['claude', 'gpt', 'gemini'] as AIModel[]).map(model => (
                                <button
                                    key={model}
                                    onClick={() => setSelectedModel(model)}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded transition-all",
                                        selectedModel === model
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "text-gray-600 hover:text-gray-900"
                                    )}
                                >
                                    {model === 'claude' ? 'Claude' : model === 'gpt' ? 'GPT' : 'Gemini'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Progress Breadcrumb */}
                <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500">
                    <span className={productDescription ? 'text-green-600 font-medium' : ''}>Product</span>
                    <ChevronDown className="w-3 h-3" />
                    <span className={personas.length > 0 ? 'text-green-600 font-medium' : ''}>
                        {personas.length > 0 ? `${selectedPersonas.length}/${personas.length} Personas` : 'Personas'}
                    </span>
                    <ChevronDown className="w-3 h-3" />
                    <span className={angles.length > 0 ? 'text-green-600 font-medium' : ''}>
                        {angles.length > 0 ? `${selectedAngles.length}/${angles.length} Angles` : 'Angles'}
                    </span>
                    <ChevronDown className="w-3 h-3" />
                    <span className={adCopies.length > 0 ? 'text-green-600 font-medium' : ''}>
                        {adCopies.length > 0 ? `${selectedAdCopies.length}/${adCopies.length} Ad Copies` : 'Ad Copies'}
                    </span>
                </div>
            </div>

            {/* Step 1: Product Info */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                    onClick={() => setProductExpanded(!productExpanded)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            1
                        </div>
                        <div className="text-left">
                            <h3 className="text-sm font-semibold text-gray-900">Product Information & Project</h3>
                            <p className="text-[10px] text-gray-500">Describe your product/service, select project, and set preferences</p>
                        </div>
                    </div>
                    {productExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {productExpanded && (
                    <div className="p-4 pt-0 space-y-3 border-t border-gray-100">
                        {/* Preset Selection */}
                        <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                            <Bookmark className="w-4 h-4 text-gray-400" />
                            <select
                                value={selectedPresetId}
                                onChange={e => {
                                    if (e.target.value) {
                                        loadPreset(e.target.value);
                                    } else {
                                        setSelectedPresetId('');
                                    }
                                }}
                                className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Load a saved preset...</option>
                                {presets.map(preset => (
                                    <option key={preset.id} value={preset.id}>
                                        {preset.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => setShowSavePresetModal(true)}
                                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                                <Save className="w-3 h-3" />
                                Save Preset
                            </button>
                            {selectedPresetId && (
                                <>
                                    <button
                                        onClick={updatePreset}
                                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                                    >
                                        <Save className="w-3 h-3" />
                                        Update
                                    </button>
                                    <button
                                        onClick={() => deletePreset(selectedPresetId)}
                                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Product/Service Description <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={4}
                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                placeholder="E.g., California women's prison sexual abuse lawsuit - seeking survivors for compensation..."
                                value={productDescription}
                                onChange={e => setProductDescription(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Persona Input (Optional)
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                    placeholder="E.g., Women 50-65 years old, formerly incarcerated, 50% Black and Hispanic..."
                                    value={personaInput}
                                    onChange={e => setPersonaInput(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Swipe Files / Headlines (Optional)
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                    placeholder="Paste proven headline patterns here..."
                                    value={swipeFiles}
                                    onChange={e => setSwipeFiles(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Custom Prompt / Guardrails (Optional)
                            </label>
                            <textarea
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                placeholder="E.g., Use respectful tone, no sensationalism, focus on dignity..."
                                value={productCustomPrompt}
                                onChange={e => setProductCustomPrompt(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Project <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedProjectId}
                                    onChange={e => {
                                        setSelectedProjectId(e.target.value);
                                        setSelectedSubprojectId('');
                                    }}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Select Project</option>
                                    {projects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Subproject (Optional)
                                </label>
                                <select
                                    value={selectedSubprojectId}
                                    onChange={e => setSelectedSubprojectId(e.target.value)}
                                    disabled={!selectedProjectId}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                >
                                    <option value="">No Subproject</option>
                                    {filteredSubprojects.map(subproject => (
                                        <option key={subproject.id} value={subproject.id}>
                                            {subproject.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={generatePersonas}
                                disabled={personasLoading || !productDescription.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {personasLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Generate Personas
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Step 2: Personas */}
            {personas.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setPersonasExpanded(!personasExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                                2
                            </div>
                            <div className="text-left">
                                <h3 className="text-sm font-semibold text-gray-900">Select Personas</h3>
                                <p className="text-[10px] text-gray-500">
                                    {selectedPersonas.length} of {personas.length} selected
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedPersonas.length > 0 && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-medium rounded">
                                    {selectedPersonas.length} selected
                                </span>
                            )}
                            {personasExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                    </button>

                    {personasExpanded && (
                        <div className="p-4 pt-0 space-y-3 border-t border-gray-100">
                            <PersonaSelector
                                personas={personas}
                                selectedIds={personas.filter(p => p.selected).map(p => p.id)}
                                onSelectionChange={(ids) => {
                                    setPersonas(prev => prev.map(p => ({
                                        ...p,
                                        selected: ids.includes(p.id)
                                    })));
                                }}
                            />

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Custom Prompt for Angles (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                    placeholder="E.g., Focus on safety and confidentiality..."
                                    value={personasCustomPrompt}
                                    onChange={e => setPersonasCustomPrompt(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={generateAngles}
                                    disabled={anglesLoading || selectedPersonas.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {anglesLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Generate Angles
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step 3: Angles */}
            {angles.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setAnglesExpanded(!anglesExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                                3
                            </div>
                            <div className="text-left">
                                <h3 className="text-sm font-semibold text-gray-900">Select Angles</h3>
                                <p className="text-[10px] text-gray-500">
                                    {selectedAngles.length} of {angles.length} selected
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedAngles.length > 0 && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                                    {selectedAngles.length} selected
                                </span>
                            )}
                            {anglesExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                    </button>

                    {anglesExpanded && (
                        <div className="p-4 pt-0 space-y-3 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllAngles}
                                        className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        onClick={selectNoneAngles}
                                        className="text-[10px] text-gray-600 hover:text-gray-700 font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                                {angles.map(angle => (
                                    <button
                                        key={angle.id}
                                        onClick={() => toggleAngleSelection(angle.id)}
                                        className={cn(
                                            "relative p-3 border-2 rounded-lg text-left transition-all",
                                            angle.selected
                                                ? "border-green-500 bg-green-50"
                                                : "border-gray-200 hover:border-gray-300 bg-white"
                                        )}
                                    >
                                        {angle.selected && (
                                            <div className="absolute top-2 right-2 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <div className="mb-2">
                                            <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-medium rounded">
                                                From: {angle.persona_name.split(',')[0]}
                                            </span>
                                        </div>
                                        <h4 className="text-xs font-semibold text-gray-900 mb-1 pr-6">{angle.angle}</h4>
                                        <p className="text-[10px] text-gray-600 mb-1">
                                            <span className="font-medium">Pain:</span> {angle.pain_point}
                                        </p>
                                        <p className="text-[10px] text-gray-500">
                                            <span className="font-medium">Why now:</span> {angle.why_now}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Number of Ad Copies to Generate
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={adCopiesCount}
                                        onChange={e => setAdCopiesCount(parseInt(e.target.value) || 5)}
                                        className="w-32 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Custom Prompt (Optional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                        placeholder="E.g., Keep under 125 characters, include emoji..."
                                        value={anglesCustomPrompt}
                                        onChange={e => setAnglesCustomPrompt(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={generateAdCopies}
                                    disabled={adCopiesLoading || selectedAngles.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {adCopiesLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Generate Ad Copies
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step 4: Ad Copies */}
            {adCopies.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setAdCopiesExpanded(!adCopiesExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">
                                4
                            </div>
                            <div className="text-left">
                                <h3 className="text-sm font-semibold text-gray-900">Select Ad Copies</h3>
                                <p className="text-[10px] text-gray-500">
                                    {selectedAdCopies.length} of {adCopies.length} selected for export
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedAdCopies.length > 0 && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-medium rounded">
                                    {selectedAdCopies.length} selected
                                </span>
                            )}
                            {adCopiesExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                    </button>

                    {adCopiesExpanded && (
                        <div className="p-4 pt-0 space-y-3 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllAdCopies}
                                        className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        onClick={selectNoneAdCopies}
                                        className="text-[10px] text-gray-600 hover:text-gray-700 font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2">
                                {adCopies.map(adCopy => (
                                    <button
                                        key={adCopy.id}
                                        onClick={() => toggleAdCopySelection(adCopy.id)}
                                        className={cn(
                                            "relative p-3 border-2 rounded-lg text-left transition-all",
                                            adCopy.selected
                                                ? "border-orange-500 bg-orange-50"
                                                : "border-gray-200 hover:border-gray-300 bg-white"
                                        )}
                                    >
                                        {adCopy.selected && (
                                            <div className="absolute top-2 right-2 w-5 h-5 bg-orange-600 rounded-full flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <div className="mb-2 flex flex-wrap gap-1">
                                            {adCopy.angle_names.map((angleName, idx) => (
                                                <span key={idx} className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-medium rounded">
                                                    Angle: {angleName.slice(0, 40)}...
                                                </span>
                                            ))}
                                        </div>
                                        <pre className="text-[10px] text-gray-900 whitespace-pre-wrap font-sans leading-relaxed pr-6">
                                            {adCopy.copy}
                                        </pre>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Export Button - Only show when ad copies exist */}
            {adCopies.length > 0 && selectedAdCopies.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">Ready to Export</h3>
                            <p className="text-[10px] text-gray-500">
                                {selectedAdCopies.length} ad {selectedAdCopies.length === 1 ? 'copy' : 'copies'} selected
                                {selectedProjectId && ` • Will be saved to: ${projects.find(p => p.id === selectedProjectId)?.name}`}
                                {selectedSubprojectId && ` / ${subprojects.find(s => s.id === selectedSubprojectId)?.name}`}
                            </p>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={exportLoading || !selectedProjectId}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {exportLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Export to Ad Text Library
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Save Preset Modal */}
            {showSavePresetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Save Preset</h2>
                            <button
                                onClick={() => setShowSavePresetModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Preset Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newPresetName}
                                    onChange={e => setNewPresetName(e.target.value)}
                                    placeholder="E.g., Women's Prison Lawsuit Campaign"
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    autoFocus
                                />
                            </div>

                            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                                <p className="font-medium mb-2">This preset will save:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Product description</li>
                                    <li>Persona input</li>
                                    <li>Swipe files</li>
                                    <li>Custom prompts</li>
                                    <li>Selected project & subproject</li>
                                    <li>AI model selection</li>
                                </ul>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSavePresetModal(false);
                                        setNewPresetName('');
                                    }}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={savePreset}
                                    disabled={!newPresetName.trim()}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Save Preset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
