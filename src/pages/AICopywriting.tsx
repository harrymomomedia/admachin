import { useState, useEffect, useRef } from 'react';
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
    Copy,
    Play,
} from 'lucide-react';
import { getProjects, getSubprojects, createAdCopy, type Project, type Subproject, type Persona } from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { cn } from '../utils/cn';
import { PersonaSelector } from '../components/PersonaSelector';
import { AIProgressToast, type ProgressStep } from '../components/AIProgressToast';
import * as AI from '../lib/ai-service';
import type { AIModel } from '../lib/ai-service';

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

// Modal state for full copy preview
interface PreviewModal {
    isOpen: boolean;
    copy: string;
    angleName: string;
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

export function AICopywriting() {
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);

    // Refs for auto-resizing textareas
    const productDescRef = useRef<HTMLTextAreaElement>(null);
    const personaInputRef = useRef<HTMLTextAreaElement>(null);
    const swipeFilesRef = useRef<HTMLTextAreaElement>(null);
    const productCustomPromptRef = useRef<HTMLTextAreaElement>(null);

    // Presets
    const [presets, setPresets] = useState<ProductPreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState('');
    const [showSavePresetModal, setShowSavePresetModal] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    // Auto-fill
    const [showAutoFillModal, setShowAutoFillModal] = useState(false);
    const [autoFillBrief, setAutoFillBrief] = useState('');
    const [autoFillLoading, setAutoFillLoading] = useState(false);

    // Model Selection
    const [selectedModel, setSelectedModel] = useState<AIModel>('claude-sonnet');

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
    const [angleCount, setAngleCount] = useState(3); // How many angles per persona
    const [anglesCustomPrompt, setAnglesCustomPrompt] = useState('');
    const [anglesLoading, setAnglesLoading] = useState(false);
    const [anglesExpanded, setAnglesExpanded] = useState(false);

    // Step 4: Ad Copies
    const [adCopies, setAdCopies] = useState<AdCopyItem[]>([]);
    const [adCopiesCount, setAdCopiesCount] = useState(10);
    const [adCopyType, setAdCopyType] = useState<'FB Ad Text' | 'FB Ad Headline' | 'Video Transcript (Only Voice)' | 'Video Ad Script'>('FB Ad Text');
    // const [adCopiesCustomPrompt, setAdCopiesCustomPrompt] = useState(''); // TODO: Add custom prompt input
    const [adCopiesLoading, setAdCopiesLoading] = useState(false);
    const [adCopiesExpanded, setAdCopiesExpanded] = useState(false);

    // Step 5: Export
    const [exportLoading, setExportLoading] = useState(false);

    // Preview Modal
    const [previewModal, setPreviewModal] = useState<PreviewModal>({ isOpen: false, copy: '', angleName: '' });

    // Progress Toast
    const [progressMessage, setProgressMessage] = useState('');
    const [progressStatus, setProgressStatus] = useState<'loading' | 'success' | 'error' | null>(null);
    const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
    const [liveOutput, setLiveOutput] = useState('');

    // Auto-resize textarea function with max height
    const autoResizeTextarea = (textarea: HTMLTextAreaElement | null) => {
        if (!textarea) return;
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 400); // Max 400px height
        textarea.style.height = `${newHeight}px`;
        // Enable scrolling if content exceeds max height
        textarea.style.overflowY = textarea.scrollHeight > 400 ? 'auto' : 'hidden';
    };

    // Auto-resize textareas when content changes
    useEffect(() => {
        autoResizeTextarea(productDescRef.current);
    }, [productDescription]);

    useEffect(() => {
        autoResizeTextarea(personaInputRef.current);
    }, [personaInput]);

    useEffect(() => {
        autoResizeTextarea(swipeFilesRef.current);
    }, [swipeFiles]);

    useEffect(() => {
        autoResizeTextarea(productCustomPromptRef.current);
    }, [productCustomPrompt]);

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
        // Validate model - fallback to claude-sonnet if invalid
        const validModels: AIModel[] = ['claude-sonnet', 'claude-opus', 'claude-haiku', 'gpt', 'gemini'];
        setSelectedModel(validModels.includes(preset.aiModel) ? preset.aiModel : 'claude-sonnet');
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

    // Auto-fill product info
    const handleAutoFill = async () => {
        if (!autoFillBrief.trim()) {
            alert('Please enter a brief description');
            return;
        }

        setAutoFillLoading(true);
        setProgressMessage('AI is generating...');
        setProgressStatus('loading');
        setLiveOutput('Waiting for AI response...\n\n');
        setProgressSteps([]);

        try {
            // Generate content
            setLiveOutput('📡 Sending request to Claude Opus 4.5...\n\n');

            const result = await AI.autoFillProductInfo({
                model: selectedModel,
                briefDescription: autoFillBrief
            });

            // Show the raw JSON response
            setLiveOutput(prev => prev + '✅ Response received!\n\n' + JSON.stringify(result, null, 2));

            // Wait a moment to show the response
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Fill in all the fields
            setProductDescription(result.productDescription);
            setPersonaInput(result.personaInput);
            setSwipeFiles(result.swipeFiles);
            setProductCustomPrompt(result.productCustomPrompt);

            // Match project/subproject
            if (result.suggestedProjectName) {
                const matchingProject = projects.find(p =>
                    p.name.toLowerCase().includes(result.suggestedProjectName!.toLowerCase()) ||
                    result.suggestedProjectName!.toLowerCase().includes(p.name.toLowerCase())
                );
                if (matchingProject) {
                    setSelectedProjectId(matchingProject.id);

                    if (result.suggestedSubprojectName) {
                        const matchingSubproject = subprojects.find(s =>
                            s.project_id === matchingProject.id &&
                            (s.name.toLowerCase().includes(result.suggestedSubprojectName!.toLowerCase()) ||
                             result.suggestedSubprojectName!.toLowerCase().includes(s.name.toLowerCase()))
                        );
                        if (matchingSubproject) {
                            setSelectedSubprojectId(matchingSubproject.id);
                        }
                    }
                }
            }

            setShowAutoFillModal(false);
            setAutoFillBrief('');
            setProgressMessage('Section 1 Auto-Fill Complete!');
            setProgressStatus('success');
            setLiveOutput('');
        } catch (error) {
            console.error('Failed to auto-fill:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setProgressMessage(`Auto-Fill Failed`);
            setProgressStatus('error');
            setLiveOutput(prev => prev + `\n\n❌ Error: ${errorMessage}`);
        } finally {
            setAutoFillLoading(false);
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

    // Generate functions
    const generatePersonas = async () => {
        if (!productDescription.trim()) {
            alert('Please enter a product description first');
            return;
        }

        setPersonasLoading(true);
        setProgressMessage('Generating Customer Personas');
        setProgressStatus('loading');
        setLiveOutput('📡 Sending request to AI...\n\n');
        setProgressSteps([]);

        try {
            const generatedPersonas = await AI.generatePersonas({
                model: selectedModel,
                productDescription,
                personaInput,
                swipeFiles,
                customPrompt: productCustomPrompt
            });

            // Show the response
            setLiveOutput(prev => prev + '✅ Received ' + generatedPersonas.length + ' personas!\n\n' + JSON.stringify(generatedPersonas, null, 2));

            await new Promise(resolve => setTimeout(resolve, 1500));

            setPersonas(generatedPersonas);
            setPersonasExpanded(true);
            setProductExpanded(false);
            setProgressMessage(`Successfully generated ${generatedPersonas.length} personas!`);
            setProgressStatus('success');
            setLiveOutput('');
        } catch (error) {
            console.error('Failed to generate personas:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setProgressMessage(`Failed to generate personas`);
            setProgressStatus('error');
            setLiveOutput(prev => prev + `\n\n❌ Error: ${errorMessage}`);
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
        setProgressMessage('Generating Marketing Angles');
        setProgressStatus('loading');
        setLiveOutput('📡 Sending request to AI...\n\n');
        setProgressSteps([]);

        try {
            const generatedAngles = await AI.generateAngles({
                model: selectedModel,
                personas: selectedPersonas,
                productDescription,
                angleCount: angleCount,
                customPrompt: anglesCustomPrompt
            });

            setLiveOutput(prev => prev + '✅ Received ' + generatedAngles.length + ' angles!\n\n' + JSON.stringify(generatedAngles, null, 2));
            await new Promise(resolve => setTimeout(resolve, 1500));

            setAngles(generatedAngles);
            setAnglesExpanded(true);
            setPersonasExpanded(false);
            setProgressMessage(`Successfully generated ${generatedAngles.length} marketing angles!`);
            setProgressStatus('success');
            setLiveOutput('');
        } catch (error) {
            console.error('Failed to generate angles:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setProgressMessage(`Failed to generate angles`);
            setProgressStatus('error');
            setLiveOutput(prev => prev + `\n\n❌ Error: ${errorMessage}`);
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
        setProgressMessage('Writing Ad Copies');
        setProgressStatus('loading');
        setLiveOutput('📡 Sending request to AI...\n\n');
        setProgressSteps([]);

        try {
            const generatedAdCopies = await AI.generateAdCopies({
                model: selectedModel,
                angles: selectedAngles,
                productDescription,
                count: adCopiesCount,
                adCopyType: adCopyType,
                customPrompt: anglesCustomPrompt
            });

            setLiveOutput(prev => prev + '✅ Received ' + generatedAdCopies.length + ' ad copies!\n\n' + JSON.stringify(generatedAdCopies, null, 2));
            await new Promise(resolve => setTimeout(resolve, 1500));

            setAdCopies(generatedAdCopies);
            setAdCopiesExpanded(true);
            setAnglesExpanded(false);
            setProgressMessage(`Successfully generated ${generatedAdCopies.length} ad copies!`);
            setProgressStatus('success');
            setLiveOutput('');
        } catch (error) {
            console.error('Failed to generate ad copies:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setProgressMessage(`Failed to generate ad copies`);
            setProgressStatus('error');
            setLiveOutput(prev => prev + `\n\n❌ Error: ${errorMessage}`);
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
                    project: project?.name || null,
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
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to export ad copies: ${errorMessage}`);
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 bg-gray-50">
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

                    {/* Model Selector and Auto-fill */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAutoFillModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm"
                        >
                            <Sparkles className="w-4 h-4" />
                            AI Auto-Fill Section 1
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600">Model:</span>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value as AIModel)}
                                className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                            >
                                <optgroup label="Claude">
                                    <option value="claude-sonnet">Claude Sonnet 4</option>
                                    <option value="claude-opus">Claude Opus 4.5</option>
                                    <option value="claude-haiku">Claude Haiku 4</option>
                                </optgroup>
                                <optgroup label="OpenAI">
                                    <option value="gpt">GPT-4o</option>
                                </optgroup>
                                <optgroup label="Google">
                                    <option value="gemini">Gemini 1.5 Pro</option>
                                </optgroup>
                            </select>
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
                                ref={productDescRef}
                                rows={4}
                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y overflow-hidden"
                                placeholder="E.g., California women's prison sexual abuse lawsuit - seeking survivors for compensation..."
                                value={productDescription}
                                onChange={e => {
                                    setProductDescription(e.target.value);
                                    autoResizeTextarea(e.target);
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Persona Input (Optional)
                                </label>
                                <textarea
                                    ref={personaInputRef}
                                    rows={3}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y overflow-hidden"
                                    placeholder="E.g., Women 50-65 years old, formerly incarcerated, 50% Black and Hispanic..."
                                    value={personaInput}
                                    onChange={e => {
                                        setPersonaInput(e.target.value);
                                        autoResizeTextarea(e.target);
                                    }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Swipe Files / Headlines (Optional)
                                </label>
                                <textarea
                                    ref={swipeFilesRef}
                                    rows={3}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y overflow-hidden"
                                    placeholder="Paste proven headline patterns here..."
                                    value={swipeFiles}
                                    onChange={e => {
                                        setSwipeFiles(e.target.value);
                                        autoResizeTextarea(e.target);
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Custom Prompt / Guardrails (Optional)
                            </label>
                            <textarea
                                ref={productCustomPromptRef}
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y overflow-hidden"
                                placeholder="E.g., Use respectful tone, no sensationalism, focus on dignity..."
                                value={productCustomPrompt}
                                onChange={e => {
                                    setProductCustomPrompt(e.target.value);
                                    autoResizeTextarea(e.target);
                                }}
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
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
                                    placeholder="E.g., Focus on safety and confidentiality..."
                                    value={personasCustomPrompt}
                                    onChange={e => setPersonasCustomPrompt(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end items-end gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Angles per Persona
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={angleCount}
                                        onChange={e => setAngleCount(parseInt(e.target.value) || 3)}
                                        className="w-20 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                </div>
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

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Type of Ad Copy
                                </label>
                                <select
                                    value={adCopyType}
                                    onChange={e => setAdCopyType(e.target.value as typeof adCopyType)}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                                >
                                    <option value="FB Ad Text">FB Ad Text</option>
                                    <option value="FB Ad Headline">FB Ad Headline</option>
                                    <option value="Video Transcript (Only Voice)">Video Transcript (Only Voice)</option>
                                    <option value="Video Ad Script">Video Ad Script</option>
                                </select>
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
                                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
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

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2">
                                {adCopies.map((adCopy) => (
                                    <div
                                        key={adCopy.id}
                                        className={cn(
                                            "relative flex flex-col bg-white border-2 rounded-xl overflow-hidden transition-all hover:shadow-md",
                                            adCopy.selected
                                                ? "border-green-500 ring-2 ring-green-100"
                                                : "border-gray-200 hover:border-gray-300"
                                        )}
                                    >
                                        {/* Selection Indicator */}
                                        {adCopy.selected && (
                                            <div className="absolute top-3 right-3 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center shadow-sm">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}

                                        {/* Ad Copy Content */}
                                        <div className="flex-1 p-4">
                                            <div className="mb-3 flex flex-wrap gap-1">
                                                {adCopy.angle_names.slice(0, 1).map((angleName, idx) => (
                                                    <span key={idx} className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                                                        {angleName.length > 40 ? angleName.slice(0, 40) + '...' : angleName}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-800 leading-relaxed line-clamp-6">
                                                {adCopy.copy}
                                            </p>
                                        </div>

                                        {/* Select Button */}
                                        <div className="px-4 py-3 border-t border-gray-100">
                                            <button
                                                onClick={() => toggleAdCopySelection(adCopy.id)}
                                                className={cn(
                                                    "w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                                                    adCopy.selected
                                                        ? "bg-green-600 text-white hover:bg-green-700"
                                                        : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                                                )}
                                            >
                                                {adCopy.selected ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                                {adCopy.selected ? 'Selected' : 'Select'}
                                            </button>
                                        </div>

                                        {/* Preview Full Copy */}
                                        <button
                                            onClick={() => setPreviewModal({
                                                isOpen: true,
                                                copy: adCopy.copy,
                                                angleName: adCopy.angle_names[0] || 'Ad Copy'
                                            })}
                                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                            Preview Full Copy
                                        </button>
                                    </div>
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

            {/* AI Auto-Fill Modal */}
            {showAutoFillModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-lg font-bold text-gray-900">AI Auto-Fill Section 1</h2>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAutoFillModal(false);
                                    setAutoFillBrief('');
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Brief Product/Service Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={autoFillBrief}
                                    onChange={e => setAutoFillBrief(e.target.value)}
                                    placeholder="E.g., A meal delivery service for busy professionals who want healthy, chef-prepared meals delivered to their door..."
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-y"
                                    rows={4}
                                    autoFocus
                                />
                                <p className="mt-1.5 text-xs text-gray-500">
                                    Just give a brief overview. AI will expand it into detailed product info, personas, and swipe files.
                                </p>
                            </div>

                            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 text-xs text-gray-700">
                                <p className="font-medium mb-2 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                    AI will auto-fill:
                                </p>
                                <ul className="list-disc list-inside space-y-1 ml-1">
                                    <li>Product description (expanded & detailed)</li>
                                    <li>Persona input (target audiences)</li>
                                    <li>Swipe files (headline examples)</li>
                                    <li>Custom prompt suggestions</li>
                                    <li>Project/Subproject matches (if found)</li>
                                </ul>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAutoFillModal(false);
                                        setAutoFillBrief('');
                                    }}
                                    disabled={autoFillLoading}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAutoFill}
                                    disabled={!autoFillBrief.trim() || autoFillLoading}
                                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {autoFillLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Auto-Fill with AI
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Full Copy Modal */}
            {previewModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Full Ad Copy</h2>
                                <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                    {previewModal.angleName.length > 50 ? previewModal.angleName.slice(0, 50) + '...' : previewModal.angleName}
                                </span>
                            </div>
                            <button
                                onClick={() => setPreviewModal({ isOpen: false, copy: '', angleName: '' })}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                                {previewModal.copy}
                            </pre>
                        </div>

                        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(previewModal.copy);
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Copy className="w-4 h-4" />
                                Copy to Clipboard
                            </button>
                            <button
                                onClick={() => setPreviewModal({ isOpen: false, copy: '', angleName: '' })}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Toast */}
            {progressStatus && (
                <AIProgressToast
                    message={progressMessage}
                    status={progressStatus}
                    steps={progressSteps}
                    liveOutput={liveOutput}
                    onClose={() => {
                        setProgressStatus(null);
                        setLiveOutput('');
                    }}
                />
            )}
        </div>
    );
}
