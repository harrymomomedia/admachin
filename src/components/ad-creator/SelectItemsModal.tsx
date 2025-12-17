import { useState, useMemo } from 'react';
import { X, Image, Film } from 'lucide-react';
import { DataTable, type ColumnDef } from '../DataTable';
import type { Creative, AdCopy } from '../../lib/supabase-service';
import { getCreativeUrl } from '../../lib/supabase-service';

interface SelectItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: (Creative | AdCopy)[];
    selectedIds: Set<string>;
    onSelectionChange: (selectedIds: Set<string>) => void;
    getItemId: (item: Creative | AdCopy) => string;
    type: 'creatives' | 'headlines' | 'primary' | 'descriptions';
}

export function SelectItemsModal({
    isOpen,
    onClose,
    title,
    items,
    selectedIds,
    onSelectionChange,
    getItemId,
    type,
}: SelectItemsModalProps) {
    const [search, setSearch] = useState('');

    // Filter items by search
    const filteredItems = useMemo(() => {
        if (!search) return items;
        const lowerSearch = search.toLowerCase();
        return items.filter((item) => {
            if ('name' in item && item.name) {
                return item.name.toLowerCase().includes(lowerSearch);
            }
            if ('text' in item && item.text) {
                return item.text.toLowerCase().includes(lowerSearch);
            }
            return false;
        });
    }, [items, search]);

    // Define columns based on type
    const columns: ColumnDef<Creative | AdCopy>[] = useMemo(() => {
        if (type === 'creatives') {
            return [
                {
                    key: 'preview',
                    header: 'Preview',
                    width: 60,
                    render: (_, row) => {
                        const creative = row as Creative;
                        const url = creative.storage_path ? getCreativeUrl(creative.storage_path) : null;
                        return (
                            <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                                {url ? (
                                    creative.type === 'video' ? (
                                        <video
                                            src={url}
                                            className="w-full h-full object-cover"
                                            muted
                                        />
                                    ) : (
                                        <img
                                            src={url}
                                            alt={creative.name}
                                            className="w-full h-full object-cover"
                                        />
                                    )
                                ) : (
                                    <Image className="w-4 h-4 text-gray-400" />
                                )}
                            </div>
                        );
                    },
                },
                {
                    key: 'name',
                    header: 'Name',
                    width: 200,
                    render: (_, row) => {
                        const creative = row as Creative;
                        return (
                            <span className="text-sm text-gray-700">{creative.name}</span>
                        );
                    },
                },
                {
                    key: 'type',
                    header: 'Type',
                    width: 80,
                    render: (_, row) => {
                        const creative = row as Creative;
                        return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                                {creative.type === 'video' ? (
                                    <Film className="w-3 h-3" />
                                ) : (
                                    <Image className="w-3 h-3" />
                                )}
                                {creative.type}
                            </span>
                        );
                    },
                },
                {
                    key: 'dimensions',
                    header: 'Dimensions',
                    width: 100,
                    render: (_, row) => {
                        const creative = row as Creative;
                        const dims = creative.dimensions as { width?: number; height?: number } | null;
                        if (dims?.width && dims?.height) {
                            return (
                                <span className="text-xs text-gray-500">
                                    {dims.width}x{dims.height}
                                </span>
                            );
                        }
                        return <span className="text-xs text-gray-400">-</span>;
                    },
                },
                {
                    key: 'file_size',
                    header: 'Size',
                    width: 80,
                    render: (_, row) => {
                        const creative = row as Creative;
                        if (creative.file_size) {
                            const kb = creative.file_size / 1024;
                            const mb = kb / 1024;
                            return (
                                <span className="text-xs text-gray-500">
                                    {mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(kb)} KB`}
                                </span>
                            );
                        }
                        return <span className="text-xs text-gray-400">-</span>;
                    },
                },
            ];
        } else {
            // Headlines, Primary Text, Descriptions
            return [
                {
                    key: 'text',
                    header: 'Text',
                    width: 400,
                    render: (_, row) => {
                        const copy = row as AdCopy;
                        return (
                            <span className="text-sm text-gray-700 line-clamp-2">
                                {copy.text || <span className="text-gray-400 italic">Empty</span>}
                            </span>
                        );
                    },
                },
                {
                    key: 'name',
                    header: 'Name',
                    width: 150,
                    render: (_, row) => {
                        const copy = row as AdCopy;
                        return (
                            <span className="text-xs text-gray-500">
                                {copy.name || '-'}
                            </span>
                        );
                    },
                },
                {
                    key: 'created_at',
                    header: 'Created',
                    width: 100,
                    render: (_, row) => {
                        const copy = row as AdCopy;
                        if (copy.created_at) {
                            return (
                                <span className="text-xs text-gray-500">
                                    {new Date(copy.created_at).toLocaleDateString()}
                                </span>
                            );
                        }
                        return <span className="text-xs text-gray-400">-</span>;
                    },
                },
            ];
        }
    }, [type]);

    const handleSelectAll = () => {
        const allIds = new Set(filteredItems.map(getItemId));
        onSelectionChange(allIds);
    };

    const handleClear = () => {
        onSelectionChange(new Set());
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleSelectAll}
                            className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            Select All
                        </button>
                        <button
                            onClick={handleClear}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* DataTable */}
                <div className="flex-1 overflow-auto">
                    <DataTable
                        columns={columns}
                        data={filteredItems}
                        getRowId={getItemId}
                        selectable={true}
                        selectedIds={selectedIds}
                        onSelectionChange={onSelectionChange}
                        emptyMessage={`No ${type} found`}
                        showRowActions={false}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                            {selectedIds.size} selected
                        </span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
