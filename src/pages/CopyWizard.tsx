import { useState, useEffect, useMemo } from 'react';
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
    Eye,
    MessageCircle,
    History,
    RotateCcw,
    ThumbsUp,
    ThumbsDown,
    Library,
} from 'lucide-react';
import { DataTable, type ColumnDef } from '../components/datatable';
import { useDataTableConfig } from '../hooks/useDataTableConfig';
import { createCampaignParamColumns, generateColorMap, COLUMN_WIDTH_DEFAULTS } from '../lib/datatable-defaults';
import {
    getProjects,
    getSubprojects,
    createAdCopy,
    getUsers,
    // CopyLibrary tables (single source of truth)
    createCampaignParameter,
    getCampaignParameters,
    updateCampaignParameter,
    deleteCampaignParameter,
    updateRefinementHistory,
    clearRefinementHistory,
    createAIPersonasBatch,
    createAIAnglesBatch,
    createAIGeneratedAdsBatch,
    getAIPersonas,
    getAIAngles,
    getAIGeneratedAds,
    getPersonaFrameworks,
    type Project,
    type Subproject,
    type Persona,
    type User,
    type CampaignParameter,
    type RefinementRound,
    type AIPersona,
    type AIAngle,
    type AIGeneratedAd,
    type PersonaFramework,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { cn } from '../utils/cn';
import { PersonaSelector } from '../components/PersonaSelector';
import { AIProgressToast, type ProgressStep } from '../components/AIProgressToast';
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
    title: string;
    systemPrompt: string;
    userPrompt: string;
    model: string;
}

export function CopyWizard() {
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // Color maps for project/subproject columns
    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(subprojects), [subprojects]);

    // Campaign parameters from CopyLibrary (single source of truth)
    const [campaignParams, setCampaignParams] = useState<CampaignParameter[]>([]);
    const [showSavePresetModal, setShowSavePresetModal] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    // Persona Frameworks from CopyLibrary
    const [personaFrameworks, setPersonaFrameworks] = useState<PersonaFramework[]>([]);
    const [personaFrameworksExpanded, setPersonaFrameworksExpanded] = useState(false);
    const [selectedPersonaFrameworkId, setSelectedPersonaFrameworkId] = useState<string | null>(null);

    const [showSavedPersonasModal, setShowSavedPersonasModal] = useState(false);
    const [showAnglesLibrary, setShowAnglesLibrary] = useState(false);
    const [showAdCopiesLibrary, setShowAdCopiesLibrary] = useState(false);
    const [libraryAngles, setLibraryAngles] = useState<AIAngle[]>([]);
    const [libraryAdCopies, setLibraryAdCopies] = useState<AIGeneratedAd[]>([]);

    // Prompt viewer modal state
    const [promptModal, setPromptModal] = useState<PromptModal>({
        isOpen: false,
        title: '',
        systemPrompt: '',
        userPrompt: '',
        model: ''
    });

    const handleSavePersonas = async (personasToSave: Persona[]) => {
        try {
            // Save to ai_personas table (CopyLibrary)
            const personasData = personasToSave.map(p => ({
                content: JSON.stringify(p), // Store full persona data as JSON
                campaign_parameter_id: null, // Optional link to campaign
                project_id: null,
                subproject_id: null,
                created_by: currentUserId,
                prompts: personasPrompts ? {
                    system: personasPrompts.system,
                    user: personasPrompts.user,
                    model: personasPrompts.model
                } : null
            }));

            await createAIPersonasBatch(personasData);
            alert(`Successfully saved ${personasToSave.length} persona${personasToSave.length > 1 ? 's' : ''} to Copy Library!`);
        } catch (error) {
            console.error('Failed to save personas:', error);
            alert('Failed to save personas to library.');
        }
    };

    const handleSaveAngles = async (anglesToSave: Angle[]) => {
        try {
            // Save to ai_angles table (CopyLibrary)
            const anglesData = anglesToSave.map(a => ({
                content: JSON.stringify(a), // Store full angle data as JSON
                campaign_parameter_id: null,
                persona_id: null,
                creative_concept_id: null,
                project_id: null,
                subproject_id: null,
                created_by: currentUserId,
                prompts: anglesPrompts ? {
                    system: anglesPrompts.system,
                    user: anglesPrompts.user,
                    model: anglesPrompts.model
                } : null
            }));

            await createAIAnglesBatch(anglesData);
            alert(`Successfully saved ${anglesToSave.length} angle${anglesToSave.length > 1 ? 's' : ''} to Copy Library!`);
        } catch (error) {
            console.error('Failed to save angles:', error);
            alert('Failed to save angles to library.');
        }
    };

    const handleSaveAdCopies = async (adsToSave: AdCopyItem[]) => {
        try {
            // Save to ai_generated_ads table (CopyLibrary)
            const adsData = adsToSave.map(ad => ({
                content: ad.copy, // AdCopyItem uses 'copy' not 'content'
                ad_type: 'FB Ad Text',
                campaign_parameter_id: null,
                persona_id: null,
                angle_id: null,
                creative_concept_id: null,
                project_id: null,
                subproject_id: null,
                created_by: currentUserId,
                prompts: adCopiesPrompts ? {
                    system: adCopiesPrompts.system,
                    user: adCopiesPrompts.user,
                    model: adCopiesPrompts.model
                } : null
            }));

            await createAIGeneratedAdsBatch(adsData);
            alert(`Successfully saved ${adsToSave.length} ad cop${adsToSave.length > 1 ? 'ies' : 'y'} to Copy Library!`);
        } catch (error) {
            console.error('Failed to save ad copies:', error);
            alert('Failed to save ad copies to library.');
        }
    };

    // Load from CopyLibrary functions
    const loadAnglesFromLibrary = async () => {
        try {
            const anglesFromDb = await getAIAngles();
            setLibraryAngles(anglesFromDb);
            setShowAnglesLibrary(true);
        } catch (error) {
            console.error('Failed to load angles from library:', error);
            alert('Failed to load angles from library.');
        }
    };

    const loadAdCopiesFromLibrary = async () => {
        try {
            const adsFromDb = await getAIGeneratedAds();
            setLibraryAdCopies(adsFromDb);
            setShowAdCopiesLibrary(true);
        } catch (error) {
            console.error('Failed to load ad copies from library:', error);
            alert('Failed to load ad copies from library.');
        }
    };

    // Import selected library items into current session
    const importLibraryAngles = (selectedAngles: AIAngle[]) => {
        const convertedAngles: Angle[] = selectedAngles.map(a => {
            // Try to parse stored JSON content, or create a basic angle
            try {
                const parsed = JSON.parse(a.content);
                return {
                    ...parsed,
                    id: a.id,
                    selected: true,
                };
            } catch {
                return {
                    id: a.id,
                    angle: a.content,
                    persona_id: 'library',
                    persona_name: 'From Library',
                    pain_point: '',
                    why_now: '',
                    selected: true,
                };
            }
        });
        setAngles(prev => [...prev, ...convertedAngles]);
        setShowAnglesLibrary(false);
        setAnglesExpanded(true);
    };

    const importLibraryAdCopies = (selectedAds: AIGeneratedAd[]) => {
        const convertedAds: AdCopyItem[] = selectedAds.map(ad => ({
            id: ad.id,
            copy: ad.content,
            angle_ids: ['library'],
            angle_names: ['From Library'],
            selected: true,
        }));
        setAdCopies(prev => [...prev, ...convertedAds]);
        setShowAdCopiesLibrary(false);
        setAdCopiesExpanded(true);
    };

    // Auto-fill state
    const [showAutoFillModal, setShowAutoFillModal] = useState(false);
    const [autoFillBrief, setAutoFillBrief] = useState('');
    const [autoFillWordCount, setAutoFillWordCount] = useState(100);
    const [autoFillLoading, setAutoFillLoading] = useState(false);
    const [autoFillRowId, setAutoFillRowId] = useState<string | null>(null);

    // Model Selection - persist to localStorage
    const MODEL_STORAGE_KEY = 'copy-wizard-selected-model';
    const [selectedModel, setSelectedModel] = useState<AIModel>(() => {
        const saved = localStorage.getItem(MODEL_STORAGE_KEY);
        const validModels: AIModel[] = ['claude-sonnet-4.5', 'claude-opus-4.5', 'claude-haiku-4.5', 'gpt', 'gemini'];
        if (saved && validModels.includes(saved as AIModel)) {
            return saved as AIModel;
        }
        return 'claude-sonnet-4.5';
    });

    // Save model selection to localStorage when it changes
    useEffect(() => {
        localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    }, [selectedModel]);

    // Helper to get model display name
    const getModelDisplayName = (model: AIModel): string => {
        const names: Record<AIModel, string> = {
            'claude-sonnet-4.5': 'Claude Sonnet 4.5',
            'claude-opus-4.5': 'Claude Opus 4.5',
            'claude-haiku-4.5': 'Claude Haiku 4.5',
            'gpt': 'GPT-4o',
            'gemini': 'Gemini 1.5 Pro'
        };
        return names[model] || model;
    };

    // Step 1: Product Info & Project Selection
    const [productDescription, setProductDescription] = useState('');
    const [personaInput, setPersonaInput] = useState('');
    const [swipeFiles, setSwipeFiles] = useState('');
    const [productCustomPrompt, setProductCustomPrompt] = useState('');
    const [productExpanded, setProductExpanded] = useState(true);

    // Step 3: Personas
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [personaCount, setPersonaCount] = useState(6); // How many personas to generate
    const [personasCustomPrompt, setPersonasCustomPrompt] = useState('');
    const [personasLoading, setPersonasLoading] = useState(false);
    const [personasExpanded, setPersonasExpanded] = useState(false);
    // Iterative refinement state (persisted in campaign_parameters.refinement_history)
    const [personaHistory, setPersonaHistory] = useState<RefinementRound[]>([]);
    const [personaFeedback, setPersonaFeedback] = useState('');
    const [showPersonaContext, setShowPersonaContext] = useState(false);
    const [selectedCampaignParamId, setSelectedCampaignParamId] = useState<string | null>(null);
    // Liked/disliked personas for context building (by persona id)
    const [likedPersonaIds, setLikedPersonaIds] = useState<Set<string>>(new Set());
    const [dislikedPersonaIds, setDislikedPersonaIds] = useState<Set<string>>(new Set());

    // Step 4: Angles
    const [angles, setAngles] = useState<Angle[]>([]);
    const [angleCount, setAngleCount] = useState(10); // How many total angles to generate
    const [anglesCustomPrompt, setAnglesCustomPrompt] = useState('');
    const [anglesLoading, setAnglesLoading] = useState(false);
    const [anglesExpanded, setAnglesExpanded] = useState(false);

    // Step 5: Ad Copies
    const [adCopies, setAdCopies] = useState<AdCopyItem[]>([]);
    const [adCopiesCount, setAdCopiesCount] = useState(10);
    const [adCopyType, setAdCopyType] = useState<'FB Ad Text' | 'FB Ad Headline' | 'Video Transcript (Only Voice)' | 'Video Ad Script'>('FB Ad Text');
    // const [adCopiesCustomPrompt, setAdCopiesCustomPrompt] = useState(''); // TODO: Add custom prompt input
    const [adCopiesLoading, setAdCopiesLoading] = useState(false);
    const [adCopiesExpanded, setAdCopiesExpanded] = useState(false);

    // Step 6: Export
    const [exportLoading, setExportLoading] = useState(false);

    // Preview Modal
    const [previewModal, setPreviewModal] = useState<PreviewModal>({ isOpen: false, copy: '', angleName: '' });

    // Last generation prompts for each section
    const [personasPrompts, setPersonasPrompts] = useState<{ system: string; user: string; model: string } | null>(null);
    const [anglesPrompts, setAnglesPrompts] = useState<{ system: string; user: string; model: string } | null>(null);
    const [adCopiesPrompts, setAdCopiesPrompts] = useState<{ system: string; user: string; model: string } | null>(null);

    // Progress Toast
    const [progressMessage, setProgressMessage] = useState('');
    const [progressStatus, setProgressStatus] = useState<'loading' | 'success' | 'error' | null>(null);
    const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
    const [liveOutput, setLiveOutput] = useState('');

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

            const [projectsData, subprojectsData, campaignParamsData, personaFrameworksData, usersData] = await Promise.all([
                getProjects(),
                getSubprojects(),
                getCampaignParameters(), // Load from CopyLibrary (single source of truth)
                getPersonaFrameworks(),
                getUsers()
            ]);
            setProjects(projectsData);
            setSubprojects(subprojectsData);
            setCampaignParams(campaignParamsData);
            setPersonaFrameworks(personaFrameworksData);
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

        if (!selectedProjectId) {
            alert('Please select a project before saving');
            return;
        }

        try {
            // Save to campaign_parameters table (CopyLibrary - single source of truth)
            const newCampaignParam = await createCampaignParameter({
                name: newPresetName,
                description: productDescription,
                persona_input: personaInput || null,
                swipe_files: swipeFiles || null,
                custom_prompt: productCustomPrompt || null,
                key_qualifying_criteria: null,
                offer_flow: null,
                proof_points: null,
                primary_objections: null,
                project_id: selectedProjectId,
                subproject_id: selectedSubprojectId || null,
                created_by: currentUserId,
                refinement_history: null,
            });

            setCampaignParams(prev => [...prev, newCampaignParam]);
            setShowSavePresetModal(false);
            setNewPresetName('');
            alert('Campaign parameters saved to Copy Library!');
        } catch (error) {
            console.error('Failed to save preset:', error);
            alert('Failed to save preset. Please try again.');
        }
    };

    // Open auto-fill modal for a specific row
    const openAutoFillModal = (row: CampaignParameter) => {
        setAutoFillRowId(row.id);
        setAutoFillBrief(row.name || ''); // Pre-fill with row name if available
        setShowAutoFillModal(true);
    };

    // Auto-fill product info for the selected row using modal inputs
    const handleAutoFill = async () => {
        if (!autoFillBrief.trim()) {
            alert('Please enter a service/product description');
            return;
        }

        if (!autoFillRowId) {
            alert('No row selected');
            return;
        }

        setAutoFillLoading(true);
        setProgressMessage(`Auto-filling...`);
        setProgressStatus('loading');

        try {
            const result = await AI.autoFillProductInfo({
                model: selectedModel,
                briefDescription: autoFillBrief,
                maxWordsPerSection: autoFillWordCount
            });

            // Update the row columns directly in the database
            await handleCampaignParamUpdate(autoFillRowId, 'description', result.productDescription);
            await handleCampaignParamUpdate(autoFillRowId, 'persona_input', result.personaInput);
            await handleCampaignParamUpdate(autoFillRowId, 'swipe_files', result.swipeFiles);
            await handleCampaignParamUpdate(autoFillRowId, 'custom_prompt', result.productCustomPrompt);

            // Match and update project/subproject if found
            if (result.suggestedProjectName) {
                const matchingProject = projects.find(p =>
                    p.name.toLowerCase().includes(result.suggestedProjectName!.toLowerCase()) ||
                    result.suggestedProjectName!.toLowerCase().includes(p.name.toLowerCase())
                );
                if (matchingProject) {
                    await handleCampaignParamUpdate(autoFillRowId, 'project_id', matchingProject.id);

                    if (result.suggestedSubprojectName) {
                        const matchingSubproject = subprojects.find(s =>
                            s.project_id === matchingProject.id &&
                            (s.name.toLowerCase().includes(result.suggestedSubprojectName!.toLowerCase()) ||
                                result.suggestedSubprojectName!.toLowerCase().includes(s.name.toLowerCase()))
                        );
                        if (matchingSubproject) {
                            await handleCampaignParamUpdate(autoFillRowId, 'subproject_id', matchingSubproject.id);
                        }
                    }
                }
            }

            setShowAutoFillModal(false);
            setAutoFillBrief('');
            setAutoFillRowId(null);
            setProgressMessage('Auto-Fill Complete!');
            setProgressStatus('success');
        } catch (error) {
            console.error('Failed to auto-fill:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setProgressMessage(`Auto-Fill Failed: ${errorMessage}`);
            setProgressStatus('error');
        } finally {
            setAutoFillLoading(false);
        }
    };

    // Selection helpers
    const selectedPersonas = personas.filter(p => p.selected);
    const selectedAngles = angles.filter(a => a.selected);
    const selectedAdCopies = adCopies.filter(a => a.selected);

    // Liked/disliked persona objects for context display
    const likedPersonas = personas.filter(p => likedPersonaIds.has(p.id));
    const dislikedPersonas = personas.filter(p => dislikedPersonaIds.has(p.id));

    // Derive selected campaign and its project/subproject from selectedCampaignParamId
    const selectedCampaign = useMemo(() => {
        if (!selectedCampaignParamId) return null;
        return campaignParams.find(c => c.id === selectedCampaignParamId) || null;
    }, [selectedCampaignParamId, campaignParams]);

    const selectedProjectId = selectedCampaign?.project_id || null;
    const selectedSubprojectId = selectedCampaign?.subproject_id || null;

    // DataTable configuration with persistence
    const dataTableConfig = useDataTableConfig({
        viewId: 'ai-copy-campaigns',
        userId: currentUserId,
        projects,
        subprojects,
        users,
    });

    // Campaign parameter columns for DataTable - using shared definition
    const campaignColumns = useMemo(() => createCampaignParamColumns({
        projects,
        subprojects,
        users,
        projectColorMap,
        subprojectColorMap,
        autoFillColumn: {
            key: 'auto_fill',
            header: 'Auto-Fill',
            type: 'custom',
            width: 90,
            minWidth: 90,
            render: (_value: unknown, row: CampaignParameter) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        openAutoFillModal(row);
                    }}
                    disabled={autoFillLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Sparkles className="w-3 h-3" />
                    Fill
                </button>
            ),
        },
    }), [projects, subprojects, users, projectColorMap, subprojectColorMap, autoFillLoading]);

    // Create new campaign parameter
    const handleCreateCampaignParam = async (defaults?: Record<string, unknown>): Promise<CampaignParameter> => {
        const newParam = await createCampaignParameter({
            name: 'New Campaign',
            description: '',
            persona_input: null,
            swipe_files: null,
            custom_prompt: null,
            key_qualifying_criteria: null,
            offer_flow: null,
            proof_points: null,
            primary_objections: null,
            project_id: (defaults?.project_id as string) || null,
            subproject_id: (defaults?.subproject_id as string) || null,
            created_by: currentUserId,
            refinement_history: null,
        });
        setCampaignParams(prev => [newParam, ...prev]);
        return newParam;
    };

    // Update campaign parameter
    const handleCampaignParamUpdate = async (id: string, field: string, value: unknown) => {
        await updateCampaignParameter(id, { [field]: value });
        setCampaignParams(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    // Delete campaign parameter
    const handleCampaignParamDelete = async (id: string) => {
        await deleteCampaignParameter(id);
        setCampaignParams(prev => prev.filter(c => c.id !== id));
        // Clear selection if deleted row was selected
        if (selectedCampaignParamId === id) {
            handleRowSelect(null);
        }
    };

    // Handle single-select row click - load campaign data immediately
    const handleRowSelect = (id: string | null) => {
        if (!id) {
            // Deselected - clear the form
            setSelectedCampaignParamId(null);
            setProductDescription('');
            setPersonaInput('');
            setSwipeFiles('');
            setProductCustomPrompt('');
            setPersonaHistory([]);
            return;
        }

        const campaign = campaignParams.find(c => c.id === id);
        if (!campaign) return;

        setProductDescription(campaign.description || '');
        setPersonaInput(campaign.persona_input || '');
        setSwipeFiles(campaign.swipe_files || '');
        setProductCustomPrompt(campaign.custom_prompt || '');
        setSelectedCampaignParamId(campaign.id);

        // Load refinement history if it exists
        if (campaign.refinement_history?.personas) {
            setPersonaHistory(campaign.refinement_history.personas);
        } else {
            setPersonaHistory([]);
        }
    };

    // Toggle liked/disliked for personas
    const togglePersonaLiked = (id: string) => {
        setLikedPersonaIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
                // Remove from disliked if adding to liked
                setDislikedPersonaIds(d => {
                    const nd = new Set(d);
                    nd.delete(id);
                    return nd;
                });
            }
            return next;
        });
    };

    const togglePersonaDisliked = (id: string) => {
        setDislikedPersonaIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
                // Remove from liked if adding to disliked
                setLikedPersonaIds(l => {
                    const nl = new Set(l);
                    nl.delete(id);
                    return nl;
                });
            }
            return next;
        });
    };

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
    const generatePersonas = async (withFeedback = false) => {
        // Validate required fields
        if (!productDescription.trim()) {
            alert('⚠️ Please enter a Product/Service Description first');
            return;
        }
        if (!selectedProjectId) {
            alert('⚠️ Please select a Project before generating personas');
            return;
        }

        // Build comprehensive feedback from: liked, disliked, and text feedback
        const feedbackParts: string[] = [];

        if (likedPersonas.length > 0) {
            const likedNames = likedPersonas.map(p => `"${p.name}"`).join(', ');
            feedbackParts.push(`Generate MORE personas like these (I liked them): ${likedNames}. Keep similar tone, specificity, and emotional depth.`);
        }

        if (dislikedPersonas.length > 0) {
            const dislikedNames = dislikedPersonas.map(p => `"${p.name}"`).join(', ');
            feedbackParts.push(`Generate LESS personas like these (I didn't like them): ${dislikedNames}. Avoid similar styles, tones, or approaches.`);
        }

        if (personaFeedback.trim()) {
            feedbackParts.push(`Additional instructions: ${personaFeedback.trim()}`);
        }

        const combinedFeedback = feedbackParts.join('\n\n');
        const hasAnyFeedback = combinedFeedback.length > 0;

        // If regenerating with feedback, save current state to history first
        if (withFeedback && personas.length > 0 && hasAnyFeedback) {
            const newRound: RefinementRound = {
                timestamp: new Date().toISOString(),
                output: personas.map(p => ({ name: p.name, description: p.description || '' })),
                feedback: combinedFeedback
            };
            const updatedHistory = [...personaHistory, newRound];
            setPersonaHistory(updatedHistory);

            // Save to database if we have a campaign parameter selected
            if (selectedCampaignParamId) {
                try {
                    await updateRefinementHistory(selectedCampaignParamId, 'personas', updatedHistory);
                } catch (err) {
                    console.error('Failed to save refinement history:', err);
                }
            }
        }

        setPersonasLoading(true);
        const isRefinement = withFeedback && (personaHistory.length > 0 || hasAnyFeedback);
        setProgressMessage(isRefinement
            ? `Refining personas based on feedback (Round ${personaHistory.length + 1})...`
            : 'Generating Customer Personas (this can take up to ~1 minute)...');
        setProgressStatus('loading');
        setLiveOutput(`🤖 Model: ${getModelDisplayName(selectedModel)}\n📡 Sending request...\n\n`);
        setProgressSteps([]);

        try {
            // Build history context for refinement
            const historyContext = withFeedback && personaHistory.length > 0
                ? personaHistory.map((round, i) => ({
                    round: i + 1,
                    personas: round.output,
                    feedback: round.feedback || ''
                }))
                : undefined;

            // Include current feedback if regenerating
            const currentFeedback = withFeedback && hasAnyFeedback ? combinedFeedback : undefined;

            const result = await AI.generatePersonas({
                model: selectedModel,
                productDescription,
                personaInput,
                swipeFiles,
                customPrompt: productCustomPrompt,
                personaCount,
                // Marketing context fields from campaign
                keyQualifyingCriteria: selectedCampaign?.key_qualifying_criteria || undefined,
                offerFlow: selectedCampaign?.offer_flow || undefined,
                proofPoints: selectedCampaign?.proof_points || undefined,
                primaryObjections: selectedCampaign?.primary_objections || undefined,
                // Pass history for refinement
                history: historyContext,
                currentFeedback
            });

            // Store prompts for viewing
            setPersonasPrompts({ system: result.systemPrompt, user: result.userPrompt, model: result.model });

            // Show the response with model confirmation
            setLiveOutput(prev => prev + `✅ Response from ${getModelDisplayName(result.model as AIModel)}\n📦 Received ${result.data.length} personas!\n\n` + JSON.stringify(result.data, null, 2));

            await new Promise(resolve => setTimeout(resolve, 1500));

            setPersonas(result.data);
            setPersonasExpanded(true);
            setProductExpanded(false);
            setProgressMessage(`Successfully generated ${result.data.length} personas!`);
            setProgressStatus('success');
            setLiveOutput('');

            // Clear feedback and liked/disliked after successful regeneration
            if (withFeedback) {
                setPersonaFeedback('');
                setLikedPersonaIds(new Set());
                setDislikedPersonaIds(new Set());
            }
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

    // Clear persona history and start fresh
    const clearPersonaHistory = async () => {
        setPersonaHistory([]);
        setPersonaFeedback('');
        setPersonas([]);
        setPersonasPrompts(null);
        setLikedPersonaIds(new Set());
        setDislikedPersonaIds(new Set());

        // Clear from database if we have a campaign parameter selected
        if (selectedCampaignParamId) {
            try {
                await clearRefinementHistory(selectedCampaignParamId, 'personas');
            } catch (err) {
                console.error('Failed to clear refinement history:', err);
            }
        }
    };


    const generateAngles = async () => {
        if (!productDescription.trim()) {
            alert('Please enter a product description first');
            return;
        }

        setAnglesLoading(true);
        setProgressMessage('Generating Marketing Angles');
        setProgressStatus('loading');
        setLiveOutput(`🤖 Model: ${getModelDisplayName(selectedModel)}\n📡 Sending request...\n\n`);
        setProgressSteps([]);

        try {
            const result = await AI.generateAngles({
                model: selectedModel,
                personas: selectedPersonas,
                productDescription,
                angleCount: angleCount,
                customPrompt: anglesCustomPrompt,
                // Marketing context fields from campaign
                keyQualifyingCriteria: selectedCampaign?.key_qualifying_criteria || undefined,
                offerFlow: selectedCampaign?.offer_flow || undefined,
                proofPoints: selectedCampaign?.proof_points || undefined,
                primaryObjections: selectedCampaign?.primary_objections || undefined,
            });

            // Store prompts for viewing
            setAnglesPrompts({ system: result.systemPrompt, user: result.userPrompt, model: result.model });

            setLiveOutput(prev => prev + `✅ Response from ${getModelDisplayName(result.model as AIModel)}\n📦 Received ${result.data.length} angles!\n\n` + JSON.stringify(result.data, null, 2));
            await new Promise(resolve => setTimeout(resolve, 1500));

            setAngles(result.data);
            setAnglesExpanded(true);
            setPersonasExpanded(false);
            setProgressMessage(`Successfully generated ${result.data.length} marketing angles!`);
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
        if (!productDescription.trim()) {
            alert('Please enter a product description first');
            return;
        }

        setAdCopiesLoading(true);
        setProgressMessage('Writing Ad Copies');
        setProgressStatus('loading');
        setLiveOutput(`🤖 Model: ${getModelDisplayName(selectedModel)}\n📡 Sending request...\n\n`);
        setProgressSteps([]);

        try {
            const result = await AI.generateAdCopies({
                model: selectedModel,
                angles: selectedAngles,
                productDescription,
                count: adCopiesCount,
                adCopyType: adCopyType,
                customPrompt: anglesCustomPrompt,
                // Marketing context fields from campaign
                keyQualifyingCriteria: selectedCampaign?.key_qualifying_criteria || undefined,
                offerFlow: selectedCampaign?.offer_flow || undefined,
                proofPoints: selectedCampaign?.proof_points || undefined,
                primaryObjections: selectedCampaign?.primary_objections || undefined,
            });

            // Store prompts for viewing
            setAdCopiesPrompts({ system: result.systemPrompt, user: result.userPrompt, model: result.model });

            setLiveOutput(prev => prev + `✅ Response from ${getModelDisplayName(result.model as AIModel)}\n📦 Received ${result.data.length} ad copies!\n\n` + JSON.stringify(result.data, null, 2));
            await new Promise(resolve => setTimeout(resolve, 1500));

            setAdCopies(result.data);
            setAdCopiesExpanded(true);
            setAnglesExpanded(false);
            setProgressMessage(`Successfully generated ${result.data.length} ad copies!`);
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
        <div className="flex flex-col gap-2 sm:gap-3 bg-gray-50 h-full overflow-y-auto p-2 sm:p-4 pb-8">
            {/* Header with Model Selector */}
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span>Copy Wizard</span>
                    </h2>
                    {/* Model Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">Model:</span>
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value as AIModel)}
                            className="px-2 py-1 text-xs font-medium border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                        >
                            <optgroup label="Claude">
                                <option value="claude-sonnet-4.5">Sonnet 4.5</option>
                                <option value="claude-opus-4.5">Opus 4.5</option>
                                <option value="claude-haiku-4.5">Haiku 4.5</option>
                            </optgroup>
                            <optgroup label="OpenAI">
                                <option value="gpt">GPT-4o</option>
                            </optgroup>
                            <optgroup label="Google">
                                <option value="gemini">Gemini 1.5</option>
                            </optgroup>
                        </select>
                    </div>
                </div>
            </div>

            {/* Step 1: Product Info */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <button
                    onClick={() => setProductExpanded(!productExpanded)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            1
                        </div>
                        <div className="text-left min-w-0">
                            <h3 className="text-base font-semibold text-gray-900">Campaign Parameters</h3>
                            <p className="text-xs text-gray-500 truncate sm:whitespace-normal">Describe your product/service, select project, and set preferences</p>
                        </div>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-gray-400 flex-shrink-0 transition-transform", productExpanded && "rotate-180")} />
                </button>

                {productExpanded && (
                    <div className="p-3 sm:p-4 pt-0 space-y-3 border-t border-gray-100">
                        {/* Campaign Parameters DataTable */}
                        <div>
                            <DataTable
                                columns={campaignColumns}
                                data={campaignParams}
                                getRowId={(row) => row.id}
                                onUpdate={handleCampaignParamUpdate}
                                onDelete={handleCampaignParamDelete}
                                onCreateRow={handleCreateCampaignParam}
                                // Single-select mode: click row to use it
                                singleSelect
                                selectedRowId={selectedCampaignParamId}
                                onRowSelect={handleRowSelect}
                                emptyMessage="No campaign parameters yet. Click + to create one."
                                // Inline props (not fullPage since embedded in accordion)
                                {...dataTableConfig.inlineProps}
                                maxHeight="400px"
                                // View persistence
                                viewId="ai-copy-campaigns"
                                userId={currentUserId || undefined}
                                initialPreferences={dataTableConfig.userPreferences || undefined}
                                sharedPreferences={dataTableConfig.sharedPreferences || undefined}
                                onPreferencesChange={dataTableConfig.handlePreferencesChange}
                                onSaveForEveryone={(prefs) => dataTableConfig.handleSaveForEveryone(prefs, campaignParams.map(c => c.id))}
                                onResetPreferences={dataTableConfig.handleResetPreferences}
                                // Quick filters
                                quickFilters={['project_id', 'subproject_id']}
                            />
                        </div>

                        {/* Selected Campaign Details */}
                        {selectedCampaign && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                    <Check className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-semibold text-green-800">
                                        #{selectedCampaign.row_number || '—'}
                                    </span>
                                    {selectedProjectId && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                                            {projects.find(p => p.id === selectedProjectId)?.name}
                                        </span>
                                    )}
                                    {selectedCampaign.subproject_id && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                                            {subprojects.find(s => s.id === selectedCampaign.subproject_id)?.name}
                                        </span>
                                    )}
                                </div>
                                <div className="columns-1 md:columns-2 gap-3 text-sm">
                                    {selectedCampaign.description?.trim() && (
                                        <div className="bg-white/60 rounded-md p-2.5 mb-3 break-inside-avoid">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Product/Service</div>
                                            <div className="text-gray-700 whitespace-pre-wrap">{selectedCampaign.description}</div>
                                        </div>
                                    )}
                                    {selectedCampaign.persona_input?.trim() && (
                                        <div className="bg-white/60 rounded-md p-2.5 mb-3 break-inside-avoid">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Target Audience</div>
                                            <div className="text-gray-700 whitespace-pre-wrap">{selectedCampaign.persona_input}</div>
                                        </div>
                                    )}
                                    {selectedCampaign.key_qualifying_criteria?.trim() && (
                                        <div className="bg-white/60 rounded-md p-2.5 mb-3 break-inside-avoid">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Key Qualifying Criteria</div>
                                            <div className="text-gray-700 whitespace-pre-wrap">{selectedCampaign.key_qualifying_criteria}</div>
                                        </div>
                                    )}
                                    {selectedCampaign.offer_flow?.trim() && (
                                        <div className="bg-white/60 rounded-md p-2.5 mb-3 break-inside-avoid">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Offer Flow</div>
                                            <div className="text-gray-700 whitespace-pre-wrap">{selectedCampaign.offer_flow}</div>
                                        </div>
                                    )}
                                    {selectedCampaign.proof_points?.trim() && (
                                        <div className="bg-white/60 rounded-md p-2.5 mb-3 break-inside-avoid">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Proof Points</div>
                                            <div className="text-gray-700 whitespace-pre-wrap">{selectedCampaign.proof_points}</div>
                                        </div>
                                    )}
                                    {selectedCampaign.primary_objections?.trim() && (
                                        <div className="bg-white/60 rounded-md p-2.5 mb-3 break-inside-avoid">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Primary Objections</div>
                                            <div className="text-gray-700 whitespace-pre-wrap">{selectedCampaign.primary_objections}</div>
                                        </div>
                                    )}
                                    {selectedCampaign.swipe_files?.trim() && (
                                        <div className="bg-white/60 rounded-md p-2.5 mb-3 break-inside-avoid">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Swipe File/Winner Ad</div>
                                            <div className="text-gray-700 whitespace-pre-wrap">{selectedCampaign.swipe_files}</div>
                                        </div>
                                    )}
                                    {selectedCampaign.custom_prompt?.trim() && (
                                        <div className="bg-white/60 rounded-md p-2.5 mb-3 break-inside-avoid">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Custom Prompt</div>
                                            <div className="text-gray-700 whitespace-pre-wrap">{selectedCampaign.custom_prompt}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Generate Personas Controls */}
                        <div className="flex flex-col sm:flex-row justify-center sm:justify-end items-center gap-3 sm:gap-4 pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500">Generating</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={personaCount}
                                    onChange={e => setPersonaCount(parseInt(e.target.value) || 5)}
                                    className="w-16 px-2 py-1.5 text-sm font-bold text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                                <span className="text-sm font-medium text-gray-600">Personas</span>
                            </div>
                            <button
                                onClick={() => generatePersonas()}
                                disabled={personasLoading || !productDescription.trim()}
                                className="group relative flex items-center gap-2 px-5 sm:px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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

            {/* Step 2: Persona Frameworks */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <button
                    onClick={() => setPersonaFrameworksExpanded(!personaFrameworksExpanded)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            2
                        </div>
                        <div className="text-left min-w-0">
                            <h3 className="text-base font-semibold text-gray-900">Persona Frameworks</h3>
                            <p className="text-xs text-gray-500">
                                {selectedPersonaFrameworkId ? 'Framework selected' : 'Select a persona framework to guide generation'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {selectedPersonaFrameworkId && (
                            <span className="hidden sm:inline px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-medium rounded">
                                1 selected
                            </span>
                        )}
                        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", personaFrameworksExpanded && "rotate-180")} />
                    </div>
                </button>

                {personaFrameworksExpanded && (
                    <div className="p-3 sm:p-4 pt-0 space-y-3 border-t border-gray-100">
                        {/* Persona Frameworks List */}
                        {personaFrameworks.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                                <Library className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">No persona frameworks yet.</p>
                                <p className="text-xs text-gray-400 mt-1">Create frameworks in the Persona Frameworks page.</p>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {personaFrameworks.map(framework => (
                                    <button
                                        key={framework.id}
                                        onClick={() => setSelectedPersonaFrameworkId(
                                            selectedPersonaFrameworkId === framework.id ? null : framework.id
                                        )}
                                        className={cn(
                                            "w-full text-left p-3 rounded-lg border transition-all",
                                            selectedPersonaFrameworkId === framework.id
                                                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-400">#{framework.row_number || '—'}</span>
                                                    <span className="font-medium text-gray-900 truncate">{framework.title}</span>
                                                </div>
                                                {framework.content && (
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{framework.content}</p>
                                                )}
                                            </div>
                                            {selectedPersonaFrameworkId === framework.id && (
                                                <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Selected Framework Preview */}
                        {selectedPersonaFrameworkId && (
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Check className="w-4 h-4 text-indigo-600" />
                                    <span className="text-sm font-semibold text-indigo-800">Selected Framework</span>
                                </div>
                                {(() => {
                                    const selectedFramework = personaFrameworks.find(f => f.id === selectedPersonaFrameworkId);
                                    return selectedFramework ? (
                                        <div className="text-sm">
                                            <div className="font-medium text-gray-900 mb-1">{selectedFramework.title}</div>
                                            {selectedFramework.content && (
                                                <div className="text-gray-700 whitespace-pre-wrap text-xs">{selectedFramework.content}</div>
                                            )}
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Step 3: Personas - Always visible */}
            <div className="bg-white border border-gray-200 rounded-lg">
                    <button
                        onClick={() => setPersonasExpanded(!personasExpanded)}
                        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                3
                            </div>
                            <div className="text-left min-w-0">
                                <h3 className="text-base font-semibold text-gray-900">Select Personas</h3>
                                <p className="text-xs text-gray-500">
                                    {selectedPersonas.length} of {personas.length} selected
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            {personasPrompts && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPromptModal({
                                            isOpen: true,
                                            title: 'Personas Generation',
                                            systemPrompt: personasPrompts.system,
                                            userPrompt: personasPrompts.user,
                                            model: getModelDisplayName(personasPrompts.model as any)
                                        });
                                    }}
                                    className="p-1.5 sm:px-2 sm:py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                                    title="View prompts used"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSavedPersonasModal(true);
                                }}
                                className="px-2 sm:px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1 sm:gap-1.5"
                            >
                                <FolderOpen className="w-4 h-4" />
                                <span className="hidden sm:inline">Library</span>
                            </button>
                            {selectedPersonas.length > 0 && (
                                <span className="hidden sm:inline px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-medium rounded">
                                    {selectedPersonas.length} selected
                                </span>
                            )}
                            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", personasExpanded && "rotate-180")} />
                        </div>
                    </button>

                    {personasExpanded && (
                        <div className="p-3 sm:p-4 pt-0 space-y-3 border-t border-gray-100">
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
                                hasPrompts={!!personasPrompts}
                                onViewPrompts={() => {
                                    if (personasPrompts) {
                                        setPromptModal({
                                            isOpen: true,
                                            title: 'Personas Generation',
                                            systemPrompt: personasPrompts.system,
                                            userPrompt: personasPrompts.user,
                                            model: getModelDisplayName(personasPrompts.model as AIModel)
                                        });
                                    }
                                }}
                                likedIds={likedPersonaIds}
                                dislikedIds={dislikedPersonaIds}
                                onToggleLiked={togglePersonaLiked}
                                onToggleDisliked={togglePersonaDisliked}
                            />

                            {/* Iterative Refinement Section - Only show after first generation */}
                            {personas.length > 0 && (
                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <MessageCircle className="w-4 h-4 text-purple-600" />
                                            <span className="text-sm font-medium text-purple-900">Refine Results</span>
                                            {personaHistory.length > 0 && (
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded-full">
                                                    {personaHistory.length} round{personaHistory.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                        {personaHistory.length > 0 && (
                                            <button
                                                onClick={clearPersonaHistory}
                                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Clear history and start fresh"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                Clear History
                                            </button>
                                        )}
                                    </div>

                                    {/* Liked/Disliked tags display */}
                                    {(likedPersonas.length > 0 || dislikedPersonas.length > 0) && (
                                        <div className="flex flex-wrap gap-2">
                                            {likedPersonas.map(p => (
                                                <span
                                                    key={p.id}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full cursor-pointer hover:bg-green-200"
                                                    onClick={() => togglePersonaLiked(p.id)}
                                                    title="Click to remove from liked"
                                                >
                                                    <ThumbsUp className="w-3 h-3" />
                                                    {p.name}
                                                    <X className="w-3 h-3 hover:text-green-900" />
                                                </span>
                                            ))}
                                            {dislikedPersonas.map(p => (
                                                <span
                                                    key={p.id}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full cursor-pointer hover:bg-red-200"
                                                    onClick={() => togglePersonaDisliked(p.id)}
                                                    title="Click to remove from disliked"
                                                >
                                                    <ThumbsDown className="w-3 h-3" />
                                                    {p.name}
                                                    <X className="w-3 h-3 hover:text-red-900" />
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <textarea
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-y bg-white"
                                        placeholder="Additional feedback (optional)..."
                                        value={personaFeedback}
                                        onChange={e => setPersonaFeedback(e.target.value)}
                                    />

                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <button
                                            onClick={() => setShowPersonaContext(!showPersonaContext)}
                                            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
                                        >
                                            <History className="w-3 h-3" />
                                            {showPersonaContext ? 'Hide' : 'Show'} Context
                                            <ChevronDown className={cn("w-3 h-3 transition-transform", showPersonaContext && "rotate-180")} />
                                        </button>

                                        <button
                                            onClick={() => generatePersonas(true)}
                                            disabled={personasLoading || (likedPersonas.length === 0 && dislikedPersonas.length === 0 && !personaFeedback.trim())}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {personasLoading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Refining...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Regenerate with Feedback</span>
                                                    <span className="sm:hidden">Refine</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Context Preview Panel */}
                                    {showPersonaContext && (
                                        <div className="mt-2 p-3 bg-white border border-purple-100 rounded-lg text-xs text-gray-600 max-h-60 overflow-y-auto">
                                            <div className="font-medium text-gray-800 mb-2">Context that will be sent to AI:</div>

                                            {/* Previous rounds */}
                                            {personaHistory.length > 0 && (
                                                <div className="space-y-2 mb-3">
                                                    {personaHistory.map((round, i) => (
                                                        <div key={i} className="border-l-2 border-purple-300 pl-2">
                                                            <div className="font-medium text-purple-700">
                                                                Round {i + 1}
                                                                <span className="font-normal text-gray-400 ml-2">
                                                                    {new Date(round.timestamp).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="text-gray-500">
                                                                Generated: {round.output.map(p => p.name).join(', ')}
                                                            </div>
                                                            {round.feedback && (
                                                                <div className="text-purple-600 mt-1 whitespace-pre-wrap">
                                                                    {round.feedback}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Current feedback to be applied */}
                                            {(likedPersonas.length > 0 || dislikedPersonas.length > 0 || personaFeedback) ? (
                                                <div className="border-l-2 border-blue-400 pl-2 bg-blue-50 py-1 space-y-1">
                                                    <div className="font-medium text-blue-700">Next Round Feedback (will be applied):</div>
                                                    {likedPersonas.length > 0 && (
                                                        <div className="flex items-center gap-1 text-green-600">
                                                            <ThumbsUp className="w-3 h-3" />
                                                            More like: {likedPersonas.map(p => p.name).join(', ')}
                                                        </div>
                                                    )}
                                                    {dislikedPersonas.length > 0 && (
                                                        <div className="flex items-center gap-1 text-red-600">
                                                            <ThumbsDown className="w-3 h-3" />
                                                            Less like: {dislikedPersonas.map(p => p.name).join(', ')}
                                                        </div>
                                                    )}
                                                    {personaFeedback && (
                                                        <div className="text-blue-600">
                                                            Additional: "{personaFeedback}"
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-gray-500 italic">
                                                    {personaHistory.length === 0
                                                        ? 'No feedback yet. Use 👍/👎 on personas above, or type feedback below.'
                                                        : 'Add more feedback using 👍/👎 or the text field above.'}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Custom Prompt for Angles (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
                                    placeholder="E.g., Focus on safety and confidentiality..."
                                    value={personasCustomPrompt}
                                    onChange={e => setPersonasCustomPrompt(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-gray-500">Generating</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={angleCount}
                                        onChange={e => setAngleCount(parseInt(e.target.value) || 3)}
                                        className="w-16 px-2 py-1.5 text-sm font-bold text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    />
                                    <span className="text-sm font-medium text-gray-600">Angles</span>
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

            {/* Step 4: Angles - Always visible */}
            <div className="bg-white border border-gray-200 rounded-lg">
                    <button
                        onClick={() => setAnglesExpanded(!anglesExpanded)}
                        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                4
                            </div>
                            <div className="text-left min-w-0">
                                <h3 className="text-base font-semibold text-gray-900">Select Angles</h3>
                                <p className="text-xs text-gray-500">
                                    {selectedAngles.length} of {angles.length} selected
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            {anglesPrompts && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPromptModal({
                                            isOpen: true,
                                            title: 'Angles Generation',
                                            systemPrompt: anglesPrompts.system,
                                            userPrompt: anglesPrompts.user,
                                            model: getModelDisplayName(anglesPrompts.model as any)
                                        });
                                    }}
                                    className="p-1.5 sm:px-2 sm:py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                                    title="View prompts used"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    loadAnglesFromLibrary();
                                }}
                                className="px-2 sm:px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors flex items-center gap-1 sm:gap-1.5"
                            >
                                <FolderOpen className="w-4 h-4" />
                                <span className="hidden sm:inline">Library</span>
                            </button>
                            {selectedAngles.length > 0 && (
                                <span className="hidden sm:inline px-2 py-1 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                                    {selectedAngles.length} selected
                                </span>
                            )}
                            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", anglesExpanded && "rotate-180")} />
                        </div>
                    </button>

                    {anglesExpanded && (
                        <div className="p-3 sm:p-4 pt-0 space-y-3 border-t border-gray-100">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllAngles}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        onClick={selectNoneAngles}
                                        className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                                    >
                                        Clear
                                    </button>
                                    {selectedAngles.length > 0 && (
                                        <>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                onClick={() => handleSaveAngles(selectedAngles)}
                                                className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                                            >
                                                <Save className="w-3.5 h-3.5" />
                                                Save Selected
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                            <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                                From: {angle.persona_name.split(',')[0]}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-1 pr-6">{angle.angle}</h4>
                                        <p className="text-xs text-gray-600 mb-1">
                                            <span className="font-medium">Pain:</span> {angle.pain_point}
                                        </p>
                                        <div className="flex items-end justify-between gap-2">
                                            <p className="text-xs text-gray-500 flex-1">
                                                <span className="font-medium">Why now:</span> {angle.why_now}
                                            </p>
                                            {angle.prompts && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPromptModal({
                                                            isOpen: true,
                                                            title: 'Angle Generation',
                                                            systemPrompt: angle.prompts?.system || '',
                                                            userPrompt: angle.prompts?.user || '',
                                                            model: anglesPrompts?.model || 'Unknown'
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Type of Ad Copy
                                </label>
                                <select
                                    value={adCopyType}
                                    onChange={e => setAdCopyType(e.target.value as typeof adCopyType)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                                >
                                    <option value="FB Ad Text">FB Ad Text</option>
                                    <option value="FB Ad Headline">FB Ad Headline</option>
                                    <option value="Video Transcript (Only Voice)">Video Transcript (Only Voice)</option>
                                    <option value="Video Ad Script">Video Ad Script</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Ad Copies to Generate
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={adCopiesCount}
                                        onChange={e => setAdCopiesCount(parseInt(e.target.value) || 5)}
                                        className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Custom Prompt (Optional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
                                        placeholder="E.g., Keep under 125 characters, include emoji..."
                                        value={anglesCustomPrompt}
                                        onChange={e => setAnglesCustomPrompt(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={generateAdCopies}
                                    disabled={adCopiesLoading || !productDescription.trim()}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Step 5: Ad Copies - Always visible */}
            <div className="bg-white border border-gray-200 rounded-lg">
                    <button
                        onClick={() => setAdCopiesExpanded(!adCopiesExpanded)}
                        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                5
                            </div>
                            <div className="text-left min-w-0">
                                <h3 className="text-base font-semibold text-gray-900">Select Ad Copies</h3>
                                <p className="text-xs text-gray-500">
                                    {selectedAdCopies.length} of {adCopies.length} selected for export
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            {adCopiesPrompts && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPromptModal({
                                            isOpen: true,
                                            title: 'Ad Copies Generation',
                                            systemPrompt: adCopiesPrompts.system,
                                            userPrompt: adCopiesPrompts.user,
                                            model: getModelDisplayName(adCopiesPrompts.model as any)
                                        });
                                    }}
                                    className="p-1.5 sm:px-2 sm:py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                                    title="View prompts used"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    loadAdCopiesFromLibrary();
                                }}
                                className="px-2 sm:px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors flex items-center gap-1 sm:gap-1.5"
                            >
                                <FolderOpen className="w-4 h-4" />
                                <span className="hidden sm:inline">Library</span>
                            </button>
                            {selectedAdCopies.length > 0 && (
                                <span className="hidden sm:inline px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-medium rounded">
                                    {selectedAdCopies.length} selected
                                </span>
                            )}
                            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", adCopiesExpanded && "rotate-180")} />
                        </div>
                    </button>

                    {adCopiesExpanded && (
                        <div className="p-3 sm:p-4 pt-0 space-y-3 border-t border-gray-100">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllAdCopies}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        onClick={selectNoneAdCopies}
                                        className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                                    >
                                        Clear
                                    </button>
                                    {selectedAdCopies.length > 0 && (
                                        <>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                onClick={() => handleSaveAdCopies(selectedAdCopies)}
                                                className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                                            >
                                                <Save className="w-3.5 h-3.5" />
                                                Save Selected
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                                                                title: 'Ad Copy Generation',
                                                                systemPrompt: adCopy.prompts?.system || '',
                                                                userPrompt: adCopy.prompts?.user || '',
                                                                model: adCopiesPrompts?.model || 'Unknown'
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

            {/* Export Button - Only show when ad copies exist */}
            {
                adCopies.length > 0 && selectedAdCopies.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Ready to Export</h3>
                                <p className="text-xs text-gray-500">
                                    {selectedAdCopies.length} ad {selectedAdCopies.length === 1 ? 'copy' : 'copies'} selected
                                    {selectedProjectId && ` • Will be saved to: ${projects.find(p => p.id === selectedProjectId)?.name}`}
                                    {selectedSubprojectId && ` / ${subprojects.find(s => s.id === selectedSubprojectId)?.name}`}
                                </p>
                            </div>
                            <button
                                onClick={handleExport}
                                disabled={exportLoading || !selectedProjectId}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Auto-Fill Modal */}
            {showAutoFillModal && (
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
                                    setAutoFillRowId(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Service/Product Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={autoFillBrief}
                                    onChange={e => setAutoFillBrief(e.target.value)}
                                    placeholder="E.g., A meal delivery service for busy professionals who want healthy, chef-prepared meals delivered to their door..."
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-y"
                                    rows={4}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Words per Section
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="50"
                                        max="300"
                                        step="25"
                                        value={autoFillWordCount}
                                        onChange={e => setAutoFillWordCount(parseInt(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="text-sm font-medium text-gray-700 w-16 text-right">
                                        ~{autoFillWordCount}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Approximate word count for each generated field
                                </p>
                            </div>

                            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 text-xs text-gray-700">
                                <p className="font-medium mb-1">AI will generate:</p>
                                <ul className="list-disc list-inside space-y-0.5 ml-1 text-gray-600">
                                    <li>Product/Service description</li>
                                    <li>Target Audience</li>
                                    <li>Swipe Files (headline examples)</li>
                                    <li>Custom Prompt suggestions</li>
                                </ul>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAutoFillModal(false);
                                        setAutoFillBrief('');
                                        setAutoFillRowId(null);
                                    }}
                                    disabled={autoFillLoading}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
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
                                            Generate
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">{promptModal.title || 'Generation Prompts'}</h2>
                                        {promptModal.model && (
                                            <span className="text-xs text-gray-500">Model: {promptModal.model}</span>
                                        )}
                                    </div>
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
                onLoadPersonas={(loadedPersonas, prompts) => {
                    setPersonas(prev => [...prev, ...loadedPersonas]);
                    setPersonasExpanded(true);
                    setProductExpanded(false);
                    // Set prompts if available from library
                    if (prompts) {
                        setPersonasPrompts({ system: prompts.system, user: prompts.user, model: prompts.model });
                    }
                }}
            />

            {/* Angles Library Modal */}
            {showAnglesLibrary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-bold text-gray-900">Load Angles from Library</h2>
                            <button onClick={() => setShowAnglesLibrary(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {libraryAngles.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-8">No angles saved in library yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {libraryAngles.map(angle => (
                                        <div
                                            key={angle.id}
                                            onClick={() => importLibraryAngles([angle])}
                                            className="p-3 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 cursor-pointer transition-colors"
                                        >
                                            <p className="text-sm text-gray-900 line-clamp-2">{angle.content}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Created: {new Date(angle.created_at || '').toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button
                                onClick={() => setShowAnglesLibrary(false)}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => importLibraryAngles(libraryAngles)}
                                disabled={libraryAngles.length === 0}
                                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                Import All ({libraryAngles.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ad Copies Library Modal */}
            {showAdCopiesLibrary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-bold text-gray-900">Load Ad Copies from Library</h2>
                            <button onClick={() => setShowAdCopiesLibrary(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {libraryAdCopies.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-8">No ad copies saved in library yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {libraryAdCopies.map(ad => (
                                        <div
                                            key={ad.id}
                                            onClick={() => importLibraryAdCopies([ad])}
                                            className="p-3 border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-300 cursor-pointer transition-colors"
                                        >
                                            <p className="text-sm text-gray-900 line-clamp-3">{ad.content}</p>
                                            <div className="flex gap-2 mt-1">
                                                {ad.ad_type && (
                                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{ad.ad_type}</span>
                                                )}
                                                <span className="text-xs text-gray-500">
                                                    Created: {new Date(ad.created_at || '').toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button
                                onClick={() => setShowAdCopiesLibrary(false)}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => importLibraryAdCopies(libraryAdCopies)}
                                disabled={libraryAdCopies.length === 0}
                                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                            >
                                Import All ({libraryAdCopies.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
