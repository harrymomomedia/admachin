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
    type AdCopy
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { cn } from '../utils/cn';

export function AdCopyLibrary() {
    const [copies, setCopies] = useState<AdCopy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // UI Logic State
    const [showFullText, setShowFullText] = useState(false);

    // Inline Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const editInputRef = useRef<HTMLTextAreaElement>(null);

    // Form State
    const [formData, setFormData] = useState({
        text: '',
        type: 'primary_text', // primary_text, headline, description
        project: '',
        platform: 'FB',
        name: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Column Resizing State
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        text: 300,
        type: 120,
        project: 120,
        platform: 100,
        name: 150,
        date: 100,
        creator: 80,
        actions: 100,
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
        loadCopies();
        getCurrentUser().then(user => setCurrentUserId(user?.id || null));
    }, []);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Focus & Auto-expand edit input
    useEffect(() => {
        if (editingId && editInputRef.current) {
            const textarea = editInputRef.current;
            textarea.focus();
            // Reset height to auto to get correct scrollHeight
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;

            // Move cursor to end
            textarea.setSelectionRange(
                textarea.value.length,
                textarea.value.length
            );
        }
    }, [editingId]);

    const loadCopies = async () => {
        setIsLoading(true);
        try {
            const data = await getAdCopies();
            setCopies(data);
        } catch (error) {
            console.error('Failed to load ad copies:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-resize handler for textarea
    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = e.target;
        setEditingText(textarea.value);
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    // Filter Logic
    const filteredCopies = copies.filter(copy => {
        const searchLower = searchQuery.toLowerCase();
        return (
            copy.text.toLowerCase().includes(searchLower) ||
            (copy.project || '').toLowerCase().includes(searchLower) ||
            (copy.name || '').toLowerCase().includes(searchLower)
        );
    });

    // Inline Edit Handlers
    const handleEditStart = (copy: AdCopy) => {
        setEditingId(copy.id);
        setEditingText(copy.text);
    };

    const handleEditSave = async () => {
        if (!editingId) return;

        const original = copies.find(c => c.id === editingId);
        if (original && original.text === editingText) {
            setEditingId(null);
            return;
        }

        try {
            // Optimistic update
            setCopies(prev => prev.map(c =>
                c.id === editingId ? { ...c, text: editingText } : c
            ));

            await updateAdCopy(editingId, { text: editingText });
        } catch (error) {
            console.error('Failed to update ad copy:', error);
            // Revert on error
            if (original) {
                setCopies(prev => prev.map(c =>
                    c.id === editingId ? original : c
                ));
            }
            alert('Failed to save changes.');
        } finally {
            setEditingId(null);
        }
    };

    const handleEditCancel = () => {
        setEditingId(null);
        setEditingText('');
    };

    // Create Handler
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsSubmitting(true);
        try {
            const user = await getCurrentUser();
            // Allow creation even if no user (anonymouse/RLS)

            await createAdCopy({
                user_id: user?.id,
                ...formData
            });
            await loadCopies();
            setIsCreateModalOpen(false);
            setFormData({
                text: '',
                type: 'primary_text',
                project: '',
                platform: 'FB',
                name: ''
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
                    <table className="w-full text-left text-sm" style={{ tableLayout: 'fixed' }}>
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th style={{ width: columnWidths.text }} className="px-6 py-3 font-medium text-gray-500 relative">
                                    Ad Text
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('text', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.type }} className="px-6 py-3 font-medium text-gray-500 whitespace-nowrap relative">
                                    Type
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('type', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.project }} className="px-6 py-3 font-medium text-gray-500 whitespace-nowrap relative">
                                    Project
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('project', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.platform }} className="px-6 py-3 font-medium text-gray-500 whitespace-nowrap relative">
                                    Traffic
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('platform', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.name }} className="px-6 py-3 font-medium text-gray-500 whitespace-nowrap relative">
                                    Name
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('name', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.date }} className="px-6 py-3 font-medium text-gray-500 whitespace-nowrap relative">
                                    Date
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('date', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.creator }} className="px-6 py-3 font-medium text-gray-500 whitespace-nowrap relative">
                                    Creator
                                    <div
                                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                        onMouseDown={(e) => handleResizeStart('creator', e)}
                                    />
                                </th>
                                <th style={{ width: columnWidths.actions }} className="px-6 py-3 font-medium text-gray-500 whitespace-nowrap">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                                        Loading ad copies...
                                    </td>
                                </tr>
                            ) : filteredCopies.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                                        No ad copies found. create one specifically for your next campaign!
                                    </td>
                                </tr>
                            ) : (
                                filteredCopies.map((copy) => (
                                    <tr key={copy.id} className="group hover:bg-gray-50/50 transition-colors border-b border-gray-200 last:border-0">
                                        <td className="px-6 py-4 min-w-[300px]">
                                            <div className="max-w-xl">
                                                {editingId === copy.id ? (
                                                    <textarea
                                                        ref={editInputRef}
                                                        value={editingText}
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
                                                        className="w-full p-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm overflow-hidden resize-none"
                                                        rows={1}
                                                        style={{ minHeight: '38px' }}
                                                    />
                                                ) : (
                                                    <p
                                                        className={cn(
                                                            "text-gray-900 cursor-pointer hover:text-blue-600 transition-colors",
                                                            !showFullText && "line-clamp-2",
                                                            showFullText && "whitespace-pre-wrap"
                                                        )}
                                                        title="Click to edit"
                                                        onClick={() => handleEditStart(copy)}
                                                    >
                                                        {copy.text}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border",
                                                copy.type === 'primary_text' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                    copy.type === 'headline' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                                        "bg-gray-50 text-gray-700 border-gray-200"
                                            )}>
                                                {copy.type === 'primary_text' ? 'Primary Text' :
                                                    copy.type === 'headline' ? 'Headline' : 'Description'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {copy.project ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-pink-50 text-pink-700 border border-pink-200">
                                                    {copy.project}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {copy.platform ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                                    {copy.platform}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                            {copy.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap text-xs">
                                            {new Date(copy.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium",
                                                copy.user_id === currentUserId
                                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                                    : "bg-gray-100 text-gray-600 border border-gray-200"
                                            )}>
                                                {copy.user_id === currentUserId ? 'Me' : 'User'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => copyToClipboard(copy.text, copy.id)}
                                                    className={cn(
                                                        "p-1.5 rounded-lg transition-colors",
                                                        copiedId === copy.id
                                                            ? "text-green-600 bg-green-50"
                                                            : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                                    )}
                                                    title="Copy Text"
                                                >
                                                    {copiedId === copy.id ? (
                                                        <Check className="w-4 h-4" />
                                                    ) : (
                                                        <Copy className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(copy.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Tag</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="e.g. Summer Sale"
                                        value={formData.project}
                                        onChange={e => setFormData({ ...formData, project: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Optional label"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
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
