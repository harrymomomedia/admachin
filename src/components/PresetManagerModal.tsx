import { useState, useMemo } from 'react';
import { X, Search, FolderOpen, Trash2, Calendar, User, Folder } from 'lucide-react';
import type { AICopywritingPreset, Project, Subproject, User as UserType } from '../lib/supabase-service';

interface PresetManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    presets: AICopywritingPreset[];
    projects: Project[];
    subprojects: Subproject[];
    users: UserType[];
    onLoad: (preset: AICopywritingPreset) => void;
    onDelete: (presetId: string) => void;
    onRename: (presetId: string, newName: string) => Promise<void>;
}

export function PresetManagerModal({
    isOpen,
    onClose,
    presets,
    projects,
    subprojects,
    users,
    onLoad,
    onDelete,
    onRename,
}: PresetManagerModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'project'>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // Get project name by ID
    const getProjectDisplay = (projectId: string | null, subprojectId: string | null) => {
        if (!projectId) return '—';
        const project = projects.find(p => p.id === projectId);
        const projectName = project?.name || '—';

        if (subprojectId) {
            const subproject = subprojects.find(s => s.id === subprojectId);
            if (subproject) {
                return `${projectName} / ${subproject.name}`;
            }
        }
        return projectName;
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Filter and sort presets
    const filteredPresets = useMemo(() => {
        let result = [...presets];

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(preset =>
                preset.name.toLowerCase().includes(query) ||
                preset.name.toLowerCase().includes(query) ||
                getProjectDisplay(preset.project_id, preset.subproject_id).toLowerCase().includes(query)
            );
        }

        // Sort
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'created_at':
                    comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    break;
                case 'project':
                    comparison = getProjectDisplay(a.project_id, a.subproject_id).localeCompare(getProjectDisplay(b.project_id, b.subproject_id));
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [presets, searchQuery, sortBy, sortOrder, projects]);

    const handleSort = (column: 'name' | 'created_at' | 'project') => {
        if (sortBy === column) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const handleLoad = (preset: AICopywritingPreset) => {
        onLoad(preset);
        onClose();
    };

    const handleDelete = (e: React.MouseEvent, presetId: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this preset?')) {
            onDelete(presetId);
        }
    };

    const handleStartEdit = (e: React.MouseEvent, preset: AICopywritingPreset) => {
        e.stopPropagation();
        setEditingId(preset.id);
        setEditName(preset.name);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editName.trim()) {
            setEditingId(null);
            return;
        }
        await onRename(editingId, editName);
        setEditingId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            setEditingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <FolderOpen className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Load Preset</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search presets..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {filteredPresets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                            <FolderOpen className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-sm">
                                {searchQuery ? 'No presets match your search' : 'No presets saved yet'}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th
                                        onClick={() => handleSort('name')}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    >
                                        <div className="flex items-center gap-1">
                                            Name
                                            {sortBy === 'name' && (
                                                <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('project')}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    >
                                        <div className="flex items-center gap-1">
                                            <Folder className="w-3 h-3" />
                                            Project
                                            {sortBy === 'project' && (
                                                <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            Created By
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('created_at')}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    >
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            Date
                                            {sortBy === 'created_at' && (
                                                <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPresets.map(preset => (
                                    <tr
                                        key={preset.id}
                                        onClick={() => handleLoad(preset)}
                                        className="hover:bg-blue-50 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            {editingId === preset.id ? (
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    onBlur={handleSaveEdit}
                                                    onKeyDown={handleKeyDown}
                                                    onClick={e => e.stopPropagation()}
                                                    className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span
                                                    className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline decoration-dashed underline-offset-4"
                                                    onClick={(e) => handleStartEdit(e, preset)}
                                                    title="Click to rename"
                                                >
                                                    {preset.name}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-600">
                                                {getProjectDisplay(preset.project_id, preset.subproject_id)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-600">
                                                {users.find(u => u.id === preset.created_by)?.first_name || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-500">
                                                {formatDate(preset.created_at)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={e => handleDelete(e, preset.id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete preset"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-500">
                        {filteredPresets.length} preset{filteredPresets.length !== 1 ? 's' : ''} available
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
