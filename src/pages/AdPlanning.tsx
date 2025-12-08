import { useState, useEffect } from 'react';
import { Plus, X, Link as LinkIcon } from 'lucide-react';
import {
    getAdPlans,
    createAdPlan,
    updateAdPlan,
    getProjects,
    getUsers,
    getCreatives,
    type AdPlan,
    type Project,
    type User,
    type Creative
} from '../lib/supabase-service';
import { cn } from '../utils/cn';
import { DataTable, type ColumnDef } from '../components/DataTable';

export function AdPlanning() {
    const [plans, setPlans] = useState<AdPlan[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [creatives, setCreatives] = useState<Creative[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            const [plansData, projectsData, usersData, creativesData] = await Promise.all([
                getAdPlans(),
                getProjects(),
                getUsers(),
                getCreatives()
            ]);
            setPlans(plansData);
            setProjects(projectsData);
            setUsers(usersData);
            setCreatives(creativesData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Get helpers
    const getProjectName = (plan: AdPlan) => {
        const project = projects.find(p => p.id === plan.project_id);
        return project?.name || '-';
    };

    const getUserName = (plan: AdPlan) => {
        const user = users.find(u => u.id === plan.user_id);
        return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : '-';
    };

    const getCreativePreview = (plan: AdPlan) => {
        const creative = creatives.find(c => c.id === plan.creative_id);
        return creative?.storage_path || null;
    };

    // Update Handler
    const handleUpdate = async (id: string, field: string, value: unknown) => {
        const original = plans.find(p => p.id === id);
        if (!original) return;

        const updates: Partial<AdPlan> = { [field]: value };

        // Optimistic update
        setPlans(plans.map(p => p.id === id ? { ...p, ...updates } : p));

        try {
            await updateAdPlan(id, updates);
        } catch (error) {
            console.error('Failed to update plan:', error);
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

    // Status color helper
    const getStatusColor = (status: string | null) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800 border-green-200';
            case 'up next': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'first ver started': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
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
            options: [
                { label: '-', value: '' },
                ...projects.map(p => ({ label: p.name, value: p.id })),
            ],
            render: (_, plan) => (
                <span className="text-xs font-medium text-gray-900">{getProjectName(plan)}</span>
            ),
        },
        {
            key: 'subproject',
            header: 'Subproject',
            width: 100,
            minWidth: 60,
            editable: true,
            type: 'text',
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
            key: 'creative_id',
            header: 'Creative',
            width: 80,
            minWidth: 60,
            editable: false,
            render: (_, plan) => {
                const preview = getCreativePreview(plan);
                return preview ? (
                    <img src={preview} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-[8px] text-gray-400">None</span>
                    </div>
                );
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
            options: [
                { label: '-', value: '' },
                ...users.map(u => ({ label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email, value: u.id })),
            ],
            render: (_, plan) => (
                <span className="text-xs text-gray-700">{getUserName(plan)}</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            width: 120,
            minWidth: 90,
            editable: true,
            type: 'badge',
            options: [
                { label: 'Not Started', value: 'not started' },
                { label: 'Up Next', value: 'up next' },
                { label: 'First Ver Started', value: 'first ver started' },
                { label: 'Completed', value: 'completed' },
            ],
            render: (value, _, isEditing) => {
                if (isEditing) return null; // Let default render handle it
                return (
                    <span className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer",
                        getStatusColor(String(value))
                    )}>
                        {value === 'first ver started' ? '1st Ver' : String(value || 'Not Started')}
                    </span>
                );
            },
        },
        {
            key: 'spy_url',
            header: 'Spy URL',
            width: 120,
            minWidth: 80,
            editable: true,
            type: 'text',
            render: (value) => value ? (
                <a
                    href={String(value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                >
                    <LinkIcon className="w-3 h-3" />
                    Link
                </a>
            ) : (
                <span className="text-gray-400 text-xs">-</span>
            ),
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
            header: 'Created',
            width: 100,
            minWidth: 80,
            editable: false,
            type: 'date',
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
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
