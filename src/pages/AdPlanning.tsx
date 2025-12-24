import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { DataTablePageLayout } from '../components/DataTablePageLayout';
import {
    getAdPlans,
    createAdPlan,
    updateAdPlan,
    getProjects,
    getUsers,
    getSubprojects,
    saveRowOrder,
    type AdPlan,
    type Project,
    type User,
    type Subproject,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { DataTable, type ColumnDef } from '../components/datatable';
import {
    generateColorMap,
    createProjectColumn,
    createSubprojectColumn,
    createRowHandler,
} from '../lib/datatable-defaults';

export function AdPlanning() {
    const [plans, setPlans] = useState<AdPlan[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        project_id: '',
        user_id: '',
        subproject: '',
        plan_type: 'CClone',
        creative_type: 'Video',
        priority: 3,
        hj_rating: 0,
        spy_url: '',
        description: '',
        creative_id: '',
        reference_creative_id: '',
        status: 'not started'
    });

    // Load Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [plansData, projectsData, usersData, subprojectsData, user] = await Promise.all([
                getAdPlans(),
                getProjects(),
                getUsers(),
                getSubprojects(),
                getCurrentUser(),
            ]);

            if (user?.id) {
                setCurrentUserId(user.id);
            }

            setPlans(plansData);
            setProjects(projectsData);
            setUsers(usersData);
            setSubprojects(subprojectsData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };


    // Update Handler
    // NOTE: Project/subproject dependency logic is handled by DataTable's dependsOn config.
    // This handler should only do simple field conversion, not dependency cascades.
    const handleUpdate = async (id: string, field: string, value: unknown) => {
        // Convert value based on field type
        let convertedValue: unknown = value;
        const extraUpdates: Partial<AdPlan> = {};

        if (field === 'priority' || field === 'hj_rating') {
            convertedValue = value ? Number(value) : null;
        } else if (field === 'subproject_id') {
            convertedValue = value ? String(value) : null;
            // Update legacy text field for compatibility
            const sub = subprojects.find(s => s.id === value);
            extraUpdates.subproject = sub?.name || null;
            // NOTE: Auto-setting project_id is handled by DataTable's dependsOn
        } else if (field === 'project_id') {
            convertedValue = value === '' ? null : value;
            // NOTE: Clearing subproject when project changes is handled by DataTable's dependsOn
        } else if (field === 'user_id' || field === 'creative_id') {
            convertedValue = value === '' ? null : value;
        } else if (field === 'spy_url' && typeof value === 'string' && value.trim()) {
            const trimmed = value.trim();
            if (!/^https?:\/\//i.test(trimmed)) {
                convertedValue = `https://${trimmed}`;
            }
        }

        const updates: Partial<AdPlan> = { [field]: convertedValue, ...extraUpdates };

        // Optimistic update - use callback form to avoid stale closure
        setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

        try {
            await updateAdPlan(id, updates);
        } catch (error) {
            console.error('Failed to update plan:', error);
            loadData();
        }
    };

    // Reorder Handler - persists to database
    const handleReorder = async (newOrder: string[]) => {
        const reordered = newOrder.map(id => plans.find(p => p.id === id)!).filter(Boolean);
        setPlans(reordered);

        // Save order to database
        if (currentUserId) {
            try {
                await saveRowOrder(currentUserId, 'ad_planning', newOrder);
            } catch (error) {
                console.error('Failed to save row order:', error);
            }
        }
    };

    // Quick Create Handler (for + button at bottom of table)
    const handleCreateRow = useMemo(() => createRowHandler<AdPlan>({
        createFn: createAdPlan,
        setData: setPlans,
        currentUserId,
        userIdField: 'user_id',
    }), [currentUserId]);

    // Create Handler (for modal form)
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdPlan({
                project_id: formData.project_id,
                user_id: formData.user_id,
                subproject: formData.subproject,
                plan_type: formData.plan_type,
                creative_type: formData.creative_type,
                priority: Number(formData.priority),
                hj_rating: Number(formData.hj_rating),
                spy_url: formData.spy_url,
                description: formData.description,
                status: formData.status,
                creative_id: formData.creative_id || undefined,
                reference_creative_id: formData.reference_creative_id || undefined
            });
            await loadData();
            setIsCreateModalOpen(false);
            setFormData({
                project_id: '', user_id: '', subproject: '', plan_type: 'CClone',
                creative_type: 'Video', priority: 3, hj_rating: 0, spy_url: '',
                description: '', creative_id: '', reference_creative_id: '', status: 'not started'
            });
        } catch (error) {
            console.error('Failed to create ad plan:', error);
            alert('Failed to create plan.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Generate colorMaps using shared utility - memoized to prevent re-renders
    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(subprojects), [subprojects]);

    // Column Definitions - memoized to prevent re-renders on every state change
    const columns: ColumnDef<AdPlan>[] = useMemo(() => [
        {
            key: 'row_number',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            type: 'id',
        },
        createProjectColumn<AdPlan>({ projects, subprojects, projectColorMap }),
        createSubprojectColumn<AdPlan>({ projects, subprojects, subprojectColorMap }),
        {
            key: 'plan_type',
            header: 'Plan Type',
            width: 90,
            minWidth: 70,
            editable: true,
            type: 'select',
            options: [
                { label: 'CClone', value: 'CClone' },
                { label: 'Full Ad', value: 'Full Ad' },
                { label: 'Variation', value: 'Variation' },
            ],
            colorMap: {
                'CClone': 'bg-purple-500 text-white',
                'Full Ad': 'bg-blue-500 text-white',
                'Variation': 'bg-amber-500 text-white',
            },
        },
        {
            key: 'creative_type',
            header: 'Creative',
            width: 90,
            minWidth: 70,
            editable: true,
            type: 'select',
            options: [
                { label: 'Video', value: 'Video' },
                { label: 'Image', value: 'Image' },
            ],
            colorMap: {
                'Video': 'bg-rose-500 text-white',
                'Image': 'bg-teal-500 text-white',
            },
        },
        {
            key: 'priority',
            header: 'Pri.',
            width: 50,
            minWidth: 40,
            editable: true,
            type: 'priority',
            maxPriority: 5,
        },
        {
            key: 'hj_rating',
            header: 'Rat.',
            width: 50,
            minWidth: 40,
            editable: true,
            type: 'text',
        },
        {
            key: 'user_id',
            header: 'Owner',
            width: 120,
            minWidth: 100,
            editable: true,
            type: 'people',
            users: users,
        },
        {
            key: 'status',
            header: 'Status',
            width: 120,
            minWidth: 90,
            editable: true,
            type: 'select',
            options: [
                { label: 'Not Started', value: 'not started' },
                { label: 'Up Next', value: 'up next' },
                { label: 'First Ver Started', value: 'first ver started' },
                { label: 'Completed', value: 'completed' },
            ],
            colorMap: {
                'not started': 'bg-gray-100 text-gray-700 border-gray-200',
                'up next': 'bg-orange-100 text-orange-800 border-orange-200',
                'first ver started': 'bg-blue-100 text-blue-800 border-blue-200',
                'completed': 'bg-green-100 text-green-800 border-green-200',
            },
        },
        {
            key: 'spy_url',
            header: 'Spy URL',
            width: 180,
            minWidth: 120,
            editable: true,
            type: 'url',
        },
        {
            key: 'description',
            header: 'Description',
            width: 200,
            minWidth: 100,
            editable: true,
            type: 'longtext',
        },
        {
            key: 'created_at',
            header: 'Created Time',
            width: 130,
            minWidth: 100,
            editable: false,
            type: 'date',
        },
    ], [projects, subprojects, users, projectColorMap, subprojectColorMap]);

    return (
        <DataTablePageLayout>
            {/* Data Table */}
            <DataTable
                columns={columns}
                data={plans}
                isLoading={isLoading}
                emptyMessage="No plans found. Create one to get started!"
                title="Ad Planning"
                onNewClick={() => setIsCreateModalOpen(true)}
                newButtonLabel="New"
                getRowId={(plan) => plan.id}
                onUpdate={handleUpdate}
                onCreateRow={handleCreateRow}
                sortable={true}
                onReorder={handleReorder}
                resizable={true}
                showRowActions={false}
                fullscreen={true}
                layout="fullPage"
                quickFilters={['project_id', 'subproject_id', 'plan_type']}
                viewId="ad_planning"
            />

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">New Ad Plan</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label htmlFor="plan-project" className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                                <select
                                    id="plan-project"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.project_id}
                                    onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                                >
                                    <option value="">Select Project</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-1">
                                <label htmlFor="plan-subproject" className="block text-sm font-medium text-gray-700 mb-1">Subproject</label>
                                <input
                                    id="plan-subproject"
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.subproject}
                                    onChange={e => setFormData({ ...formData, subproject: e.target.value })}
                                    placeholder="e.g. Bathroom"
                                />
                            </div>

                            <div className="col-span-1">
                                <label htmlFor="plan-type" className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                                <select
                                    id="plan-type"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.plan_type}
                                    onChange={e => setFormData({ ...formData, plan_type: e.target.value })}
                                >
                                    <option value="CClone">CClone</option>
                                    <option value="Full Ad">Full Ad</option>
                                    <option value="Variation">Variation</option>
                                </select>
                            </div>

                            <div className="col-span-1">
                                <label htmlFor="plan-creative-type" className="block text-sm font-medium text-gray-700 mb-1">Creative Type</label>
                                <select
                                    id="plan-creative-type"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.creative_type}
                                    onChange={e => setFormData({ ...formData, creative_type: e.target.value })}
                                >
                                    <option value="Video">Video</option>
                                    <option value="Image">Image</option>
                                </select>
                            </div>

                            <div className="col-span-1">
                                <label htmlFor="plan-priority" className="block text-sm font-medium text-gray-700 mb-1">Priority (1-5)</label>
                                <input
                                    id="plan-priority"
                                    type="number"
                                    min="1"
                                    max="5"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                />
                            </div>

                            <div className="col-span-1">
                                <label htmlFor="plan-owner" className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                                <select
                                    id="plan-owner"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.user_id}
                                    onChange={e => setFormData({ ...formData, user_id: e.target.value })}
                                >
                                    <option value="">Select User</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.first_name || ''} {u.last_name || ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-1">
                                <label htmlFor="plan-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    id="plan-status"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="not started">Not Started</option>
                                    <option value="up next">Up Next</option>
                                    <option value="first ver started">First Ver Started</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>

                            <div className="col-span-1">
                                <label htmlFor="plan-hj-rating" className="block text-sm font-medium text-gray-700 mb-1">HJ Rating</label>
                                <input
                                    id="plan-hj-rating"
                                    type="number"
                                    min="0"
                                    max="10"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.hj_rating}
                                    onChange={e => setFormData({ ...formData, hj_rating: parseInt(e.target.value) })}
                                />
                            </div>

                            <div className="col-span-2">
                                <label htmlFor="plan-spy-url" className="block text-sm font-medium text-gray-700 mb-1">Spy URL</label>
                                <input
                                    id="plan-spy-url"
                                    type="url"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.spy_url}
                                    onChange={e => setFormData({ ...formData, spy_url: e.target.value })}
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="col-span-2">
                                <label htmlFor="plan-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    id="plan-description"
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="What's this plan about?"
                                />
                            </div>

                            <div className="col-span-2 pt-4 flex justify-end gap-3">
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
                                    {isSubmitting ? 'Creating...' : 'Create Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DataTablePageLayout>
    );
}
