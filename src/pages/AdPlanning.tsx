import { useState, useEffect } from 'react';
import { Plus, X, Link as LinkIcon } from 'lucide-react';
import {
    getAdPlans,
    createAdPlan,
    updateAdPlan,
    getProjects,
    getUsers,
    getSubprojects,
    type AdPlan,
    type Project,
    type User,
    type Subproject,
} from '../lib/supabase-service';
import { cn } from '../utils/cn';
import { DataTable, type ColumnDef } from '../components/DataTable';

export function AdPlanning() {
    const [plans, setPlans] = useState<AdPlan[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [groupByColumn, setGroupByColumn] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        project_id: '',
        user_id: '',
        subproject: '',
        plan_type: 'CClone',
        creative_type: 'Video',
        priority: 5,
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
            const [plansData, projectsData, usersData, subprojectsData] = await Promise.all([
                getAdPlans(),
                getProjects(),
                getUsers(),
                getSubprojects(),
            ]);
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
    const handleUpdate = async (id: string, field: string, value: unknown) => {
        const original = plans.find(p => p.id === id);
        if (!original) return;

        // Convert value based on field type
        // Convert value based on field type
        let convertedValue: unknown = value;
        const extraUpdates: Partial<AdPlan> = {};

        if (field === 'priority' || field === 'hj_rating') {
            convertedValue = value ? Number(value) : null;
        } else if (field === 'subproject_id') {
            convertedValue = value ? String(value) : null;
            // Also update text field for compatibility
            const sub = subprojects.find(s => s.id === value);
            if (sub) {
                extraUpdates.subproject = sub.name;
            } else if (value === '' || value === null) {
                extraUpdates.subproject = null;
            }
        } else if (field === 'project_id') {
            // When project changes, check if current subproject is still valid
            convertedValue = value === '' ? null : value;
            const currentSubprojectId = original.subproject_id;
            if (currentSubprojectId && value) {
                // Check if the current subproject belongs to the new project
                const subBelongsToNewProject = subprojects.some(
                    s => s.id === currentSubprojectId && s.project_id === value
                );
                if (!subBelongsToNewProject) {
                    // Clear subproject if it doesn't belong to new project
                    extraUpdates.subproject_id = null;
                    extraUpdates.subproject = null;
                }
            } else if (!value) {
                // If project is cleared, also clear subproject
                extraUpdates.subproject_id = null;
                extraUpdates.subproject = null;
            }
        } else if (field === 'user_id' || field === 'creative_id') {
            // Empty string should be null for foreign keys
            convertedValue = value === '' ? null : value;
        } else if (field === 'spy_url' && typeof value === 'string' && value.trim()) {
            // Auto-prepend https:// if no protocol is present
            const trimmed = value.trim();
            if (!/^https?:\/\//i.test(trimmed)) {
                convertedValue = `https://${trimmed}`;
            }
        }

        const updates: Partial<AdPlan> = { [field]: convertedValue, ...extraUpdates };

        console.log('Updating ad plan:', { id, field, value: convertedValue, updates });

        // Optimistic update
        setPlans(plans.map(p => p.id === id ? { ...p, ...updates } : p));

        try {
            const result = await updateAdPlan(id, updates);
            console.log('Update result:', result);
        } catch (error) {
            console.error('Failed to update plan:', error);
            // Revert on error
            loadData();
        }
    };

    // Reorder Handler
    const handleReorder = (newOrder: string[]) => {
        const reordered = newOrder.map(id => plans.find(p => p.id === id)!).filter(Boolean);
        setPlans(reordered);
        // TODO: Persist order to database if needed
    };

    // Create Handler
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
                creative_type: 'Video', priority: 5, hj_rating: 0, spy_url: '',
                description: '', creative_id: '', reference_creative_id: '', status: 'not started'
            });
        } catch (error) {
            console.error('Failed to create ad plan:', error);
            alert('Failed to create plan.');
        } finally {
            setIsSubmitting(false);
        }
    };


    // Column Definitions
    const columns: ColumnDef<AdPlan>[] = [
        {
            key: 'id_display',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            render: (_, plan, __) => (
                <span className="text-[10px] text-gray-400">{plans.indexOf(plan) + 1}</span>
            ),
        },
        {
            key: 'project_id',
            header: 'Project',
            width: 120,
            minWidth: 80,
            editable: true,
            type: 'select',
            options: projects.map(p => ({ label: p.name, value: p.id })),
            render: (_value, row, isEditing) => {
                if (isEditing) return null; // Use default select in edit mode
                const project = projects.find(p => p.id === row.project_id);
                // @ts-ignore - access legacy field if needed, though AdPlan type doesn't have it explicitly typed as string usually, but row might
                const legacyName = (row as any).project;

                const content = (!project && !row.project_id && legacyName)
                    ? <span className="text-gray-500 italic">{legacyName}</span>
                    : project?.name || '-';

                return (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:ring-1 hover:ring-blue-300 whitespace-nowrap bg-gray-50 text-gray-700 border-gray-200">
                        {content}
                    </span>
                );
            }
        },
        {
            key: 'subproject_id',
            header: 'Subproject',
            width: 140,
            minWidth: 100,
            editable: true,
            type: 'select',
            options: (row) => {
                if (!row.project_id) return [];
                return subprojects
                    .filter(s => s.project_id === row.project_id)
                    .map(s => ({
                        label: s.name,
                        value: s.id
                    }));
            },
            render: (_value, row, isEditing) => {
                if (isEditing) return null;
                const subId = row.subproject_id;
                let content;

                if (subId) {
                    const sub = subprojects.find(s => s.id === subId);
                    content = sub ? sub.name : '-';
                } else {
                    // Fallback to legacy text
                    content = row.subproject ? <span className="text-gray-500 italic">{row.subproject}</span> : '-';
                }

                return (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:ring-1 hover:ring-blue-300 whitespace-nowrap bg-gray-50 text-gray-700 border-gray-200">
                        {content}
                    </span>
                );
            },
        },
        {
            key: 'plan_type',
            header: 'Plan Type',
            width: 90,
            minWidth: 70,
            editable: true,
            type: 'badge',
            options: [
                { label: 'CClone', value: 'CClone' },
                { label: 'Full Ad', value: 'Full Ad' },
                { label: 'Variation', value: 'Variation' },
            ],
            colorMap: {
                'CClone': 'bg-purple-50 text-purple-700 border-purple-200',
                'Full Ad': 'bg-blue-50 text-blue-700 border-blue-200',
                'Variation': 'bg-amber-50 text-amber-700 border-amber-200',
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
                'Video': 'bg-rose-50 text-rose-700 border-rose-200',
                'Image': 'bg-teal-50 text-teal-700 border-teal-200',
            },
        },
        {
            key: 'priority',
            header: 'Pri.',
            width: 50,
            minWidth: 40,
            editable: true,
            type: 'text',
            render: (value) => (
                <span className={cn(
                    "text-xs font-medium",
                    Number(value) >= 8 ? "text-red-600" : Number(value) >= 5 ? "text-orange-500" : "text-gray-600"
                )}>
                    {String(value || '-')}
                </span>
            ),
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
            width: 100,
            minWidth: 80,
            editable: true,
            type: 'select',
            options: users.map(u => ({ label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email, value: u.id })),
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
            type: 'text',
            render: (value, _, isEditing) => {
                if (isEditing) return null; // Let DataTable handle editing
                const urlStr = String(value || '');
                return value ? (
                    <div className="flex items-center gap-1.5 w-full">
                        <span
                            className="text-xs text-gray-700 truncate flex-1 cursor-pointer hover:text-blue-600"
                            title={urlStr}
                        >
                            {urlStr.replace(/^https?:\/\//, '').slice(0, 25)}{urlStr.length > 35 ? '...' : ''}
                        </span>
                        <a
                            href={urlStr}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            title="Open URL"
                        >
                            <LinkIcon className="w-3.5 h-3.5" />
                        </a>
                    </div>
                ) : (
                    <span className="text-gray-400 text-xs">-</span>
                );
            },
        },
        {
            key: 'description',
            header: 'Description',
            width: 200,
            minWidth: 100,
            editable: true,
            type: 'textarea',
        },
        {
            key: 'created_at',
            header: 'Created Time',
            width: 130,
            minWidth: 100,
            editable: false,
            type: 'date',
        },
    ];

    return (
        <div className="h-full flex flex-col gap-2 p-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Ad Planning</h1>
                    <p className="text-xs text-gray-500">Drag rows to reorder. Click cells to edit.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded shadow hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    New Plan
                </button>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={plans}
                isLoading={isLoading}
                emptyMessage="No plans found. Create one to get started!"
                getRowId={(plan) => plan.id}
                onUpdate={handleUpdate}
                sortable={true}
                onReorder={handleReorder}
                resizable={true}
                showRowActions={false}
                fullscreen={true}
                groupByColumn={groupByColumn ?? undefined}
                onGroupByChange={setGroupByColumn}
                groupableColumns={['status', 'project_id', 'plan_type', 'creative_type', 'user_id']}
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                                <select
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subproject</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.subproject}
                                    onChange={e => setFormData({ ...formData, subproject: e.target.value })}
                                    placeholder="e.g. Bathroom"
                                />
                            </div>

                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                                <select
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Creative Type</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.creative_type}
                                    onChange={e => setFormData({ ...formData, creative_type: e.target.value })}
                                >
                                    <option value="Video">Video</option>
                                    <option value="Image">Image</option>
                                </select>
                            </div>

                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priority (1-10)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                />
                            </div>

                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                                <select
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">HJ Rating</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.hj_rating}
                                    onChange={e => setFormData({ ...formData, hj_rating: parseInt(e.target.value) })}
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Spy URL</label>
                                <input
                                    type="url"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.spy_url}
                                    onChange={e => setFormData({ ...formData, spy_url: e.target.value })}
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
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
        </div>
    );
}
