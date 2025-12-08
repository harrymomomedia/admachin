import { useState, useEffect } from 'react';
import {
    Plus,
    X,
    Play,
    Link as LinkIcon,
    GripVertical
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

// Sortable Row Component
function SortableRow({ plan, projects, users, creatives, handleUpdate }: {
    plan: AdPlan;
    projects: Project[];
    users: User[];
    creatives: Creative[];
    handleUpdate: (id: string, updates: Partial<AdPlan>) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: plan.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Helper Components
    const EditableSelect = ({ value, options, onChange, className = "" }: { value: string, options: { label: string, value: string }[], onChange: (val: string) => void, className?: string }) => (
        <div className="w-full h-full relative">
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className={`data-grid-select ${className}`}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );

    const EditableText = ({ value, onChange, placeholder = "" }: { value: string | number | null, onChange: (val: string) => void, placeholder?: string }) => {
        const [localValue, setLocalValue] = useState(value);
        useEffect(() => setLocalValue(value), [value]);

        return (
            <input
                type="text"
                value={localValue || ''}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={() => onChange(String(localValue))}
                placeholder={placeholder}
                className="data-grid-input"
            />
        );
    };

    const StatusBadge = ({ status, onChange }: { status: string | null, onChange: (val: string) => void }) => {
        const getColorClass = (s: string | null) => {
            switch (s) {
                case 'completed': return 'status-badge-green';
                case 'up next': return 'status-badge-orange';
                case 'first ver started': return 'status-badge-blue';
                default: return 'status-badge-gray';
            }
        };

        return (
            <div className="w-full h-full flex items-center px-2">
                <div className={`relative ${getColorClass(status)} rounded px-2 py-0.5 text-xs font-medium border flex-shrink-0 cursor-pointer group`}>
                    {status || 'not started'}
                    <select
                        value={status || 'not started'}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    >
                        <option value="not started">Not Started</option>
                        <option value="up next">Up Next</option>
                        <option value="first ver started">First Ver Started</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            </div>
        );
    };

    const CreativeMediaCell = ({ creative, onChange, creatives }: { creative?: Creative, onChange: (id: string) => void, creatives: Creative[] }) => {
        const getPreviewUrl = (c?: Creative) => {
            if (!c) return null;
            if (c.type === 'image') return import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/creatives/${c.storage_path}` : '';
            return null;
        };

        return (
            <div className="relative w-full h-full flex items-center justify-center p-0.5 group cursor-pointer hover:bg-gray-100">
                <select
                    className="absolute inset-0 opacity-0 z-20 cursor-pointer"
                    value={creative?.id || ''}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="">Select Media</option>
                    {creatives.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                {creative ? (
                    <div className="relative w-8 h-8 bg-gray-100 rounded overflow-hidden border border-gray-200">
                        {creative.type === 'video' ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                <Play className="w-3 h-3 text-gray-400 fill-current" />
                            </div>
                        ) : (
                            <img
                                src={getPreviewUrl(creative) || ''}
                                alt="Preview"
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-300 hover:border-gray-400 hover:text-gray-400 transition-colors">
                        <Plus className="w-3 h-3" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <tr ref={setNodeRef} style={style} className="group">
            {/* Drag Handle */}
            <td className="data-grid-td p-0 bg-gray-50/50 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                <div className="flex items-center justify-center h-full text-gray-400 hover:text-gray-600">
                    <GripVertical className="w-4 h-4" />
                </div>
            </td>

            {/* ID */}
            <td className="data-grid-td text-center font-mono text-gray-400 text-[10px] bg-gray-50/50">{plan.ad_number}</td>

            <td className="data-grid-td">
                <EditableSelect
                    value={plan.project_id || ''}
                    options={projects.map(p => ({ label: p.name, value: p.id }))}
                    onChange={(val) => handleUpdate(plan.id, { project_id: val })}
                    className="font-medium text-gray-900"
                />
            </td>

            <td className="data-grid-td">
                <EditableText value={plan.subproject || ''} onChange={(val) => handleUpdate(plan.id, { subproject: val })} />
            </td>

            <td className="data-grid-td p-1">
                <EditableSelect
                    value={plan.plan_type || 'CClone'}
                    options={[{ label: 'CClone', value: 'CClone' }, { label: 'Full Ad', value: 'Full Ad' }, { label: 'Variation', value: 'Variation' }]}
                    onChange={(val) => handleUpdate(plan.id, { plan_type: val })}
                    className="bg-purple-50 text-purple-700 rounded text-[10px] font-medium h-auto py-0.5 px-1.5"
                />
            </td>

            <td className="data-grid-td p-1">
                <EditableSelect
                    value={plan.creative_type || 'Video'}
                    options={[{ label: 'Video', value: 'Video' }, { label: 'Image', value: 'Image' }]}
                    onChange={(val) => handleUpdate(plan.id, { creative_type: val })}
                    className="bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium h-auto py-0.5 px-1.5"
                />
            </td>

            <td className="data-grid-td">
                <input
                    type="number"
                    className="data-grid-input text-center"
                    value={plan.priority || ''}
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) handleUpdate(plan.id, { priority: val });
                    }}
                />
            </td>

            <td className="data-grid-td relative">
                <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (plan.hj_rating || 0) * 10)}%` }}></div>
                    </div>
                </div>
                <input
                    type="number"
                    className="data-grid-input text-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity bg-white z-10"
                    value={plan.hj_rating || ''}
                    onChange={(e) => handleUpdate(plan.id, { hj_rating: parseFloat(e.target.value) })}
                />
            </td>

            <td className="data-grid-td">
                <EditableSelect
                    value={plan.user_id || ''}
                    options={[
                        { label: '-', value: '' },
                        ...users.map(u => ({ label: u.first_name, value: u.id }))
                    ]}
                    onChange={(val) => handleUpdate(plan.id, { user_id: val })}
                />
            </td>

            <td className="data-grid-td">
                <StatusBadge status={plan.status} onChange={(val) => handleUpdate(plan.id, { status: val })} />
            </td>

            <td className="data-grid-td group/url">
                <div className="flex w-full h-full items-center">
                    <input
                        type="text"
                        className="data-grid-input flex-1"
                        placeholder="https://..."
                        value={plan.spy_url || ''}
                        onChange={(e) => handleUpdate(plan.id, { spy_url: e.target.value })}
                    />
                    {plan.spy_url && (
                        <a href={plan.spy_url} target="_blank" rel="noopener noreferrer" className="px-2 text-gray-400 hover:text-blue-600">
                            <LinkIcon className="w-3 h-3" />
                        </a>
                    )}
                </div>
            </td>

            <td className="data-grid-td">
                <EditableText value={plan.description || ''} onChange={(val) => handleUpdate(plan.id, { description: val })} placeholder="Description..." />
            </td>

            <td className="data-grid-td p-0">
                <CreativeMediaCell
                    creative={plan.reference_creative}
                    creatives={creatives}
                    onChange={(id) => handleUpdate(plan.id, { reference_creative_id: id })}
                />
            </td>

            <td className="data-grid-td p-0">
                <CreativeMediaCell
                    creative={plan.creative}
                    creatives={creatives}
                    onChange={(id) => handleUpdate(plan.id, { creative_id: id })}
                />
            </td>

            <td className="data-grid-td px-2 text-[10px] text-gray-400 whitespace-nowrap">
                {new Date(plan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </td>
        </tr>
    );
}

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

    // Drag and Drop Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    // Generic Update Handler
    const handleUpdate = async (id: string, updates: Partial<AdPlan>) => {
        // Optimistic update
        setPlans(plans.map(p => p.id === id ? { ...p, ...updates } : p));

        try {
            await updateAdPlan(id, updates);
        } catch (error) {
            console.error('Failed to update plan:', error);
            // Revert on error
            loadData();
        }
    };

    // Drag End Handler
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPlans((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
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
        } catch (error) {
            console.error('Failed to create ad plan:', error);
            alert('Failed to create plan.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Ad Planning</h1>
                    <p className="text-xs text-gray-500">
                        Pipeline Grid
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded shadow hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    New Plan
                </button>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-auto bg-white">
                <table className="data-grid-table">
                    <thead>
                        <tr>
                            <th className="data-grid-th w-10"></th>
                            <th className="data-grid-th w-12 text-center">ID</th>
                            <th className="data-grid-th min-w-[120px]">Project</th>
                            <th className="data-grid-th min-w-[100px]">Subproject</th>
                            <th className="data-grid-th w-24">Plan Type</th>
                            <th className="data-grid-th w-24">Creative</th>
                            <th className="data-grid-th w-16 text-center">Pri.</th>
                            <th className="data-grid-th w-16 text-center">Rat.</th>
                            <th className="data-grid-th min-w-[100px]">Owner</th>
                            <th className="data-grid-th min-w-[120px]">Status</th>
                            <th className="data-grid-th min-w-[150px]">Spy URL</th>
                            <th className="data-grid-th min-w-[200px]">Description</th>
                            <th className="data-grid-th w-20 text-center">Ref.</th>
                            <th className="data-grid-th w-20 text-center">Final</th>
                            <th className="data-grid-th min-w-[100px]">Created</th>
                        </tr>
                    </thead>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={plans.map(p => p.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <tbody className="divide-y divide-gray-100">
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={15} className="data-grid-td px-4"><div className="h-4 bg-gray-100 rounded w-1/2"></div></td>
                                        </tr>
                                    ))
                                ) : plans.length === 0 ? (
                                    <tr>
                                        <td colSpan={15} className="data-grid-td text-center text-gray-400 py-8">
                                            No plans found.
                                        </td>
                                    </tr>
                                ) : (
                                    plans.map((plan) => (
                                        <SortableRow
                                            key={plan.id}
                                            plan={plan}
                                            projects={projects}
                                            users={users}
                                            creatives={creatives}
                                            handleUpdate={handleUpdate}
                                        />
                                    ))
                                )}
                            </tbody>
                        </SortableContext>
                    </DndContext>
                </table>
            </div>

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
                                        <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
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

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Enter ad description"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Spy URL</label>
                                <input
                                    type="url"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.spy_url}
                                    onChange={e => setFormData({ ...formData, spy_url: e.target.value })}
                                    placeholder="https://"
                                />
                            </div>

                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Media</label>
                                <select
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.reference_creative_id}
                                    onChange={e => setFormData({ ...formData, reference_creative_id: e.target.value })}
                                >
                                    <option value="">Select Reference Media</option>
                                    {creatives.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Final Creative</label>
                                <select
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.creative_id}
                                    onChange={e => setFormData({ ...formData, creative_id: e.target.value })}
                                >
                                    <option value="">Select Final Creative</option>
                                    {creatives.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-2 pt-4 flex justify-end gap-3 border-t border-gray-100 mt-2">
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
                                    {isSubmitting ? 'Saving...' : 'Create Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
