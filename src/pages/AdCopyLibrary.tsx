import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Plus,
    Search,
    Trash2,
    Copy,
    X,
    Maximize2,
    Minimize2,
    Check
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

export function AdCopyLibrary() {
    const [copies, setCopies] = useState<AdCopy[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // UI Logic State
    const [showFullText, setShowFullText] = useState(false);

    // Inline Editing State - now tracks field being edited
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const editInputRef = useRef<HTMLTextAreaElement | HTMLSelectElement>(null);

    // Form State
    const [formData, setFormData] = useState({
        text: '',
        type: 'primary_text', // primary_text, headline, description
        project_id: '',
        project: '', // Legacy/Fallback text
        platform: 'FB'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Column Resizing State (removed 'name' column)
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        text: 400,
        type: 100,
        project: 140,
        platform: 80,
        date: 140,
        creator: 120,
        actions: 80,
    });
    const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

    const handleResizeStart = useCallback((column: string, e: React.MouseEvent) => {
        e.preventDefault();
        resizingRef.current = {
            column,
            startX: e.clientX,
            startWidth: columnWidths[column],
        };
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
    }, [columnWidths]);

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!resizingRef.current) return;
        const { column, startX, startWidth } = resizingRef.current;
        const delta = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + delta); // Min width 50px
        setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    }, []);

    const handleResizeEnd = useCallback(() => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
    }, [handleResizeMove]);

    // Load Data
    useEffect(() => {
        loadData();
        getCurrentUser().then(user => setCurrentUserId(user?.id || null));
    }, []);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Focus edit input
    useEffect(() => {
        if (editingCell && editInputRef.current) {
            const element = editInputRef.current;
            element.focus();

            // Auto-expand for textarea
            if (element instanceof HTMLTextAreaElement) {
                element.style.height = 'auto';
                element.style.height = `${element.scrollHeight}px`;
                element.setSelectionRange(
                    element.value.length,
                    element.value.length
                );
            }
        }
    }, [editingCell]);

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

    // Auto-resize handler for textarea
    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = e.target;
        setEditingValue(textarea.value);
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    // Format datetime for Created Time column
    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Helper to get project name
    const getProjectName = (copy: AdCopy) => {
        if (copy.project_id) {
            const proj = projects.find(p => p.id === copy.project_id);
            if (proj) return proj.name;
        }
        return copy.project || '-';
    };

    // Helper to get creator name
    const getCreatorName = (copy: AdCopy) => {
        if (copy.user_id) {
            const user = users.find(u => u.id === copy.user_id);
            if (user) return user.name || user.email; // Use name or fallback to email

            // Fallback for current user if IDs match auth
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

    // Inline Edit Handlers - now supports all editable fields
    const handleEditStart = (copy: AdCopy, field: string) => {
        let value = '';
        switch (field) {
            case 'text':
                value = copy.text;
                break;
            case 'type':
                value = copy.type;
                break;
            case 'project_id':
                value = copy.project_id || '';
                break;
            case 'platform':
                value = copy.platform || '';
                break;
            case 'user_id':
                value = copy.user_id || '';
                break;
        }
        setEditingCell({ id: copy.id, field });
        setEditingValue(value);
    };

    const handleEditSave = async () => {
        if (!editingCell) return;

        const { id, field } = editingCell;
        const original = copies.find(c => c.id === id);
        if (!original) {
            setEditingCell(null);
            return;
        }

        // Check if value actually changed
        const originalValue = field === 'text' ? original.text :
            field === 'type' ? original.type :
                field === 'project_id' ? (original.project_id || '') :
                    field === 'platform' ? (original.platform || '') :
                        field === 'user_id' ? (original.user_id || '') : '';

        if (originalValue === editingValue) {
            setEditingCell(null);
            return;
        }

        try {
            // Build update object
            const updates: Partial<AdCopy> = {};
            if (field === 'text') {
                updates.text = editingValue;
            } else if (field === 'type') {
                updates.type = editingValue;
            } else if (field === 'project_id') {
                updates.project_id = editingValue || null;
                // Also update legacy project field
                const proj = projects.find(p => p.id === editingValue);
                updates.project = proj?.name || null;
            } else if (field === 'platform') {
                updates.platform = editingValue || null;
            } else if (field === 'user_id') {
                updates.user_id = editingValue || null;
            }

            // Optimistic update
            setCopies(prev => prev.map(c =>
                c.id === id ? { ...c, ...updates } : c
            ));

            await updateAdCopy(id, updates);
        } catch (error) {
            console.error('Failed to update ad copy:', error);
            // Revert on error
            setCopies(prev => prev.map(c =>
                c.id === id ? original : c
            ));
            alert('Failed to save changes.');
        } finally {
            setEditingCell(null);
        }
    };

    const handleEditCancel = () => {
        setEditingCell(null);
        setEditingValue('');
    };

    // Create Handler
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsSubmitting(true);
        try {
            const currentUser = await getCurrentUser();

            // Find the project name for the legacy field if needed
            const selectedProject = projects.find(p => p.id === formData.project_id);
            const legacyProjectName = selectedProject ? selectedProject.name : '';

            await createAdCopy({
                user_id: currentUser?.id,
                text: formData.text,
                type: formData.type,
                project: legacyProjectName, // Populate legacy field
                project_id: formData.project_id || null, // Populate new field
                platform: formData.platform
            });
            await loadData();
            setIsCreateModalOpen(false);
            setFormData({
                text: '',
                type: 'primary_text',
                project_id: '',
                project: '',
                platform: 'FB'
            });
        } catch (error) {
            console.error('Failed to create ad copy:', error);
            alert('Failed to save ad copy. Please try again.');
        } finally {
            setIsSubmitting(false);
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Ad Text</h1>
                    <p className="mt-1 text-sm text-gray-500">
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
            <div className="flex items-center gap-4">
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

            {/* Content Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="data-grid-table" style={{ width: Object.values(columnWidths).reduce((a, b) => a + b, 0), tableLayout: 'fixed' }}>
                        <thead>
                            <tr>
                                <th style={{ width: columnWidths.text }} className="data-grid-th relative">
                                    Ad Text
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('text', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.type }} className="data-grid-th relative">
                                    Type
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('type', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.project }} className="data-grid-th relative">
                                    Project
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('project', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.platform }} className="data-grid-th relative">
                                    Traffic
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('platform', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.date }} className="data-grid-th relative">
                                    Created Time
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('date', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.creator }} className="data-grid-th relative">
                                    Creator
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('creator', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.actions }} className="data-grid-th">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="data-grid-td"><div className="h-4 bg-gray-200 rounded w-3/4 mx-2"></div></td>
                                        <td className="data-grid-td"><div className="h-5 bg-gray-200 rounded w-16 mx-2"></div></td>
                                        <td className="data-grid-td"><div className="h-5 bg-gray-200 rounded w-14 mx-2"></div></td>
                                        <td className="data-grid-td"><div className="h-5 bg-gray-200 rounded w-10 mx-2"></div></td>
                                        <td className="data-grid-td"><div className="h-4 bg-gray-200 rounded w-24 mx-2"></div></td>
                                        <td className="data-grid-td"><div className="h-5 bg-gray-200 rounded w-16 mx-2"></div></td>
                                        <td className="data-grid-td"><div className="h-5 bg-gray-200 rounded w-12 mx-2"></div></td>
                                    </tr>
                                ))
                            ) : filteredCopies.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="data-grid-td px-4 py-8 text-center text-gray-500 text-xs">
                                        No ad copies found. Create one for your next campaign!
                                    </td>
                                </tr>
                            ) : (
                                filteredCopies.map((copy) => (
                                    <tr key={copy.id} className="group">
                                        {/* Ad Text - Editable */}
                                        <td className="data-grid-td px-2">
                                            <div className="w-full">
                                                {editingCell?.id === copy.id && editingCell?.field === 'text' ? (
                                                    <textarea
                                                        ref={editInputRef as React.RefObject<HTMLTextAreaElement>}
                                                        value={editingValue}
                                                        onChange={handleTextareaInput}
                                                        onBlur={handleEditSave}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleEditSave();
                                                            } else if (e.key === 'Escape') {
                                                                handleEditCancel();
                                                            }
                                                        }}
                                                        className="w-full p-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200 overflow-hidden resize-none"
                                                        rows={1}
                                                        style={{ minHeight: '24px' }}
                                                    />
                                                ) : (
                                                    <p
                                                        className={cn(
                                                            "text-xs text-gray-900 cursor-pointer hover:text-blue-600 transition-colors",
                                                            !showFullText && "line-clamp-1",
                                                            showFullText && "whitespace-pre-wrap"
                                                        )}
                                                        title="Click to edit"
                                                        onClick={() => handleEditStart(copy, 'text')}
                                                    >
                                                        {copy.text}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        {/* Type - Editable */}
                                        <td className="data-grid-td px-2">
                                            {editingCell?.id === copy.id && editingCell?.field === 'type' ? (
                                                <select
                                                    ref={editInputRef as React.RefObject<HTMLSelectElement>}
                                                    value={editingValue}
                                                    onChange={(e) => {
                                                        setEditingValue(e.target.value);
                                                        setTimeout(handleEditSave, 0);
                                                    }}
                                                    onBlur={handleEditSave}
                                                    className="w-full p-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                                                >
                                                    <option value="primary_text">Primary</option>
                                                    <option value="headline">Headline</option>
                                                    <option value="description">Desc</option>
                                                </select>
                                            ) : (
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:ring-1 hover:ring-blue-300",
                                                        copy.type === 'primary_text' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                            copy.type === 'headline' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                                                "bg-gray-50 text-gray-700 border-gray-200"
                                                    )}
                                                    title="Click to edit"
                                                    onClick={() => handleEditStart(copy, 'type')}
                                                >
                                                    {copy.type === 'primary_text' ? 'Primary' :
                                                        copy.type === 'headline' ? 'Headline' : 'Desc'}
                                                </span>
                                            )}
                                        </td>
                                        {/* Project - Editable */}
                                        <td className="data-grid-td px-2">
                                            {editingCell?.id === copy.id && editingCell?.field === 'project_id' ? (
                                                <select
                                                    ref={editInputRef as React.RefObject<HTMLSelectElement>}
                                                    value={editingValue}
                                                    onChange={(e) => {
                                                        setEditingValue(e.target.value);
                                                        setTimeout(handleEditSave, 0);
                                                    }}
                                                    onBlur={handleEditSave}
                                                    className="w-full p-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                                                >
                                                    <option value="">No Project</option>
                                                    {projects.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:ring-1 hover:ring-blue-300",
                                                        copy.project_id || copy.project
                                                            ? "bg-pink-50 text-pink-700 border border-pink-200"
                                                            : "text-gray-400"
                                                    )}
                                                    title="Click to edit"
                                                    onClick={() => handleEditStart(copy, 'project_id')}
                                                >
                                                    {getProjectName(copy)}
                                                </span>
                                            )}
                                        </td>
                                        {/* Platform/Traffic - Editable */}
                                        <td className="data-grid-td px-2">
                                            {editingCell?.id === copy.id && editingCell?.field === 'platform' ? (
                                                <select
                                                    ref={editInputRef as React.RefObject<HTMLSelectElement>}
                                                    value={editingValue}
                                                    onChange={(e) => {
                                                        setEditingValue(e.target.value);
                                                        setTimeout(handleEditSave, 0);
                                                    }}
                                                    onBlur={handleEditSave}
                                                    className="w-full p-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                                                >
                                                    <option value="">None</option>
                                                    <option value="FB">FB</option>
                                                    <option value="IG">IG</option>
                                                    <option value="All">All</option>
                                                </select>
                                            ) : (
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:ring-1 hover:ring-blue-300",
                                                        copy.platform
                                                            ? "bg-green-50 text-green-700 border border-green-200"
                                                            : "text-gray-400"
                                                    )}
                                                    title="Click to edit"
                                                    onClick={() => handleEditStart(copy, 'platform')}
                                                >
                                                    {copy.platform || '-'}
                                                </span>
                                            )}
                                        </td>
                                        {/* Created Time - NOT Editable */}
                                        <td className="data-grid-td px-2 text-[10px] text-gray-500">
                                            {formatDateTime(copy.created_at)}
                                        </td>
                                        {/* Creator - Editable */}
                                        <td className="data-grid-td px-2">
                                            {editingCell?.id === copy.id && editingCell?.field === 'user_id' ? (
                                                <select
                                                    ref={editInputRef as React.RefObject<HTMLSelectElement>}
                                                    value={editingValue}
                                                    onChange={(e) => {
                                                        setEditingValue(e.target.value);
                                                        setTimeout(handleEditSave, 0);
                                                    }}
                                                    onBlur={handleEditSave}
                                                    className="w-full p-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                                                >
                                                    <option value="">Unknown</option>
                                                    {users.map(u => (
                                                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:ring-1 hover:ring-blue-300",
                                                        copy.user_id === currentUserId
                                                            ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                                            : "bg-gray-100 text-gray-600 border border-gray-200"
                                                    )}
                                                    title="Click to edit"
                                                    onClick={() => handleEditStart(copy, 'user_id')}
                                                >
                                                    {getCreatorName(copy)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="data-grid-td px-2">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => copyToClipboard(copy.text, copy.id)}
                                                    className={cn(
                                                        "p-1 rounded transition-colors",
                                                        copiedId === copy.id
                                                            ? "text-green-600 bg-green-50"
                                                            : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                                    )}
                                                    title="Copy Text"
                                                >
                                                    {copiedId === copy.id ? (
                                                        <Check className="w-3 h-3" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(copy.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
