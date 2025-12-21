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
    getUserViewPreferences,
    saveUserViewPreferences,
    deleteUserViewPreferences,
    getSharedViewPreferences,
    saveSharedViewPreferences,
    saveRowOrder,
    type AdCopy,
    type Project,
    type Subproject,
    type User,
    type ViewPreferencesConfig
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { DataTable, type ColumnDef } from '../components/DataTable';

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

    // View preferences state (sort, filter, group, wrap, column_widths, column_order)
    const [userPreferences, setUserPreferences] = useState<ViewPreferencesConfig | null>(null);
    const [sharedPreferences, setSharedPreferences] = useState<ViewPreferencesConfig | null>(null);

    // Column config overrides (for field editor changes - options, colorMaps)
    const [columnConfigs, setColumnConfigs] = useState<Record<string, { options?: { label: string; value: string | number }[]; colorMap?: Record<string, string> }>>({});

    // Handle view preferences change (auto-save per user)
    const handlePreferencesChange = async (preferences: ViewPreferencesConfig) => {
        if (!currentUserId) return;
        try {
            await saveUserViewPreferences(currentUserId, 'ad_copies', preferences);
        } catch (error) {
            console.error('Failed to save view preferences:', error);
        }
    };

    // Handle save for everyone
    const handleSaveForEveryone = async (preferences: ViewPreferencesConfig) => {
        try {
            const rowOrder = copies.map(c => c.id);
            await saveSharedViewPreferences('ad_copies', {
                ...preferences,
                row_order: rowOrder
            });
            setSharedPreferences({
                ...preferences,
                row_order: rowOrder
            });
        } catch (error) {
            console.error('Failed to save shared preferences:', error);
        }
    };

    // Handle reset to shared preferences
    const handleResetPreferences = async () => {
        if (!currentUserId) return;
        try {
            await deleteUserViewPreferences(currentUserId, 'ad_copies');
            setUserPreferences(null);
        } catch (error) {
            console.error('Failed to reset preferences:', error);
        }
    };

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
            const [copiesData, projectsData, subprojectsData, usersData, user, sharedPrefs] = await Promise.all([
                getAdCopies(),
                getProjects(),
                getSubprojects(),
                getUsers(),
                getCurrentUser(),
                getSharedViewPreferences('ad_copies')
            ]);

            // Store shared preferences (including column_widths and column_order)
            if (sharedPrefs) {
                setSharedPreferences({
                    sort_config: sharedPrefs.sort_config,
                    filter_config: sharedPrefs.filter_config,
                    group_config: sharedPrefs.group_config,
                    wrap_config: sharedPrefs.wrap_config,
                    row_order: sharedPrefs.row_order,
                    column_widths: sharedPrefs.column_widths,
                    column_order: sharedPrefs.column_order
                });
            }

            if (user?.id) {
                setCurrentUserId(user.id);
                // Load saved user preferences
                const prefs = await getUserViewPreferences(user.id, 'ad_copies');

                // Store user view preferences (including column_widths and column_order)
                if (prefs) {
                    setUserPreferences({
                        sort_config: prefs.sort_config,
                        filter_config: prefs.filter_config,
                        group_config: prefs.group_config,
                        wrap_config: prefs.wrap_config,
                        row_order: prefs.row_order,
                        column_widths: prefs.column_widths,
                        column_order: prefs.column_order
                    });
                }

                // Load row order (user's or shared)
                const rowOrder = prefs?.row_order || sharedPrefs?.row_order;
                if (rowOrder && rowOrder.length > 0) {
                    // Sort copies based on saved order
                    const orderMap = new Map(rowOrder.map((id, index) => [id, index]));
                    const ordered = [...copiesData].sort((a, b) => {
                        const aIndex = orderMap.get(a.id) ?? Infinity;
                        const bIndex = orderMap.get(b.id) ?? Infinity;
                        return aIndex - bIndex;
                    });
                    setCopies(ordered);
                } else {
                    setCopies(copiesData);
                }
            } else {
                setCopies(copiesData);
            }
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
            const proj = projects.find(p => p.id === value);
            updates.project = proj?.name || null;
            // When project changes, check if current subproject is still valid
            const currentSubprojectId = original.subproject_id;
            if (currentSubprojectId && value) {
                const subBelongsToNewProject = subprojects.some(
                    s => s.id === currentSubprojectId && s.project_id === value
                );
                if (!subBelongsToNewProject) {
                    updates.subproject_id = null;
                }
            } else if (!value) {
                updates.subproject_id = null;
            }
        } else if (field === 'subproject_id') {
            updates.subproject_id = value ? String(value) : null;
            // Auto-set project if subproject's project differs from current
            if (value) {
                const sub = subprojects.find(s => s.id === value);
                if (sub && sub.project_id !== original.project_id) {
                    updates.project_id = sub.project_id;
                    const proj = projects.find(p => p.id === sub.project_id);
                    updates.project = proj?.name || null;
                }
            }
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

    // Color palette for dynamic colorMaps
    const colorPalette = [
        'bg-pink-500 text-white',
        'bg-indigo-500 text-white',
        'bg-cyan-500 text-white',
        'bg-amber-500 text-white',
        'bg-rose-500 text-white',
        'bg-violet-500 text-white',
        'bg-teal-500 text-white',
        'bg-orange-500 text-white',
        'bg-lime-500 text-white',
        'bg-fuchsia-500 text-white',
    ];

    // Generate colorMap for projects
    const projectColorMap = projects.reduce((map, project, index) => {
        map[project.id] = colorPalette[index % colorPalette.length];
        return map;
    }, {} as Record<string, string>);

    // Generate colorMap for subprojects
    const subprojectColorMap = subprojects.reduce((map, subproject, index) => {
        map[subproject.id] = colorPalette[index % colorPalette.length];
        return map;
    }, {} as Record<string, string>);

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
            type: 'textarea',
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
            colorMap: columnConfigs['type']?.colorMap || {
                'primary_text': 'bg-blue-500 text-white',
                'headline': 'bg-purple-500 text-white',
                'description': 'bg-gray-500 text-white',
                'video_ad_script': 'bg-emerald-500 text-white',
            },
        },
        {
            key: 'project_id',
            header: 'Project',
            width: 140,
            minWidth: 100,
            editable: true,
            type: 'select',
            options: projects.map(p => ({ label: p.name, value: p.id })),
            optionsEditable: false, // Options managed by projects table
            fallbackKey: 'project', // Legacy field for old data
            colorMap: columnConfigs['project_id']?.colorMap || projectColorMap,
        },
        {
            key: 'subproject_id',
            header: 'Subproject',
            width: 140,
            minWidth: 100,
            editable: true,
            type: 'select',
            options: (row) => {
                // Show all subprojects if no project selected, otherwise filter by project
                if (!row.project_id) {
                    return subprojects.map(s => ({ label: s.name, value: s.id }));
                }
                return subprojects
                    .filter(s => s.project_id === row.project_id)
                    .map(s => ({
                        label: s.name,
                        value: s.id
                    }));
            },
            filterOptions: subprojects.map(s => ({ label: s.name, value: s.id })),
            colorMap: columnConfigs['subproject_id']?.colorMap || subprojectColorMap,
            dependsOn: {
                parentKey: 'project_id',
                getParentValue: (subprojectId) => {
                    const sub = subprojects.find(s => s.id === subprojectId);
                    return sub?.project_id ?? null;
                },
            },
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
            colorMap: columnConfigs['platform']?.colorMap || {
                'FB': 'bg-teal-500 text-white',
                'IG': 'bg-rose-500 text-white',
                'All': 'bg-indigo-500 text-white',
            },
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
                quickFilters={['project_id', 'subproject_id', 'type']}
                // View persistence (includes sort, filter, group, wrap, column_widths, column_order)
                viewId="ad_copies"
                userId={currentUserId || undefined}
                initialPreferences={userPreferences || undefined}
                sharedPreferences={sharedPreferences || undefined}
                onPreferencesChange={handlePreferencesChange}
                onSaveForEveryone={handleSaveForEveryone}
                onResetPreferences={handleResetPreferences}
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
