import { useState, useRef, useEffect } from 'react';
import {
    Sparkles,
    ChevronDown,
    ChevronUp,
    Check,
    Loader2,
    Download,
    X,
    Save,
    Copy,
    Play,
    FolderOpen,
    Code,
    FileText,
    User as UserIcon,
} from 'lucide-react';
import {
    getProjects,
    getSubprojects,
    createAdCopy,
    getAICopywritingPresets,
    createAICopywritingPreset,
    updateAICopywritingPreset,
    deleteAICopywritingPreset,
    getUsers,
    createSavedPersona,
    type Project,
    type Subproject,
    type Persona,
    type AICopywritingPreset,
    type User,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { cn } from '../utils/cn';
import { PersonaSelector } from '../components/PersonaSelector';
import { AIProgressToast, type ProgressStep } from '../components/AIProgressToast';
import { PresetManagerModal } from '../components/PresetManagerModal';
import { SavedPersonasModal } from '../components/SavedPersonasModal';
import * as AI from '../lib/ai-service';
import type { AIModel, PromptData } from '../lib/ai-service';

interface Angle {
    id: string;
    angle: string;
    persona_id: string;
    persona_name: string;
    pain_point: string;
    why_now: string;
    selected: boolean;
    prompts?: PromptData;
}

interface AdCopyItem {
    id: string;
    copy: string;
    angle_ids: string[];
    angle_names: string[];
    selected: boolean;
    prompts?: PromptData;
}

// Modal state for full copy preview
interface PreviewModal {
    isOpen: boolean;
    copy: string;
    angleName: string;
}

// Modal state for viewing prompts
interface PromptModal {
    isOpen: boolean;
    systemPrompt: string;
    userPrompt: string;
}

// ProductPreset now comes from Supabase (AICopywritingPreset type imported above)

export function PersonaAICopy() {
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // Refs for auto-resizing textareas
    const productDescRef = useRef<HTMLTextAreaElement>(null);
    const personaInputRef = useRef<HTMLTextAreaElement>(null);
    const swipeFilesRef = useRef<HTMLTextAreaElement>(null);
    const productCustomPromptRef = useRef<HTMLTextAreaElement>(null);

    // Presets (now stored in Supabase for team-level access)
    const [presets, setPresets] = useState<AICopywritingPreset[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<AICopywritingPreset | null>(null);
    const [showSavePresetModal, setShowSavePresetModal] = useState(false);
    const [showPresetManager, setShowPresetManager] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    const [showSavedPersonasModal, setShowSavedPersonasModal] = useState(false);

    // Prompt viewer modal state
    const [promptModal, setPromptModal] = useState<PromptModal>({
        isOpen: false,
        systemPrompt: '',
        userPrompt: ''
    });

    const handleSavePersonas = async (personasToSave: Persona[]) => {
        if (!currentUserId || !selectedProjectId) {
            alert('Please allow us to identify your profile and select a project first.');
            return;
        }

        try {
            const promises = personasToSave.map(p =>
                createSavedPersona({
                    user_id: currentUserId,
                    project_id: selectedProjectId,
                    subproject_id: selectedSubprojectId || null,
                    vertical: productDescription, // Using description as vertical
                    name: p.name,
                    role: p.role,
                    data: p
                })
            );

            await Promise.all(promises);
            alert(`Successfully saved ${personasToSave.length} persona${personasToSave.length > 1 ? 's' : ''} to library!`);
        } catch (error) {
            console.error('Failed to save personas:', error);
            alert('Failed to save personas to library.');
        }
    };

    // Auto-fill
    const [showAutoFillModal, setShowAutoFillModal] = useState(false);
    const [autoFillBrief, setAutoFillBrief] = useState('');
    const [autoFillLoading, setAutoFillLoading] = useState(false);

    // Model Selection
    const [selectedModel, setSelectedModel] = useState<AIModel>('claude-sonnet-4.5');

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
    const [personaCount, setPersonaCount] = useState(6); // How many personas to generate
    const [personasCustomPrompt, setPersonasCustomPrompt] = useState('');
    const [personasLoading, setPersonasLoading] = useState(false);
    const [personasExpanded, setPersonasExpanded] = useState(false);

    // Step 3: Angles
    const [angles, setAngles] = useState<Angle[]>([]);
    const [angleCount, setAngleCount] = useState(10); // How many total angles to generate
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
            // Default to Harry if no Supabase auth session
            const harryUserId = '807f4cb3-fd03-4e02-8828-44436a6d00e5'; // harry@momomedia.io
            setCurrentUserId(user?.id || harryUserId);

            const [projectsData, subprojectsData, presetsData, usersData] = await Promise.all([
                getProjects(),
                getSubprojects(),
                getAICopywritingPresets(),
                getUsers()
            ]);
            setProjects(projectsData);
            setSubprojects(subprojectsData);
            setPresets(presetsData);
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };

    // Preset management - now using Supabase for team-level storage
    const savePreset = async () => {
        if (!newPresetName.trim()) {
            alert('Please enter a preset name');
            return;
        }

        try {
            const newPreset = await createAICopywritingPreset({
                name: newPresetName,
                product_description: productDescription,
                persona_input: personaInput,
                swipe_files: swipeFiles,
                custom_prompt: productCustomPrompt,
                project_id: selectedProjectId || undefined,
                subproject_id: selectedSubprojectId || undefined,
                ai_model: selectedModel,
                created_by: currentUserId || undefined,
            });

            setPresets(prev => [...prev, newPreset]);
            setSelectedPreset(newPreset);
            setShowSavePresetModal(false);
            setNewPresetName('');
        } catch (error) {
            console.error('Failed to save preset:', error);
            alert('Failed to save preset. Please try again.');
        }
    };

    const handleUpdatePreset = async () => {
        if (!selectedPreset) return;

        if (!confirm(`Update preset "${selectedPreset.name}" with current settings?`)) return;

        try {
            const updatedPreset = await updateAICopywritingPreset(selectedPreset.id, {
                product_description: productDescription,
                persona_input: personaInput,
                swipe_files: swipeFiles,
                custom_prompt: productCustomPrompt,
                project_id: selectedProjectId || null,
                subproject_id: selectedSubprojectId || null,
                ai_model: selectedModel,
            });

            setPresets(prev => prev.map(p => p.id === selectedPreset.id ? updatedPreset : p));
            setSelectedPreset(updatedPreset);
        } catch (error) {
            console.error('Failed to update preset:', error);
            alert('Failed to update preset. Please try again.');
        }
    };

    const loadPreset = (preset: AICopywritingPreset) => {
        setProductDescription(preset.product_description || '');
        setPersonaInput(preset.persona_input || '');
        setSwipeFiles(preset.swipe_files || '');
        setProductCustomPrompt(preset.custom_prompt || '');
        setSelectedProjectId(preset.project_id || '');
        setSelectedSubprojectId(preset.subproject_id || '');
        // Validate model - fallback to claude-sonnet-4.5 if invalid
        const validModels: AIModel[] = ['claude-sonnet-4.5', 'claude-opus-4.5', 'claude-haiku-4.5', 'gpt', 'gemini'];
        const presetModel = preset.ai_model as AIModel;
        setSelectedModel(validModels.includes(presetModel) ? presetModel : 'claude-sonnet-4.5');
        setSelectedPreset(preset);
    };

    const handleDeletePreset = async (presetId: string) => {
        try {
            await deleteAICopywritingPreset(presetId);
            setPresets(prev => prev.filter(p => p.id !== presetId));

            if (selectedPreset?.id === presetId) {
                setSelectedPreset(null);
            }
        } catch (error) {
            console.error('Failed to delete preset:', error);
            alert('Failed to delete preset. Please try again.');
        }
    };

    const handleRenamePreset = async (presetId: string, newName: string) => {
        try {
            const updatedPreset = await updateAICopywritingPreset(presetId, { name: newName });

            setPresets(prev => prev.map(p => p.id === presetId ? updatedPreset : p));
            if (selectedPreset?.id === presetId) {
                setSelectedPreset(updatedPreset);
            }
        } catch (error) {
            console.error('Failed to rename preset:', error);
            alert('Failed to rename preset. Please try again.');
        }
    };

    const clearPreset = () => {
        setSelectedPreset(null);
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

    // Select all/none (personas now handled by PersonaSelector component)

    const selectAllAngles = () => setAngles(prev => prev.map(a => ({ ...a, selected: true })));
    const selectNoneAngles = () => setAngles(prev => prev.map(a => ({ ...a, selected: false })));

    const selectAllAdCopies = () => setAdCopies(prev => prev.map(a => ({ ...a, selected: true })));
    const selectNoneAdCopies = () => setAdCopies(prev => prev.map(a => ({ ...a, selected: false })));

    // Generate functions
    const generatePersonas = async () => {
        // Validate required fields
        if (!productDescription.trim()) {
            alert('⚠️ Please enter a Product/Service Description first');
            return;
        }
        if (!selectedProjectId) {
            alert('⚠️ Please select a Project before generating personas');
            return;
        }

        setPersonasLoading(true);
        setProgressMessage('Generating Customer Personas (this can take up to ~1 minute)...');
        setProgressStatus('loading');
        setLiveOutput('📡 Sending request to AI...\n\n');
        setProgressSteps([]);

        try {
            const generatedPersonas = await AI.generatePersonas({
                model: selectedModel,
                productDescription,
                personaInput,
                swipeFiles,
                customPrompt: productCustomPrompt,
                personaCount
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
                await createAdCopy({
                    user_id: currentUserId,
                    text: adCopy.copy,
                    type: 'primary_text',
                    project: project?.name || null,
                    project_id: selectedProjectId,
                    subproject_id: selectedSubprojectId || null,
                    platform: 'FB',
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
                            Auto-Fill
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600">Model:</span>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value as AIModel)}
                                className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                            >
                                <optgroup label="Claude">
                                    <option value="claude-sonnet-4.5">Claude Sonnet 4.5</option>
                                    <option value="claude-opus-4.5">Claude Opus 4.5</option>
                                    <option value="claude-haiku-4.5">Claude Haiku 4.5</option>
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
                            <h3 className="text-sm font-semibold text-gray-900">Campaign Parameters</h3>
                            <p className="text-[10px] text-gray-500">Describe your product/service, select project, and set preferences</p>
                        </div>
                    </div>
                    {productExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {productExpanded && (
                    <div className="p-4 pt-0 space-y-3 border-t border-gray-100">
                        {/* Preset Control Bar - Modern Design */}
                        <div className="flex items-center justify-end gap-3 py-3 border-b border-gray-200">
                            {/* Selected Preset Badge - right aligned with buttons */}
                            {selectedPreset && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                                    <span className="text-xs font-medium text-blue-700">
                                        Using: {selectedPreset.name}
                                    </span>
                                    <button
                                        onClick={clearPreset}
                                        className="p-0.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                                        title="Clear preset"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            {/* Action Buttons */}
                            {selectedPreset && (
                                <button
                                    onClick={handleUpdatePreset}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                                >
                                    <Save className="w-3 h-3" />
                                    Update
                                </button>
                            )}
                            <button
                                onClick={() => setShowPresetManager(true)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <FolderOpen className="w-3 h-3" />
                                Load Preset
                            </button>
                            <button
                                onClick={() => setShowSavePresetModal(true)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Save className="w-3 h-3" />
                                Save as New
                            </button>
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

                        <div className="flex justify-end items-center gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">Generating</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={personaCount}
                                    onChange={e => setPersonaCount(parseInt(e.target.value) || 5)}
                                    className="w-16 px-2 py-1 text-xs font-bold text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                                <span className="text-xs font-medium text-gray-600">Personas</span>
                            </div>
                            <button
                                onClick={generatePersonas}
                                disabled={personasLoading || !productDescription.trim()}
                                className="group relative flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
            {(personas.length > 0 || showSavedPersonasModal) && (
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
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSavedPersonasModal(true);
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1.5 mr-2"
                            >
                                <FolderOpen className="w-3.5 h-3.5" />
                                Library
                            </button>
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
                                onSave={(p) => handleSavePersonas([p])}
                                onSaveSelected={(ps) => handleSavePersonas(ps)}
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

                            <div className="flex justify-end items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500">Generating</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={angleCount}
                                        onChange={e => setAngleCount(parseInt(e.target.value) || 3)}
                                        className="w-16 px-2 py-1 text-xs font-bold text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    />
                                    <span className="text-xs font-medium text-gray-600">Angles</span>
                                </div>
                                <button
                                    onClick={generateAngles}
                                    disabled={anglesLoading || selectedPersonas.length === 0}
                                    className="group relative flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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

                            <div className="grid grid-cols-2 gap-3">
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
                                        <div className="flex items-end justify-between gap-2">
                                            <p className="text-[10px] text-gray-500 flex-1">
                                                <span className="font-medium">Why now:</span> {angle.why_now}
                                            </p>
                                            {angle.prompts && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPromptModal({
                                                            isOpen: true,
                                                            systemPrompt: angle.prompts?.system || '',
                                                            userPrompt: angle.prompts?.user || ''
                                                        });
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer shrink-0"
                                                    title="View Generation Prompt"
                                                >
                                                    <Code className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                        </div>
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
                                {adCopies.map((adCopy, index) => (
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
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {adCopy.angle_names.slice(0, 1).map((angleName, idx) => (
                                                        <span key={idx} className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                                                            {angleName.length > 40 ? angleName.slice(0, 40) + '...' : angleName}
                                                        </span>
                                                    ))}
                                                </div>
                                                {adCopy.prompts && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPromptModal({
                                                                isOpen: true,
                                                                systemPrompt: adCopy.prompts?.system || '',
                                                                userPrompt: adCopy.prompts?.user || ''
                                                            });
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                        title="View Generation Prompt"
                                                    >
                                                        <Code className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-800 leading-relaxed line-clamp-6">
                                                {adCopy.copy}
                                            </p>
                                        </div>

                                        {/* Select Button */}
                                        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const newSelected = !adCopy.selected;
                                                    const newItems = [...adCopies];
                                                    newItems[index] = { ...adCopy, selected: newSelected };
                                                    setAdCopies(newItems);
                                                }}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                                                    adCopy.selected
                                                        ? "bg-green-600 text-white hover:bg-green-700"
                                                        : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                                                )}
                                            >
                                                {adCopy.selected ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                                {adCopy.selected ? 'Selected' : 'Select'}
                                            </button>

                                            {/* Preview Full Copy */}
                                            <button
                                                onClick={() => setPreviewModal({
                                                    isOpen: true,
                                                    copy: adCopy.copy,
                                                    angleName: adCopy.angle_names[0] || 'Ad Copy'
                                                })}
                                                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                                title="Preview Full Copy"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )
            }

            {/* Export Button - Only show when ad copies exist */}
            {
                adCopies.length > 0 && selectedAdCopies.length > 0 && (
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
                )
            }

            {/* Save Preset Modal */}
            {
                showSavePresetModal && (
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
                )
            }

            {/* Preset Manager Modal */}
            <PresetManagerModal
                isOpen={showPresetManager}
                onClose={() => setShowPresetManager(false)}
                presets={presets}
                projects={projects}
                subprojects={subprojects}
                users={users}
                onLoad={loadPreset}
                onDelete={handleDeletePreset}
                onRename={handleRenamePreset}
            />

            {/* AI Auto-Fill Modal */}
            {
                showAutoFillModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">Auto-Fill</h2>
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
                )
            }

            {/* Preview Full Copy Modal */}
            {
                previewModal.isOpen && (
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
                )
            }

            {/* Progress Toast */}
            {
                progressStatus && (
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
                )
            }

            {/* Prompt Viewer Modal */}
            {
                promptModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                        <Code className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">Generation Prompts</h2>
                                </div>
                                <button
                                    onClick={() => setPromptModal({ ...promptModal, isOpen: false })}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                            <UserIcon className="w-4 h-4" />
                                            User Prompt
                                        </h3>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(promptModal.userPrompt)}
                                            className="text-xs text-blue-600 hover:underline"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                                        {promptModal.userPrompt}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            System Prompt
                                        </h3>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(promptModal.systemPrompt)}
                                            className="text-xs text-blue-600 hover:underline"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                                        {promptModal.systemPrompt}
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                                <button
                                    onClick={() => setPromptModal({ ...promptModal, isOpen: false })}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Saved Personas Modal */}
            <SavedPersonasModal
                isOpen={showSavedPersonasModal}
                onClose={() => setShowSavedPersonasModal(false)}
                onLoadPersonas={(loadedPersonas) => {
                    setPersonas(prev => [...prev, ...loadedPersonas]);
                    setPersonasExpanded(true);
                    setProductExpanded(false);
                }}
            />
        </div >
    );
}
