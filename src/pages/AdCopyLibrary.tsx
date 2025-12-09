import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    X,
    Maximize2,
    Minimize2,
} from 'lucide-react';
import {
    getAdCopies,
    createAdCopy,
    updateAdCopy,
    deleteAdCopy,
    getProjects,
    getUsers,
    type AdCopy,
    type Project,
    type User
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { cn } from '../utils/cn';
import { DataTable, type ColumnDef } from '../components/DataTable';

export function AdCopyLibrary() {
    const [copies, setCopies] = useState<AdCopy[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showFullText, setShowFullText] = useState(false);
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

    // Load Data
    useEffect(() => {
        loadData();
        getCurrentUser().then(user => setCurrentUserId(user?.id || null));
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [copiesData, projectsData, usersData] = await Promise.all([
                getAdCopies(),
                getProjects(),
                getUsers()
            ]);
            setCopies(copiesData);
            setProjects(projectsData);
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper functions
    const getProjectName = (copy: AdCopy) => {
        if (copy.project_id) {
            const proj = projects.find(p => p.id === copy.project_id);
            if (proj) return proj.name;
        }
        return copy.project || '-';
    };

    const getCreatorName = (copy: AdCopy) => {
        if (copy.user_id) {
            const user = users.find(u => u.id === copy.user_id);
            if (user) return user.name || user.email;
            if (copy.user_id === currentUserId) return 'Me';
        }
        return 'Unknown';
    };

    // Filter Logic
    const filteredCopies = copies.filter(copy => {
        const searchLower = searchQuery.toLowerCase();
        const projectName = getProjectName(copy).toLowerCase();
        const creatorName = getCreatorName(copy).toLowerCase();

        return (
            copy.text.toLowerCase().includes(searchLower) ||
            projectName.includes(searchLower) ||
            creatorName.includes(searchLower)
        );
    });

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
        } else if (field === 'platform') {
            updates.platform = value ? String(value) : null;
        } else if (field === 'user_id') {
            updates.user_id = value ? String(value) : null;
        }

        console.log('AdCopyLibrary updating:', { id, field, value, updates });

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
            console.log('Update successful');
        } catch (error) {
            console.error('Failed to update ad copy:', error);
            setCopies(prev => prev.map(c =>
                c.id === id ? original : c
            ));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errorMessage = (error as any)?.message || 'Unknown error';
            alert(`Failed to save changes: ${errorMessage}`);
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

    // Copy Handler
    const handleCopy = (copy: AdCopy) => {
        navigator.clipboard.writeText(copy.text);
    };

    // Reorder Handler (for drag & drop)
    const handleReorder = (newOrder: string[]) => {
        const reordered = newOrder.map(id => copies.find(c => c.id === id)!).filter(Boolean);
        setCopies(reordered);
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

    // Column Definitions
    const columns: ColumnDef<AdCopy>[] = [
        {
            key: 'row_number',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            render: (value) => (
                <span className="text-[10px] text-gray-400">{value || '-'}</span>
            ),
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
            type: 'badge',
            options: [
                { label: 'Primary', value: 'primary_text' },
                { label: 'Headline', value: 'headline' },
                { label: 'Desc', value: 'description' },
            ],
            colorMap: {
                'primary_text': 'bg-blue-50 text-blue-700 border-blue-200',
                'headline': 'bg-purple-50 text-purple-700 border-purple-200',
                'description': 'bg-gray-50 text-gray-700 border-gray-200',
            },
        },
        {
            key: 'project_id',
            header: 'Project',
            width: 140,
            minWidth: 100,
            editable: true,
            type: 'badge',
            options: [
                { label: 'No Project', value: '' },
                ...projects.map(p => ({ label: p.name, value: p.id })),
            ],
            colorMap: {},
            getValue: (copy) => copy.project_id || '',
            render: (_value, copy) => {
                const name = getProjectName(copy);
                const hasProject = copy.project_id || copy.project;
                return (
                    <span className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:ring-1 hover:ring-blue-300",
                        hasProject ? "bg-pink-50 text-pink-700 border border-pink-200" : "text-gray-400"
                    )}>
                        {name}
                    </span>
                );
            },
        },
        {
            key: 'platform',
            header: 'Traffic',
            width: 80,
            minWidth: 60,
            editable: true,
            type: 'badge',
            options: [
                { label: 'None', value: '' },
                { label: 'FB', value: 'FB' },
                { label: 'IG', value: 'IG' },
                { label: 'All', value: 'All' },
            ],
            colorMap: {
                'FB': 'bg-green-50 text-green-700 border-green-200',
                'IG': 'bg-green-50 text-green-700 border-green-200',
                'All': 'bg-green-50 text-green-700 border-green-200',
            },
        },
        {
            key: 'created_at',
            header: 'Created Time',
            width: 140,
            minWidth: 100,
            editable: false,
            type: 'date',
            render: (value) => {
                if (!value) return '-';
                const date = new Date(String(value));
                return (
                    <span className="text-[10px] text-gray-500">
                        {date.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        })}
                    </span>
                );
            },
        },
        {
            key: 'user_id',
            header: 'Owner',
            width: 120,
            minWidth: 80,
            editable: true,
            type: 'select',
            options: users.map(u => ({
                label: u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u.name || u.email),
                value: u.id
            })),
            getValue: (copy) => copy.user_id || '',
        },
    ];

    return (
        <div className="h-full flex flex-col gap-2 p-4 overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Ad Text</h1>
                    <p className="text-xs text-gray-500">
                        Manage your ad headlines and primary text library.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex-1 flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search ad text, project, or name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>
                    <div className="h-6 w-px bg-gray-200" />
                    <button
                        onClick={() => setShowFullText(!showFullText)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                            showFullText
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "text-gray-600 hover:bg-gray-100 border border-transparent"
                        )}
                    >
                        {showFullText ? (
                            <>
                                <Minimize2 className="w-4 h-4" />
                                Collapse Text
                            </>
                        ) : (
                            <>
                                <Maximize2 className="w-4 h-4" />
                                Expand Text
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={filteredCopies}
                isLoading={isLoading}
                emptyMessage="No ad copies found. Create one for your next campaign!"
                getRowId={(copy) => copy.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCopy={handleCopy}
                sortable={true}
                onReorder={handleReorder}
                resizable={true}
                expandText={showFullText}
                fullscreen={true}
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Ad Text <span className="text-red-500">*</span>
                                </label>
                                <textarea
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="primary_text">Primary Text</option>
                                        <option value="headline">Headline</option>
                                        <option value="description">Description</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                                    <select
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                                <select
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
        </div>
    );
}
