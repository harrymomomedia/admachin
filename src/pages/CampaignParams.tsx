import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { DataTable } from '../components/datatable';
import { DataTablePageLayout } from '../components/DataTablePageLayout';
import {
    generateColorMap,
    createCampaignParamColumns,
    createRowHandler,
    DEFAULT_DATATABLE_PROPS,
    DEFAULT_QUICK_FILTERS,
} from '../lib/datatable-defaults';
import {
    getCampaignParameters,
    getProjects,
    getSubprojects,
    getUsers,
    createCampaignParameter,
    updateCampaignParameter,
    deleteCampaignParameter,
    type CampaignParameter,
    type Project,
    type Subproject,
    type User,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import * as AI from '../lib/ai-service';
import type { AIModel } from '../lib/ai-service';

export function CampaignParams() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<CampaignParameter[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Load current user
    useEffect(() => {
        getCurrentUser().then(user => setCurrentUserId(user?.id || null));
    }, []);

    // Auto-fill state
    const [showAutoFillModal, setShowAutoFillModal] = useState(false);
    const [autoFillBrief, setAutoFillBrief] = useState('');
    const [autoFillWordCount, setAutoFillWordCount] = useState(100);
    const [autoFillLoading, setAutoFillLoading] = useState(false);
    const [autoFillRowId, setAutoFillRowId] = useState<string | null>(null);

    // Model selection - persist to localStorage
    const MODEL_STORAGE_KEY = 'campaign-params-selected-model';
    const [selectedModel, setSelectedModel] = useState<AIModel>(() => {
        const saved = localStorage.getItem(MODEL_STORAGE_KEY);
        const validModels: AIModel[] = ['claude-sonnet-4.5', 'claude-opus-4.5', 'claude-haiku-4.5', 'gpt', 'gemini'];
        if (saved && validModels.includes(saved as AIModel)) {
            return saved as AIModel;
        }
        return 'claude-sonnet-4.5';
    });

    useEffect(() => {
        localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    }, [selectedModel]);

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

    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(subprojects), [subprojects]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [dataResult, projectsResult, subprojectsResult, usersResult] = await Promise.all([
                getCampaignParameters(),
                getProjects(),
                getSubprojects(),
                getUsers(),
            ]);
            setData(dataResult);
            setProjects(projectsResult);
            setSubprojects(subprojectsResult);
            setUsers(usersResult);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-fill modal handlers
    const openAutoFillModal = (row: CampaignParameter) => {
        setAutoFillRowId(row.id);
        setAutoFillBrief(row.name || '');
        setShowAutoFillModal(true);
    };

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

        try {
            const result = await AI.autoFillProductInfo({
                model: selectedModel,
                briefDescription: autoFillBrief,
                maxWordsPerSection: autoFillWordCount
            });

            // Update all 7 row columns directly in the database
            await handleUpdate(autoFillRowId, 'description', result.productDescription);
            await handleUpdate(autoFillRowId, 'persona_input', result.personaInput);
            await handleUpdate(autoFillRowId, 'key_qualifying_criteria', result.keyQualifyingCriteria);
            await handleUpdate(autoFillRowId, 'offer_flow', result.offerFlow);
            await handleUpdate(autoFillRowId, 'proof_points', result.proofPoints);
            await handleUpdate(autoFillRowId, 'primary_objections', result.primaryObjections);
            await handleUpdate(autoFillRowId, 'swipe_files', result.swipeFiles);
            // Note: custom_prompt is intentionally NOT updated - left empty by auto-fill

            // Match and update project/subproject if found
            if (result.suggestedProjectName) {
                const matchingProject = projects.find(p =>
                    p.name.toLowerCase().includes(result.suggestedProjectName!.toLowerCase()) ||
                    result.suggestedProjectName!.toLowerCase().includes(p.name.toLowerCase())
                );
                if (matchingProject) {
                    await handleUpdate(autoFillRowId, 'project_id', matchingProject.id);

                    if (result.suggestedSubprojectName) {
                        const matchingSubproject = subprojects.find(s =>
                            s.project_id === matchingProject.id &&
                            (s.name.toLowerCase().includes(result.suggestedSubprojectName!.toLowerCase()) ||
                                result.suggestedSubprojectName!.toLowerCase().includes(s.name.toLowerCase()))
                        );
                        if (matchingSubproject) {
                            await handleUpdate(autoFillRowId, 'subproject_id', matchingSubproject.id);
                        }
                    }
                }
            }

            setShowAutoFillModal(false);
            setAutoFillBrief('');
            setAutoFillRowId(null);
        } catch (error) {
            console.error('Failed to auto-fill:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Auto-Fill Failed: ${errorMessage}`);
        } finally {
            setAutoFillLoading(false);
        }
    };

    // Use shared column definition with auto-fill button
    const columns = useMemo(() => createCampaignParamColumns({
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

    const handleUpdate = async (id: string, field: string, value: unknown) => {
        await updateCampaignParameter(id, { [field]: value });
        setData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleDelete = async (id: string) => {
        await deleteCampaignParameter(id);
        setData(prev => prev.filter(item => item.id !== id));
    };

    const handleCreateRow = useMemo(() => createRowHandler<CampaignParameter>({
        createFn: createCampaignParameter,
        setData,
        currentUserId,
        userIdField: 'created_by',
    }), [currentUserId]);

    return (
        <DataTablePageLayout>
            <DataTable
                columns={columns}
                data={data}
                isLoading={isLoading}
                title="Campaign Parameters"
                emptyMessage="No campaign parameters saved yet. Click + to create one!"
                getRowId={(row) => row.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateRow={handleCreateRow}
                quickFilters={[...DEFAULT_QUICK_FILTERS]}
                viewId="campaign-params"
                {...DEFAULT_DATATABLE_PROPS}
            />

            {/* Auto-Fill Modal */}
            {showAutoFillModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">AI Auto-Fill</h3>
                                    <p className="text-sm text-gray-500">Automatically fill campaign parameters</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAutoFillModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Brief Description
                                </label>
                                <textarea
                                    value={autoFillBrief}
                                    onChange={(e) => setAutoFillBrief(e.target.value)}
                                    placeholder="Describe your product or service in a few sentences..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                    rows={4}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    AI Model
                                </label>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value as AIModel)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="claude-sonnet-4.5">{getModelDisplayName('claude-sonnet-4.5')}</option>
                                    <option value="claude-opus-4.5">{getModelDisplayName('claude-opus-4.5')}</option>
                                    <option value="claude-haiku-4.5">{getModelDisplayName('claude-haiku-4.5')}</option>
                                    <option value="gpt">{getModelDisplayName('gpt')}</option>
                                    <option value="gemini">{getModelDisplayName('gemini')}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Max Words Per Section: {autoFillWordCount}
                                </label>
                                <input
                                    type="range"
                                    min={50}
                                    max={300}
                                    step={25}
                                    value={autoFillWordCount}
                                    onChange={(e) => setAutoFillWordCount(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button
                                onClick={() => setShowAutoFillModal(false)}
                                disabled={autoFillLoading}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
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
                                        Auto-Fill
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DataTablePageLayout>
    );
}
