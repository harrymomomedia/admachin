import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DataTablePageLayout } from '../components/DataTablePageLayout';
import {
    getAdCopies,
    createAdCopy,
    updateAdCopy,
    deleteAdCopy,
    getProjects,
    getSubprojects,
    getUsers,
    saveRowOrder,
    type AdCopy,
    type Project,
    type Subproject,
    type User,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { DataTable, type ColumnDef } from '../components/datatable';
import {
    generateColorMap,
    createProjectColumn,
    createSubprojectColumn,
    AD_COPY_TYPE_COLORS,
    TRAFFIC_PLATFORM_COLORS,
    COLUMN_WIDTH_DEFAULTS,
} from '../lib/datatable-defaults';

export function AdCopyLibrary() {
    const [copies, setCopies] = useState<AdCopy[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        text: '',
        type: 'primary_text',
        project_id: '',
        project: '',
        platform: 'FB'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Column config overrides (for field editor changes - options, colorMaps)
    const [columnConfigs, setColumnConfigs] = useState<Record<string, { options?: { label: string; value: string | number }[]; colorMap?: Record<string, string> }>>({});

    // Handle column config changes (from field editor)
    const handleColumnConfigChange = (columnKey: string, updates: { options?: { label: string; value: string | number }[]; colorMap?: Record<string, string> }) => {
        setColumnConfigs(prev => ({
            ...prev,
            [columnKey]: {
                ...prev[columnKey],
                ...updates
            }
        }));
    };

    // Load Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [copiesData, projectsData, subprojectsData, usersData, user] = await Promise.all([
                getAdCopies(),
                getProjects(),
                getSubprojects(),
                getUsers(),
                getCurrentUser(),
            ]);

            if (user?.id) {
                setCurrentUserId(user.id);
            }
            setCopies(copiesData);
            setProjects(projectsData);
            setSubprojects(subprojectsData);
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Quick inline row creation (no popup, no refresh)
    // defaults: pre-populated values from active filters
    const handleQuickCreate = async (defaults?: Record<string, unknown>) => {
        // Get project name if project_id is provided in defaults
        let projectName: string | null = null;
        if (defaults?.project_id) {
            const proj = projects.find(p => p.id === defaults.project_id);
            projectName = proj?.name || null;
        }

        // Create row with filter defaults applied
        const newCopy = await createAdCopy({
            text: '',
            type: (defaults?.type as string) || 'primary_text',
            project_id: (defaults?.project_id as string) || null,
            project: projectName,
            subproject_id: (defaults?.subproject_id as string) || null,
            platform: (defaults?.platform as string) || 'FB',
            user_id: currentUserId
        });

        // Optimistic update - add to BOTTOM of list so user can see it
        setCopies(prev => [...prev, newCopy]);

        return newCopy;
    };

    // Update Handler
    // NOTE: Project/subproject dependency logic is handled by DataTable's dependsOn config.
    // This handler should only do simple field conversion, not dependency cascades.
    const handleUpdate = async (id: string, field: string, value: unknown) => {
        const original = copies.find(c => c.id === id);
        if (!original) return;

        const updates: Partial<AdCopy> = {};

        if (field === 'text') {
            updates.text = String(value);
        } else if (field === 'type') {
            updates.type = String(value);
        } else if (field === 'project_id') {
            updates.project_id = value ? String(value) : null;
            // Update legacy text field
            const proj = projects.find(p => p.id === value);
            updates.project = proj?.name || null;
            // NOTE: Clearing subproject is handled by DataTable's dependsOn
        } else if (field === 'subproject_id') {
            updates.subproject_id = value ? String(value) : null;
            // NOTE: Auto-setting project is handled by DataTable's dependsOn
        } else if (field === 'platform') {
            updates.platform = value ? String(value) : null;
        } else if (field === 'user_id') {
            updates.user_id = value ? String(value) : null;
        }

        // Check if we have any updates
        if (Object.keys(updates).length === 0) {
            console.warn('No updates to apply for field:', field);
            return;
        }

        // Optimistic update
        setCopies(prev => prev.map(c =>
            c.id === id ? { ...c, ...updates } : c
        ));

        try {
            await updateAdCopy(id, updates);
        } catch (error) {
            console.error('Failed to update ad copy:', error);
            setCopies(prev => prev.map(c =>
                c.id === id ? original : c
            ));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errorMessage = (error as any)?.message || 'Unknown error';
            alert(`Failed to save changes: ${errorMessage} `);
        }
    };

    // Delete Handler
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this ad copy?')) return;
        try {
            await deleteAdCopy(id);
            setCopies(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error('Failed to delete ad copy:', error);
        }
    };

    // Copy Handler (copy text to clipboard)
    const handleCopy = (copy: AdCopy) => {
        navigator.clipboard.writeText(copy.text);
    };

    // Duplicate Handler (create new row with empty text but same type/project/platform)
    const handleDuplicate = async (copy: AdCopy) => {
        try {
            await createAdCopy({
                user_id: currentUserId, // Set to current user who clicked duplicate
                text: '(new copy)', // Placeholder text - can be edited inline
                type: copy.type,
                project: copy.project,
                project_id: copy.project_id,
                subproject_id: copy.subproject_id,
                platform: copy.platform
            });
            await loadData();
        } catch (error) {
            console.error('Failed to duplicate ad copy:', error);
            const errorMessage = (error as { message?: string })?.message || 'Unknown error';
            alert(`Failed to duplicate row: ${errorMessage} `);
        }
    };

    // Reorder Handler (for drag & drop) - persists to database
    const handleReorder = async (newOrder: string[]) => {
        const reordered = newOrder.map(id => copies.find(c => c.id === id)!).filter(Boolean);
        setCopies(reordered);

        // Save order to database
        if (currentUserId) {
            try {
                await saveRowOrder(currentUserId, 'ad_copies', newOrder);
            } catch (error) {
                console.error('Failed to save row order:', error);
            }
        }
    };

    // Create Handler
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const currentUser = await getCurrentUser();
            const selectedProject = projects.find(p => p.id === formData.project_id);
            const legacyProjectName = selectedProject ? selectedProject.name : '';

            await createAdCopy({
                user_id: currentUser?.id,
                text: formData.text,
                type: formData.type,
                project: legacyProjectName,
                project_id: formData.project_id || null,
                platform: formData.platform
            });
            await loadData();
            setIsCreateModalOpen(false);
            setFormData({ text: '', type: 'primary_text', project_id: '', project: '', platform: 'FB' });
        } catch (error) {
            console.error('Failed to create ad copy:', error);
            alert('Failed to save ad copy. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Generate colorMaps using shared utility
    const projectColorMap = generateColorMap(projects);
    const subprojectColorMap = generateColorMap(subprojects);

    // Column Definitions
    const columns: ColumnDef<AdCopy>[] = [
        {
            key: 'row_number',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            type: 'id',
        },
        {
            key: 'text',
            header: 'Ad Text',
            width: 400,
            minWidth: 150,
            editable: true,
            type: 'longtext',
        },
        {
            key: 'type',
            header: 'Type',
            width: 100,
            minWidth: 80,
            editable: true,
            type: 'select',
            options: columnConfigs['type']?.options || [
                { label: 'Primary', value: 'primary_text' },
                { label: 'Headline', value: 'headline' },
                { label: 'Description', value: 'description' },
                { label: 'Video Ad', value: 'video_ad_script' },
            ],
            colorMap: columnConfigs['type']?.colorMap || AD_COPY_TYPE_COLORS,
        },
        {
            ...createProjectColumn<AdCopy>({ projects, subprojects, projectColorMap }),
            colorMap: columnConfigs['project_id']?.colorMap || projectColorMap,
        },
        {
            ...createSubprojectColumn<AdCopy>({ projects, subprojects, subprojectColorMap }),
            colorMap: columnConfigs['subproject_id']?.colorMap || subprojectColorMap,
        },
        {
            key: 'platform',
            header: 'Traffic',
            width: 80,
            minWidth: 60,
            editable: true,
            type: 'select',
            options: columnConfigs['platform']?.options || [
                { label: 'None', value: '' },
                { label: 'FB', value: 'FB' },
                { label: 'IG', value: 'IG' },
                { label: 'All', value: 'All' },
            ],
            colorMap: columnConfigs['platform']?.colorMap || TRAFFIC_PLATFORM_COLORS,
        },
        {
            key: 'created_at',
            header: 'Created Time',
            width: 140,
            minWidth: 100,
            editable: false,
            type: 'date',
        },
        {
            key: 'user_id',
            header: 'Created By',
            width: 130,
            minWidth: 100,
            editable: true,
            type: 'people',
            users: users,
        },
    ];

    return (
        <DataTablePageLayout>
            {/* Data Table */}
            <DataTable
                columns={columns}
                data={copies}
                isLoading={isLoading}
                emptyMessage="No ad copies found. Create one for your next campaign!"
                title="Ad Text"
                onNewClick={() => setIsCreateModalOpen(true)}
                newButtonLabel="New"
                getRowId={(copy) => copy.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCopy={handleCopy}
                onDuplicate={handleDuplicate}
                onCreateRow={handleQuickCreate}
                sortable={true}
                onReorder={handleReorder}
                resizable={true}
                fullscreen={true}
                layout="fullPage"
                quickFilters={['project_id', 'subproject_id', 'type']}
                viewId="ad_copies"
                // Column config editing (field editor)
                onColumnConfigChange={handleColumnConfigChange}
            />

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">New Ad Copy</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label htmlFor="ad-text" className="block text-sm font-medium text-gray-700 mb-1">
                                    Ad Text <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="ad-text"
                                    required
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                    placeholder="Enter your ad copy text here..."
                                    value={formData.text}
                                    onChange={e => setFormData({ ...formData, text: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="ad-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        id="ad-type"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="primary_text">Primary Text</option>
                                        <option value="headline">Headline</option>
                                        <option value="description">Description</option>
                                        <option value="video_ad_script">Video Ad</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="ad-platform" className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                                    <select
                                        id="ad-platform"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.platform}
                                        onChange={e => setFormData({ ...formData, platform: e.target.value })}
                                    >
                                        <option value="FB">Facebook</option>
                                        <option value="IG">Instagram</option>
                                        <option value="All">All</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="ad-project" className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                                <select
                                    id="ad-project"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.project_id}
                                    onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                                >
                                    <option value="">Select Project</option>
                                    {projects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Ad Copy'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DataTablePageLayout>
    );
}
