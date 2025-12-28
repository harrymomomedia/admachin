import { useState, useEffect, useMemo } from 'react';
import { DataTable, type ColumnDef } from '../components/datatable';
import { DataTablePageLayout } from '../components/DataTablePageLayout';
import { Eye, Code, X, FileText, User as UserIcon } from 'lucide-react';
import {
    generateColorMap,
    createIdColumn,
    createProjectColumn,
    createSubprojectColumn,
    createUserColumn,
    createRowHandler,
    createUpdateHandler,
    createDeleteHandler,
    DEFAULT_DATATABLE_PROPS,
    DEFAULT_QUICK_FILTERS,
} from '../lib/datatable-defaults';
import {
    getAIAngles,
    getProjects,
    getSubprojects,
    getUsers,
    createAIAngle,
    updateAIAngle,
    deleteAIAngle,
    type AIAngle,
    type AIPrompts,
    type Project,
    type Subproject,
    type User,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';

interface PromptModal {
    isOpen: boolean;
    title: string;
    prompts: AIPrompts | null;
}

export function AIAngles() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AIAngle[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [promptModal, setPromptModal] = useState<PromptModal>({
        isOpen: false,
        title: '',
        prompts: null
    });

    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(subprojects), [subprojects]);

    useEffect(() => {
        loadData();
        getCurrentUser().then(user => setCurrentUserId(user?.id || null));
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [dataResult, projectsResult, subprojectsResult, usersResult] = await Promise.all([
                getAIAngles(),
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

    const renderPromptsButton = (prompts: AIPrompts | null) => {
        if (!prompts) return <span className="text-gray-400 text-xs">-</span>;
        return (
            <button
                onClick={() => setPromptModal({ isOpen: true, title: 'Angle Generation', prompts })}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="View prompts"
            >
                <Eye className="w-4 h-4" />
            </button>
        );
    };

    const columns: ColumnDef<AIAngle>[] = [
        createIdColumn<AIAngle>(),
        { key: 'content', header: 'Content', editable: true, type: 'longtext', width: 500 },
        createProjectColumn<AIAngle>({ projects, subprojects, projectColorMap }),
        createSubprojectColumn<AIAngle>({ projects, subprojects, subprojectColorMap }),
        { key: 'rich_text', header: 'Rich Text', editable: true, type: 'blocknoteeditor', width: 300, minWidth: 200 },
        {
            key: 'prompts',
            header: 'Prompts',
            width: 80,
            type: 'custom',
            render: (_value: unknown, row: AIAngle) => renderPromptsButton(row.prompts)
        },
        createUserColumn<AIAngle>(users, { key: 'created_by', editable: false }),
        { key: 'created_at', header: 'Created', type: 'date', width: 120 },
    ];

    const handleUpdate = useMemo(() => createUpdateHandler<AIAngle>({
        updateFn: updateAIAngle,
        setData,
    }), []);

    const handleDelete = useMemo(() => createDeleteHandler<AIAngle>({
        deleteFn: deleteAIAngle,
        setData,
        confirmMessage: false,
    }), []);

    const handleCreateRow = useMemo(() => createRowHandler<AIAngle>({
        createFn: createAIAngle,
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
                title="Angles"
                emptyMessage="No angles saved yet. Click + to create one!"
                getRowId={(row) => row.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateRow={handleCreateRow}
                quickFilters={[...DEFAULT_QUICK_FILTERS]}
                viewId="ai-angles"
                {...DEFAULT_DATATABLE_PROPS}
            />

            {/* Prompt Viewer Modal */}
            {promptModal.isOpen && promptModal.prompts && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <Code className="w-5 h-5 text-gray-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">{promptModal.title}</h2>
                                    <span className="text-xs text-gray-500">Model: {promptModal.prompts.model}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setPromptModal({ isOpen: false, title: '', prompts: null })}
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
                                        onClick={() => navigator.clipboard.writeText(promptModal.prompts!.user)}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                                    {promptModal.prompts.user}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        System Prompt
                                    </h3>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(promptModal.prompts!.system)}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                                    {promptModal.prompts.system}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setPromptModal({ isOpen: false, title: '', prompts: null })}
                                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DataTablePageLayout>
    );
}
