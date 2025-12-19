import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
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
                    type: 'thumbnail',
                    getValue: (row) => {
                        const creative = row as Creative;
                        return creative.storage_path ? getCreativeUrl(creative.storage_path) : null;
                    },
                },
                {
                    key: 'name',
                    header: 'Name',
                    width: 200,
                    type: 'text',
                },
                {
                    key: 'type',
                    header: 'Type',
                    width: 80,
                    type: 'select',
                    options: [
                        { label: 'Image', value: 'image' },
                        { label: 'Video', value: 'video' },
                    ],
                    colorMap: {
                        'image': 'bg-blue-500 text-white',
                        'video': 'bg-purple-500 text-white',
                    },
                },
                {
                    key: 'dimensions',
                    header: 'Dimensions',
                    width: 100,
                    type: 'text',
                    getValue: (row) => {
                        const creative = row as Creative;
                        const dims = creative.dimensions as { width?: number; height?: number } | null;
                        if (dims?.width && dims?.height) {
                            return `${dims.width}x${dims.height}`;
                        }
                        return '-';
                    },
                },
                {
                    key: 'file_size',
                    header: 'Size',
                    width: 80,
                    type: 'filesize',
                },
            ];
        } else {
            // Headlines, Primary Text, Descriptions
            return [
                {
                    key: 'text',
                    header: 'Text',
                    width: 400,
                    type: 'text',
                },
                {
                    key: 'name',
                    header: 'Name',
                    width: 150,
                    type: 'text',
                },
                {
                    key: 'created_at',
                    header: 'Created',
                    width: 100,
                    type: 'date',
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
