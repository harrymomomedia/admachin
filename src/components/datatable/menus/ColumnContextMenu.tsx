import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, LayoutGrid, Filter, Pencil } from 'lucide-react';
import { cn } from '../../../utils/cn';
import type { SortRule } from '../types';

interface ColumnContextMenuProps {
    columnKey: string;
    columnHeader: string;
    columnType?: string;
    position: { top: number; left: number };
    onGroupBy: (columnKey: string) => void;
    onSort: (columnKey: string, direction: 'asc' | 'desc') => void;
    onFilter: (columnKey: string) => void;
    onEditField?: () => void;
    onClose: () => void;
    isGroupedBy: boolean;
    sortRules: SortRule[];
}

export function ColumnContextMenu({
    columnKey,
    columnHeader,
    columnType,
    position,
    onGroupBy,
    onSort,
    onFilter,
    onEditField,
    onClose,
    isGroupedBy,
    sortRules
}: ColumnContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const currentSort = sortRules.find(r => r.key === columnKey);
    const isSortedAsc = currentSort?.direction === 'asc';
    const isSortedDesc = currentSort?.direction === 'desc';

    // Suppress unused variable warning - columnHeader is used for display in future enhancements
    void columnHeader;

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[200px]"
            style={{ top: position.top, left: position.left }}
        >
            {/* Field Type Label */}
            <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Field type: </span>
                <span className="text-[10px] text-gray-600 font-medium">
                    {columnType === 'select' ? 'Single Select' :
                        columnType === 'textarea' ? 'Long Text' :
                            columnType === 'text' ? 'Text' :
                                columnType === 'date' ? 'Date' :
                                    columnType === 'number' ? 'Number' :
                                        !columnType ? 'Not Defined' : columnType}
                </span>
            </div>
            {/* Sort Options */}
            <button
                onClick={() => {
                    onSort(columnKey, 'asc');
                    onClose();
                }}
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left",
                    isSortedAsc ? "bg-blue-50 text-blue-700" : "text-gray-700"
                )}
            >
                <ArrowUp className="w-4 h-4 text-gray-400" />
                Sort A → Z
            </button>
            <button
                onClick={() => {
                    onSort(columnKey, 'desc');
                    onClose();
                }}
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left",
                    isSortedDesc ? "bg-blue-50 text-blue-700" : "text-gray-700"
                )}
            >
                <ArrowDown className="w-4 h-4 text-gray-400" />
                Sort Z → A
            </button>

            {/* Divider */}
            <div className="my-1 border-t border-gray-100" />

            {/* Group By */}
            <button
                onClick={() => {
                    onGroupBy(isGroupedBy ? '' : columnKey);
                    onClose();
                }}
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left",
                    isGroupedBy ? "bg-blue-50 text-blue-700" : "text-gray-700"
                )}
            >
                <LayoutGrid className="w-4 h-4 text-gray-400" />
                {isGroupedBy ? `Ungroup` : `Group by this field`}
            </button>

            {/* Filter By */}
            <button
                onClick={() => {
                    onFilter(columnKey);
                    onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left text-gray-700"
            >
                <Filter className="w-4 h-4 text-gray-400" />
                Filter by this field
            </button>

            {/* Edit Field (only for select type) */}
            {columnType === 'select' && onEditField && (
                <>
                    <div className="my-1 border-t border-gray-100" />
                    <button
                        onClick={() => {
                            onEditField();
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left text-gray-700"
                    >
                        <Pencil className="w-4 h-4 text-gray-400" />
                        Edit this field
                    </button>
                </>
            )}
        </div>,
        document.body
    );
}
