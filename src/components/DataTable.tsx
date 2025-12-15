import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Trash2, Copy, Check, ChevronDown, ChevronRight, ChevronLeft, Plus, LayoutGrid, ArrowUp, ArrowDown, X, ArrowUpDown, Search, Filter, Maximize2 } from 'lucide-react';
import { SingleSelect, SearchInput } from './fields';
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
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../utils/cn';

// ============ Sortable Sort Rule Item ============
function SortableSortRule({
    rule,
    columns,
    onUpdate,
    onRemove
}: {
    rule: { id: string; key: string; direction: 'asc' | 'desc' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: ColumnDef<any>[];
    onUpdate: (updates: Partial<typeof rule>) => void;
    onRemove: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: rule.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className={cn("flex items-center gap-2", isDragging && "opacity-50")}>
            <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
                <GripVertical className="w-4 h-4" />
            </div>
            <select
                value={rule.key}
                onChange={(e) => onUpdate({ key: e.target.value })}
                className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
            >
                {columns.map(col => (
                    <option key={col.key} value={col.key}>{col.header}</option>
                ))}
            </select>
            <select
                value={rule.direction}
                onChange={(e) => onUpdate({ direction: e.target.value as 'asc' | 'desc' })}
                className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
            >
                <option value="asc">A → Z</option>
                <option value="desc">Z → A</option>
            </select>
            <button
                onClick={onRemove}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ============ Types ============

export interface ColumnDef<T> {
    key: string;
    header: string;
    width?: number;
    minWidth?: number;
    editable?: boolean;
    type?: 'text' | 'textarea' | 'select' | 'badge' | 'date' | 'custom';
    options?: { label: string; value: string | number }[] | ((row: T) => { label: string; value: string | number }[]);
    filterOptions?: { label: string; value: string | number }[]; // Static options for filter dropdown (use when options is a function)
    colorMap?: Record<string, string>;
    render?: (value: unknown, row: T, isEditing: boolean, expandText?: boolean) => React.ReactNode;
    getValue?: (row: T) => unknown;
}

export interface DataTableProps<T> {
    columns: ColumnDef<T>[];
    data: T[];
    isLoading?: boolean;
    emptyMessage?: string;

    // Row identification
    getRowId: (row: T) => string;

    // Editing
    onUpdate?: (id: string, field: string, value: unknown) => Promise<void> | void;

    // Row actions
    onDelete?: (id: string) => void;
    onCopy?: (row: T) => void;
    onDuplicate?: (row: T) => void;

    // Inline row creation (no popup)
    onCreateRow?: () => Promise<T> | T;

    showRowActions?: boolean;

    // Drag & drop
    sortable?: boolean;
    onReorder?: (ids: string[]) => void;

    // Resize
    resizable?: boolean;

    // Wrap - per-column line wrapping
    wrapRules?: { columnKey: string; lines: '1' | '2' | '3' | 'full' }[];
    onWrapRulesChange?: (rules: { columnKey: string; lines: '1' | '2' | '3' | 'full' }[]) => void;

    // Fullscreen spreadsheet mode - fills viewport with grid lines
    fullscreen?: boolean;

    // Grouping
    groupRules?: { id: string; key: string; direction: 'asc' | 'desc' }[];
    onGroupRulesChange?: (rules: { id: string; key: string; direction: 'asc' | 'desc' }[]) => void;

    // Column order (for drag-to-reorder columns)
    columnOrder?: string[];
    onColumnOrderChange?: (order: string[]) => void;

    // Column widths persistence
    savedColumnWidths?: Record<string, number>;
    onColumnWidthsChange?: (widths: Record<string, number>) => void;

    // View persistence (per-user and shared settings)
    viewId?: string;
    userId?: string;
    initialPreferences?: {
        sort_config?: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        filter_config?: Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>;
        group_config?: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        wrap_config?: Array<{ columnKey: string; lines: '1' | '3' | 'full' }>;
        row_order?: string[];
        column_widths?: Record<string, number>;
        column_order?: string[];
    };
    sharedPreferences?: {
        sort_config?: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        filter_config?: Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>;
        group_config?: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        wrap_config?: Array<{ columnKey: string; lines: '1' | '3' | 'full' }>;
        row_order?: string[];
        column_widths?: Record<string, number>;
        column_order?: string[];
    };
    onPreferencesChange?: (preferences: {
        sort_config: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        filter_config: Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>;
        group_config: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        wrap_config: Array<{ columnKey: string; lines: '1' | '3' | 'full' }>;
        row_order?: string[];
        column_widths?: Record<string, number>;
        column_order?: string[];
    }) => void;
    onSaveForEveryone?: (preferences: {
        sort_config: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        filter_config: Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>;
        group_config: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        wrap_config: Array<{ columnKey: string; lines: '1' | '3' | 'full' }>;
        row_order?: string[];
        column_widths?: Record<string, number>;
        column_order?: string[];
    }) => void;
    onResetPreferences?: () => void;
}

// ============ Dropdown Menu (Portal-based) ============

interface DropdownMenuProps {
    options: { label: string; value: string }[];
    value: string;
    onSelect: (value: string) => void;
    onClear?: () => void;
    position: { top: number; left: number };
    colorMap?: Record<string, string>;
}

function DropdownMenu({ options, value, onSelect, onClear, position, colorMap }: DropdownMenuProps) {
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus search input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    // Find current selected option
    const selectedOption = options.find(o => String(o.value) === String(value));

    return (
        <div
            className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl min-w-[180px] overflow-hidden"
            style={{ top: position.top, left: position.left }}
        >
            {/* Selected value with X to clear (Notion-style) */}
            {selectedOption && value && (
                <div className="p-2 border-b border-gray-100">
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            colorMap?.[String(value)] || "bg-gray-100 text-gray-700"
                        )}
                    >
                        {selectedOption.label}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear?.();
                            }}
                            className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                </div>
            )}

            {/* Search Input */}
            <div className="p-2 border-b border-gray-100">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Find an option"
                        className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                </div>
            </div>

            {/* Hint text */}
            <div className="px-3 py-1.5 text-[10px] text-gray-400">
                Select an option
            </div>

            {/* Options List */}
            <div className="max-h-[200px] overflow-y-auto py-1">
                {filteredOptions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400 italic whitespace-nowrap">
                        No options found
                    </div>
                ) : (
                    filteredOptions.map((opt) => (
                        <div
                            key={opt.value}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(opt.value);
                            }}
                            className={cn(
                                "px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 transition-colors whitespace-nowrap flex items-center gap-2",
                                opt.value === value ? "bg-blue-50 text-blue-700" : "text-gray-700"
                            )}
                        >
                            <span
                                className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                    colorMap?.[String(opt.value)] || "bg-gray-100 text-gray-700"
                                )}
                            >
                                {opt.label}
                            </span>
                            {opt.value === value && (
                                <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ============ Column Context Menu (Right-click on header) ============

interface ColumnContextMenuProps {
    columnKey: string;
    columnHeader: string;
    columnType?: string;
    position: { top: number; left: number };
    onGroupBy: (columnKey: string) => void;
    onSort: (columnKey: string, direction: 'asc' | 'desc') => void;
    onFilter: (columnKey: string) => void;
    onClose: () => void;
    isGroupedBy: boolean;
    sortRules: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
}

function ColumnContextMenu({
    columnKey,
    columnHeader,
    columnType,
    position,
    onGroupBy,
    onSort,
    onFilter,
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
                    {columnType === 'select' || columnType === 'badge' ? 'Single Select' :
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
        </div>,
        document.body
    );
}

// ============ Group Header Component ============

interface GroupHeaderProps {
    groupValue: string;
    count: number;
    isCollapsed: boolean;
    onToggle: () => void;
    colSpan: number;
    colorClass?: string;
    level?: number;
}

function GroupHeader({ groupValue, count, isCollapsed, onToggle, colSpan, colorClass, level = 0 }: GroupHeaderProps) {
    return (
        <tr className="bg-gray-50 border-b border-gray-200">
            <td colSpan={colSpan} className="px-2 py-1.5">
                <button
                    type="button"
                    onClick={onToggle}
                    style={{ paddingLeft: `${level * 20}px` }}
                    className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors w-full"
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium",
                        colorClass || "bg-gray-500 text-white"
                    )}>
                        {groupValue}
                    </span>
                    <span className="text-gray-400 text-[10px]">
                        {count} {count === 1 ? 'item' : 'items'}
                    </span>
                </button>
            </td>
        </tr>
    );
}

// ============ Sortable Row ============

interface SortableRowProps<T> {
    row: T;
    rowId: string;
    columns: ColumnDef<T>[];
    columnWidths: Record<string, number>;
    sortable: boolean;
    showRowActions: boolean;
    editingCell: { id: string; field: string } | null;
    editingValue: string;
    wrapRules: { columnKey: string; lines: '1' | '2' | '3' | 'full' }[];
    dropdownPosition: { top: number; left: number; width: number; cellHeight: number };
    onEditStart: (row: T, field: string, event: React.MouseEvent) => void;
    onEditChange: (value: string) => void;
    onEditSave: (value?: string) => void;
    onEditCancel: () => void;
    onDelete?: (id: string) => void;
    onCopy?: (row: T) => void;
    onDuplicate?: (row: T) => void;
    copiedId: string | null;
    // Native HTML5 drag handlers
    onRowDragStart: (e: React.DragEvent<HTMLTableRowElement>) => void;
    onRowDragEnd: () => void;
    onRowDragEnter: (e: React.DragEvent<HTMLTableRowElement>) => void;
    onRowDragOver: (e: React.DragEvent<HTMLTableRowElement>) => void;
    onRowDragLeave: (e: React.DragEvent<HTMLTableRowElement>) => void;
    onRowDrop: (e: React.DragEvent<HTMLTableRowElement>) => void;
    isDragging: boolean;
    isDragOver: boolean;
}

function SortableRow<T>({
    row,
    rowId,
    columns,
    columnWidths,
    sortable,
    showRowActions,
    editingCell,
    editingValue,
    wrapRules,
    dropdownPosition,
    onEditStart,
    onEditChange,
    onEditSave,
    onEditCancel,
    onDelete,
    onCopy,
    onDuplicate,
    copiedId,
    onRowDragStart,
    onRowDragEnd,
    onRowDragEnter,
    onRowDragOver,
    onRowDragLeave,
    onRowDrop,
    isDragging,
}: SortableRowProps<T>) {
    const rowRef = useRef<HTMLTableRowElement>(null);
    const [indicatorRect, setIndicatorRect] = useState<{ top: number; left: number; width: number } | null>(null);

    const inputRef = useRef<HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement>(null);

    useEffect(() => {
        if (editingCell?.id === rowId && inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current instanceof HTMLTextAreaElement) {
                inputRef.current.style.height = 'auto';
                inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
            }
            // Auto-open dropdown for select elements
            if (inputRef.current instanceof HTMLSelectElement) {
                // Use showPicker() if available (modern browsers)
                if ('showPicker' in inputRef.current) {
                    try {
                        (inputRef.current as HTMLSelectElement).showPicker();
                    } catch (e) {
                        // Fallback: trigger click to open dropdown
                        inputRef.current.click();
                    }
                }
            }
        }
    }, [editingCell, rowId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onEditSave();
        } else if (e.key === 'Escape') {
            onEditCancel();
        }
    };

    return (
        <>
            {/* Drop indicator rendered via portal - completely outside table structure */}
            {indicatorRect !== null && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: indicatorRect.left,
                        top: indicatorRect.top,
                        width: indicatorRect.width,
                        height: '2px',
                        background: '#3b82f6',
                        zIndex: 9999,
                        pointerEvents: 'none',
                    }}
                />,
                document.body
            )}
            <tr
                ref={rowRef}
                style={{
                    opacity: isDragging ? 0.5 : 1,
                }}
                className="group hover:bg-gray-50"
                draggable={sortable}
                onDragStart={onRowDragStart}
                onDragEnd={onRowDragEnd}
                onDragEnter={onRowDragEnter}
                onDragOver={(e) => {
                    onRowDragOver(e);
                    // Update indicator position directly for immediate feedback
                    if (rowRef.current) {
                        const rect = rowRef.current.getBoundingClientRect();
                        setIndicatorRect({ top: rect.top, left: rect.left, width: rect.width });
                    }
                }}
                onDragLeave={(e) => {
                    onRowDragLeave(e);
                    // Clear indicator when leaving this row
                    setIndicatorRect(null);
                }}
                onDrop={(e) => {
                    onRowDrop(e);
                    setIndicatorRect(null);
                }}
            >
                {/* Drag Handle */}
                {sortable && (
                    <td className="data-grid-td w-10 px-2">
                        <div className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4" />
                        </div>
                    </td>
                )}


                {/* Data Columns */}
                {columns.map((col) => {
                    const value = col.getValue ? col.getValue(row) : (row as Record<string, unknown>)[col.key];
                    const isEditing = editingCell?.id === rowId && editingCell?.field === col.key;
                    const width = columnWidths[col.key] || col.width || 100;

                    // Resolve options if they are a function
                    const options = typeof col.options === 'function' ? col.options(row) : col.options;

                    // Get wrap setting for this column
                    const wrapRule = wrapRules.find(r => r.columnKey === col.key);
                    const wrapLines = wrapRule?.lines;

                    return (
                        <td
                            key={col.key}
                            className={cn(
                                "data-grid-td px-2 relative",
                                wrapLines !== 'full' && "overflow-hidden"
                            )}
                            style={{
                                width,
                                maxWidth: width,
                                ...((!wrapLines || wrapLines === '1') && { maxHeight: '34px' }),
                                ...(wrapLines === '2' && { maxHeight: '56px' }),
                                ...(wrapLines === '3' && { maxHeight: '76px' })
                            }}
                        >
                            {/* Check for editing FIRST - takes priority over custom render */}
                            {isEditing && col.editable ? (
                                col.type === 'select' || col.type === 'badge' ? (
                                    <>
                                        {/* Show blank placeholder when empty, otherwise show value with ring */}
                                        {value ? (
                                            <span
                                                className={cn(
                                                    "inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium whitespace-nowrap ring-2 ring-blue-400 ml-2",
                                                    col.colorMap?.[String(value)] || "bg-gray-100 text-gray-700"
                                                )}
                                            >
                                                {options?.find(o => String(o.value) === String(value))?.label || String(value)}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center h-6 px-2 rounded ring-2 ring-blue-400 bg-gray-50 min-w-[60px]" />
                                        )}
                                        {createPortal(
                                            <>
                                                {/* Backdrop to close on click outside */}
                                                <div
                                                    className="fixed inset-0 z-[9998]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditCancel();
                                                    }}
                                                />
                                                {/* Dropdown menu */}
                                                <DropdownMenu
                                                    options={(options || []).map(o => ({ ...o, value: String(o.value) }))}
                                                    value={editingValue}
                                                    onSelect={(val: string) => {
                                                        onEditSave(val);
                                                    }}
                                                    onClear={() => {
                                                        onEditSave('');
                                                    }}
                                                    position={dropdownPosition}
                                                    colorMap={col.colorMap}
                                                />
                                            </>,
                                            document.body
                                        )}
                                    </>
                                ) : col.type === 'textarea' || col.type === 'text' ? (
                                    <>
                                        {/* Popup editor via portal - overlays the cell */}
                                        {createPortal(
                                            <>
                                                {/* Backdrop */}
                                                <div
                                                    className="fixed inset-0 z-[9998]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditSave();
                                                    }}
                                                />
                                                {/* Popup Editor - Notion style with smart positioning */}
                                                {(() => {
                                                    const spaceBelow = window.innerHeight - dropdownPosition.top - 50;
                                                    const spaceAbove = dropdownPosition.top - 50;
                                                    const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
                                                    const maxH = showAbove ? spaceAbove : spaceBelow;

                                                    return (
                                                        <textarea
                                                            ref={(el) => {
                                                                (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                                                                if (el) {
                                                                    el.style.height = 'auto';
                                                                    const newHeight = Math.min(el.scrollHeight, maxH);
                                                                    el.style.height = `${Math.max(34, newHeight)}px`;
                                                                    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
                                                                    // If showing above, adjust position after height is calculated
                                                                    if (showAbove) {
                                                                        el.style.top = `${dropdownPosition.top - Math.max(34, newHeight)}px`;
                                                                    }
                                                                }
                                                            }}
                                                            value={editingValue}
                                                            onChange={(e) => {
                                                                onEditChange(e.target.value);
                                                                const el = e.target;
                                                                el.style.height = 'auto';
                                                                const newHeight = Math.min(el.scrollHeight, maxH);
                                                                el.style.height = `${Math.max(34, newHeight)}px`;
                                                                el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
                                                                if (showAbove) {
                                                                    el.style.top = `${dropdownPosition.top - Math.max(34, newHeight)}px`;
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Escape') {
                                                                    onEditCancel();
                                                                }
                                                            }}
                                                            className="fixed z-[9999] bg-white shadow-xl border border-gray-300 rounded text-[13px] text-gray-700 resize-none focus:outline-none focus:border-blue-400"
                                                            style={{
                                                                top: showAbove ? undefined : dropdownPosition.top,
                                                                bottom: showAbove ? `${window.innerHeight - dropdownPosition.top}px` : undefined,
                                                                left: Math.max(8, Math.min(dropdownPosition.left, window.innerWidth - dropdownPosition.width - 8)),
                                                                width: dropdownPosition.width,
                                                                padding: '8px 12px',
                                                            }}
                                                            placeholder="Enter text..."
                                                            autoFocus
                                                        />
                                                    );
                                                })()}
                                            </>,
                                            document.body
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Popup editor via portal - overlays the cell */}
                                        {createPortal(
                                            <>
                                                {/* Backdrop */}
                                                <div
                                                    className="fixed inset-0 z-[9998]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditSave();
                                                    }}
                                                />
                                                {/* Input Editor - Notion style */}
                                                <input
                                                    ref={inputRef as React.RefObject<HTMLInputElement>}
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => onEditChange(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            onEditSave();
                                                        } else if (e.key === 'Escape') {
                                                            onEditCancel();
                                                        }
                                                    }}
                                                    className="fixed z-[9999] bg-white shadow-xl border border-gray-300 rounded text-[13px] text-gray-700 focus:outline-none focus:border-blue-400"
                                                    style={{
                                                        top: dropdownPosition.top,
                                                        left: Math.max(8, Math.min(dropdownPosition.left, window.innerWidth - dropdownPosition.width - 8)),
                                                        width: dropdownPosition.width,
                                                        height: '34px',
                                                        padding: '8px 12px',
                                                    }}
                                                    placeholder="Enter text..."
                                                    autoFocus
                                                />
                                            </>,
                                            document.body
                                        )}
                                    </>
                                )
                            ) : col.render ? (
                                // Custom render for display mode only - wrap in clickable div if editable
                                <div
                                    className={col.editable ? "cursor-pointer" : ""}
                                    onClick={(e) => col.editable && onEditStart(row, col.key, e)}
                                >
                                    {col.render(value, row, isEditing, wrapLines === 'full')}
                                </div>
                            ) : (
                                // Default display mode
                                col.type === 'badge' || col.type === 'select' ? (
                                    !value ? (
                                        <span
                                            className="cursor-pointer w-full h-full block min-h-[20px]"
                                            onClick={(e) => col.editable && onEditStart(row, col.key, e)}
                                        />
                                    ) : (
                                        <span
                                            className={cn(
                                                "inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium cursor-pointer hover:opacity-80 whitespace-nowrap transition-opacity ml-2",
                                                col.colorMap?.[String(value)] || "bg-gray-500 text-white"
                                            )}
                                            onClick={(e) => col.editable && onEditStart(row, col.key, e)}
                                        >
                                            {options?.find(o => String(o.value) === String(value))?.label || String(value)}
                                        </span>
                                    )
                                ) : col.type === 'date' ? (
                                    <span className="text-[13px] text-gray-500 px-3 py-2 block">
                                        {value ? new Date(String(value)).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        }) : '-'}
                                    </span>
                                ) : (
                                    <p
                                        className={cn(
                                            "text-[13px] text-gray-700 cursor-pointer hover:text-blue-600 transition-colors px-3 overflow-hidden",
                                            (!wrapLines || wrapLines === '1') && "line-clamp-1 leading-[34px]",
                                            wrapLines === '2' && "line-clamp-2 py-2 leading-[20px]",
                                            wrapLines === '3' && "line-clamp-3 py-2 leading-[20px]",
                                            wrapLines === 'full' && "whitespace-pre-wrap py-2 leading-relaxed"
                                        )}
                                        onClick={(e) => col.editable && onEditStart(row, col.key, e)}
                                    >
                                        {String(value || '-')}
                                    </p>
                                )
                            )}
                        </td>
                    );
                })}

                {/* Row Actions */}
                {showRowActions && (
                    <td className="data-grid-td px-2 w-20">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onDuplicate && (
                                <button
                                    onClick={() => onDuplicate(row)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="Duplicate"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            )}
                            {onCopy && (
                                <button
                                    onClick={() => onCopy(row)}
                                    className={cn(
                                        "p-1 rounded transition-colors",
                                        copiedId === rowId
                                            ? "text-green-600 bg-green-50"
                                            : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                    )}
                                    title="Copy Text"
                                >
                                    {copiedId === rowId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={() => onDelete(rowId)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </td>
                )}
            </tr>
        </>
    );
}

// Memoized SortableRow to prevent re-renders of unchanged rows
const MemoizedSortableRow = React.memo(SortableRow) as typeof SortableRow;

// ============ Main DataTable Component ============

export function DataTable<T>({
    columns,
    data,
    isLoading = false,
    emptyMessage = 'No data found.',
    getRowId,
    onUpdate,
    onDelete,
    onCopy,
    onDuplicate,
    onCreateRow,
    showRowActions = true,
    sortable = false,
    onReorder,
    resizable = true,
    wrapRules: externalWrapRules,
    onWrapRulesChange,
    fullscreen = false,
    groupRules: externalGroupRules,
    onGroupRulesChange,
    columnOrder: externalColumnOrder,
    onColumnOrderChange,
    savedColumnWidths,
    onColumnWidthsChange,
    // View persistence props
    viewId,
    userId,
    initialPreferences,
    sharedPreferences,
    onPreferencesChange,
    onSaveForEveryone,
    onResetPreferences
}: DataTableProps<T>) {
    // Initialize wrap rules from preferences
    const getInitialWrapRules = (): Array<{ columnKey: string; lines: '1' | '2' | '3' | 'full' }> => {
        if (initialPreferences?.wrap_config && initialPreferences.wrap_config.length > 0) {
            return initialPreferences.wrap_config as Array<{ columnKey: string; lines: '1' | '2' | '3' | 'full' }>;
        }
        if (sharedPreferences?.wrap_config && sharedPreferences.wrap_config.length > 0) {
            return sharedPreferences.wrap_config as Array<{ columnKey: string; lines: '1' | '2' | '3' | 'full' }>;
        }
        return [];
    };

    // Wrap state (per-column line wrapping, managed internally if not provided externally)
    const [internalWrapRules, setInternalWrapRules] = useState<Array<{ columnKey: string; lines: '1' | '2' | '3' | 'full' }>>(getInitialWrapRules);
    const wrapRules = externalWrapRules || internalWrapRules;
    const setWrapRules = (newRules: Array<{ columnKey: string; lines: '1' | '2' | '3' | 'full' }>) => {
        if (onWrapRulesChange) {
            onWrapRulesChange(newRules);
        } else {
            setInternalWrapRules(newRules);
        }
    };

    // Initialize group rules from preferences
    const getInitialGroupRules = (): Array<{ id: string; key: string; direction: 'asc' | 'desc' }> => {
        if (initialPreferences?.group_config && initialPreferences.group_config.length > 0) {
            return initialPreferences.group_config;
        }
        if (sharedPreferences?.group_config && sharedPreferences.group_config.length > 0) {
            return sharedPreferences.group_config;
        }
        return [];
    };

    // Grouping state (managed internally if not provided externally)
    const [internalGroupRules, setInternalGroupRules] = useState<Array<{ id: string; key: string; direction: 'asc' | 'desc' }>>(getInitialGroupRules);

    const groupRules = externalGroupRules || internalGroupRules;
    const setGroupRules = useMemo(() => {
        return (newRules: Array<{ id: string; key: string; direction: 'asc' | 'desc' }> | ((prev: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>) => Array<{ id: string; key: string; direction: 'asc' | 'desc' }>)) => {
            if (onGroupRulesChange) {
                // If using external state, we can't fully support functional updates easily without the current value, 
                // but usually we can assume the parent handles it. 
                // However, for verify/toggle logic, we often need 'prev'.
                // Ideally, onGroupRulesChange should take the new array.
                // We'll calculate new rules based on current 'groupRules' prop if possible.
                // But for now, let's just support 'setInternal' style logic if we can, or just call the prop.

                // If newRules is a function, resolve it
                let resolved: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
                if (typeof newRules === 'function') {
                    resolved = newRules(groupRules);
                } else {
                    resolved = newRules;
                }
                onGroupRulesChange(resolved);
            } else {
                setInternalGroupRules(newRules);
            }
        };
    }, [groupRules, onGroupRulesChange]);

    // Handle group by change (toggles or adds)
    const handleGroupByChange = (columnKey: string | null) => {
        if (columnKey === null) {
            setGroupRules([]);
            return;
        }

        setGroupRules(prev => {
            // Check if already grouped by this column
            const exists = prev.find(r => r.key === columnKey);
            if (exists) {
                // If it's the only one, remove it (toggle off)
                // If there are others, remove it (remove from group)
                return prev.filter(r => r.key !== columnKey);
            } else {
                // Add to end
                return [...prev, { id: `${columnKey}-${Date.now()}`, key: columnKey, direction: 'asc' }];
            }
        });
    };


    // Column widths state - prefer initialPreferences over savedColumnWidths
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const widths: Record<string, number> = {};
        const preferenceWidths = initialPreferences?.column_widths || savedColumnWidths;
        columns.forEach((col) => {
            // Use saved width if available, otherwise use column default or 120px
            widths[col.key] = preferenceWidths?.[col.key] || col.width || 120;
        });
        return widths;
    });

    // Sync columnWidths when savedColumnWidths or initialPreferences.column_widths changes
    useEffect(() => {
        const preferenceWidths = initialPreferences?.column_widths || savedColumnWidths;
        if (preferenceWidths && Object.keys(preferenceWidths).length > 0) {
            setColumnWidths(prev => {
                const updated = { ...prev };
                for (const [key, width] of Object.entries(preferenceWidths)) {
                    if (typeof width === 'number') {
                        updated[key] = width;
                    }
                }
                return updated;
            });
        }
    }, [savedColumnWidths, initialPreferences?.column_widths]);

    // Notify parent when column widths change (for persistence)
    const _handleColumnResize = useCallback((key: string, width: number) => {
        setColumnWidths(prev => {
            const updated = { ...prev, [key]: width };
            // Notify parent for persistence
            if (onColumnWidthsChange) {
                onColumnWidthsChange(updated);
            }
            return updated;
        });
    }, [onColumnWidthsChange]);

    // Column order state
    const [internalColumnOrder, setInternalColumnOrder] = useState<string[]>(() =>
        columns.map(c => c.key)
    );
    const columnOrder = externalColumnOrder || internalColumnOrder;

    // Sync internalColumnOrder when externalColumnOrder prop changes (async load from DB)
    useEffect(() => {
        if (externalColumnOrder && externalColumnOrder.length > 0) {
            setInternalColumnOrder(externalColumnOrder);
        }
    }, [externalColumnOrder]);

    // Ordered columns based on columnOrder
    const orderedColumns = useMemo(() => {
        const colMap = new Map(columns.map(c => [c.key, c]));
        const ordered: typeof columns = [];

        // Add columns in order
        for (const key of columnOrder) {
            const col = colMap.get(key);
            if (col) {
                ordered.push(col);
                colMap.delete(key);
            }
        }

        // Add any remaining columns not in order (new columns)
        for (const col of colMap.values()) {
            ordered.push(col);
        }

        return ordered;
    }, [columns, columnOrder]);

    // Handle column reorder - now works with orderedColumns to include new columns
    const handleColumnReorder = useCallback((draggedKey: string, targetKey: string) => {
        // Build new order from orderedColumns (which includes all columns, even new ones)
        const currentOrderedKeys = orderedColumns.map(c => c.key);
        const draggedIndex = currentOrderedKeys.indexOf(draggedKey);
        const targetIndex = currentOrderedKeys.indexOf(targetKey);

        if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

        const newOrder = [...currentOrderedKeys];
        const [removed] = newOrder.splice(draggedIndex, 1);

        // Adjust target index: when dragging from left to right, after removing the dragged item,
        // indices shift down. So if we want to insert at the visual target position, we need to
        // account for this shift. When dragging right to left, no adjustment needed.
        const adjustedTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
        newOrder.splice(adjustedTargetIndex, 0, removed);

        if (onColumnOrderChange) {
            onColumnOrderChange(newOrder);
        } else {
            setInternalColumnOrder(newOrder);
        }
    }, [orderedColumns, onColumnOrderChange]);

    // Resize tracking
    const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

    // Editing state
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number; cellHeight: number }>({ top: 0, left: 0, width: 200, cellHeight: 34 });

    // Copy state
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Native row drag state
    const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
    const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

    // Native column drag state
    const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
    const [dragOverColumnKey, setDragOverColumnKey] = useState<string | null>(null);
    const [columnIndicatorRect, setColumnIndicatorRect] = useState<{ top: number; left: number; height: number } | null>(null);

    // Collapsed groups state
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Multi-sort state (managed by DataTable)
    // Initialize from user preferences, fall back to shared preferences
    const getInitialSortRules = () => {
        if (initialPreferences?.sort_config && initialPreferences.sort_config.length > 0) {
            return initialPreferences.sort_config;
        }
        if (sharedPreferences?.sort_config && sharedPreferences.sort_config.length > 0) {
            return sharedPreferences.sort_config;
        }
        return [];
    };
    const [sortRules, setSortRules] = useState<Array<{ id: string; key: string; direction: 'asc' | 'desc' }>>(getInitialSortRules);

    // Grouping state
    // Grouping state is managed above (lines 588+)


    // Sort panel visibility
    const [showSortPanel, setShowSortPanel] = useState(false);
    const [sortSearch, setSortSearch] = useState('');
    const sortPanelRef = useRef<HTMLDivElement>(null);

    // Group panel visibility
    const [showGroupPanel, setShowGroupPanel] = useState(false);
    const [groupSearch, setGroupSearch] = useState('');
    const groupPanelRef = useRef<HTMLDivElement>(null);

    // Wrap panel visibility
    const [showWrapPanel, setShowWrapPanel] = useState(false);
    const [wrapSearch, setWrapSearch] = useState('');
    const wrapPanelRef = useRef<HTMLDivElement>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const rowsPerPageOptions = [10, 25, 50, 100, 200];

    // Inline row creation state
    const [isCreating, setIsCreating] = useState(false);

    // Filter state - Notion-style filtering
    type FilterOperator = 'contains' | 'does_not_contain' | 'is' | 'is_not' | 'is_empty' | 'is_not_empty';
    interface FilterRule {
        id: string;
        field: string;
        operator: FilterOperator;
        value: string;
        conjunction: 'and' | 'or';
    }
    const getInitialFilterRules = (): FilterRule[] => {
        if (initialPreferences?.filter_config && initialPreferences.filter_config.length > 0) {
            return initialPreferences.filter_config as FilterRule[];
        }
        if (sharedPreferences?.filter_config && sharedPreferences.filter_config.length > 0) {
            return sharedPreferences.filter_config as FilterRule[];
        }
        return [];
    };
    const [filterRules, setFilterRules] = useState<FilterRule[]>(getInitialFilterRules);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterSearch, setFilterSearch] = useState('');
    const filterPanelRef = useRef<HTMLDivElement>(null);

    // Track if preferences have been loaded (to avoid resetting after user makes changes)
    const preferencesLoadedRef = useRef(false);
    // Track if we've applied user-specific preferences (not just shared)
    const userPrefsAppliedRef = useRef(false);

    // Sync state when preferences are loaded after initial mount
    // User preferences take priority over shared preferences
    useEffect(() => {
        // User preferences take priority - always apply them if they arrive
        if (initialPreferences) {
            if (userPrefsAppliedRef.current) return;

            userPrefsAppliedRef.current = true;
            preferencesLoadedRef.current = true;

            // Apply user preferences
            if (initialPreferences.sort_config?.length) {
                setSortRules(initialPreferences.sort_config);
            }
            if (initialPreferences.filter_config?.length) {
                setFilterRules(initialPreferences.filter_config as FilterRule[]);
            }
            if (!externalGroupRules && initialPreferences.group_config?.length) {
                setInternalGroupRules(initialPreferences.group_config);
            }
            if (!externalWrapRules && initialPreferences.wrap_config?.length) {
                setInternalWrapRules(initialPreferences.wrap_config as Array<{ columnKey: string; lines: '1' | '2' | '3' | 'full' }>);
            }
            // Apply column widths from user preferences (handled in separate useEffect above)
            // Apply column order from user preferences
            if (initialPreferences.column_order?.length) {
                setInternalColumnOrder(initialPreferences.column_order);
            }
            return;
        }

        // Fall back to shared preferences if no user preferences
        if (preferencesLoadedRef.current || !sharedPreferences) return;

        preferencesLoadedRef.current = true;

        // Apply shared preferences
        if (sharedPreferences.sort_config?.length) {
            setSortRules(sharedPreferences.sort_config);
        }
        if (sharedPreferences.filter_config?.length) {
            setFilterRules(sharedPreferences.filter_config as FilterRule[]);
        }
        if (!externalGroupRules && sharedPreferences.group_config?.length) {
            setInternalGroupRules(sharedPreferences.group_config);
        }
        if (!externalWrapRules && sharedPreferences.wrap_config?.length) {
            setInternalWrapRules(sharedPreferences.wrap_config as Array<{ columnKey: string; lines: '1' | '2' | '3' | 'full' }>);
        }
        // Apply column order from shared preferences
        if (sharedPreferences.column_order?.length) {
            setInternalColumnOrder(sharedPreferences.column_order);
        }
    }, [initialPreferences, sharedPreferences, externalGroupRules, externalWrapRules]);

    // Fallback: Enable auto-save after 1 second if no preferences arrive
    // This ensures auto-save works for new users with no saved preferences
    useEffect(() => {
        if (preferencesLoadedRef.current) return;

        const timeout = setTimeout(() => {
            if (!preferencesLoadedRef.current) {
                preferencesLoadedRef.current = true;
            }
        }, 1000);

        return () => clearTimeout(timeout);
    }, []);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        columnKey: string;
        columnHeader: string;
        columnType?: string;
        position: { top: number; left: number };
    } | null>(null);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Apply filters first, then sort
    const filteredData = useMemo(() => {
        if (filterRules.length === 0) return data;

        return data.filter((row) => {
            let result = true; // Start with AND logic

            for (let i = 0; i < filterRules.length; i++) {
                const rule = filterRules[i];
                const col = columns.find(c => c.key === rule.field);
                const cellValue = col?.getValue ? col.getValue(row) : (row as Record<string, unknown>)[rule.field];
                const strValue = cellValue == null ? '' : String(cellValue).toLowerCase();
                const filterValue = rule.value.toLowerCase();

                let matches = false;
                switch (rule.operator) {
                    case 'contains':
                        matches = strValue.includes(filterValue);
                        break;
                    case 'does_not_contain':
                        matches = !strValue.includes(filterValue);
                        break;
                    case 'is':
                        matches = strValue === filterValue;
                        break;
                    case 'is_not':
                        matches = strValue !== filterValue;
                        break;
                    case 'is_empty':
                        matches = strValue === '' || cellValue == null;
                        break;
                    case 'is_not_empty':
                        matches = strValue !== '' && cellValue != null;
                        break;
                }

                // Apply conjunction logic
                if (i === 0) {
                    result = matches;
                } else if (rule.conjunction === 'and') {
                    result = result && matches;
                } else {
                    result = result || matches;
                }
            }

            return result;
        });
    }, [data, filterRules, columns]);

    // Compute sorted data (must be before groupedData) - supports multi-sort and grouping
    const sortedData = useMemo(() => {
        // Combine group rules and sort rules (groups take precedence)
        // Group rules need to act as "sort by group key asc/desc"
        const effectiveSortRules = [...groupRules, ...sortRules];

        if (effectiveSortRules.length === 0) return filteredData;

        const sorted = [...filteredData].sort((a, b) => {
            for (const rule of effectiveSortRules) {
                const col = columns.find(c => c.key === rule.key);
                const aVal = col?.getValue ? col.getValue(a) : (a as Record<string, unknown>)[rule.key];
                const bVal = col?.getValue ? col.getValue(b) : (b as Record<string, unknown>)[rule.key];

                // Handle null/undefined
                if (aVal == null && bVal == null) continue;
                if (aVal == null) return 1;
                if (bVal == null) return -1;

                // Compare
                // Try number comparison first if looks like number
                const aNum = Number(aVal);
                const bNum = Number(bVal);
                let comparison = 0;

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    comparison = aNum - bNum;
                } else {
                    const aStr = String(aVal).toLowerCase();
                    const bStr = String(bVal).toLowerCase();
                    comparison = aStr.localeCompare(bStr);
                }

                if (comparison !== 0) {
                    return rule.direction === 'asc' ? comparison : -comparison;
                }
            }
            return 0;
        });

        return sorted;
    }, [filteredData, sortRules, groupRules, columns]);

    // Pagination - compute paginated data from sorted data (only when not grouped)
    const totalRows = sortedData.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

    // Reset to page 1 if current page exceeds total pages
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage]);

    const paginatedData = useMemo(() => {
        // Don't paginate when grouping is active
        if (groupRules.length > 0) return sortedData;

        const startIdx = (currentPage - 1) * rowsPerPage;
        const endIdx = startIdx + rowsPerPage;
        return sortedData.slice(startIdx, endIdx);
    }, [sortedData, currentPage, rowsPerPage, groupRules.length]);

    // Recursive Grouping Logic
    type GroupNode = {
        id: string;
        key: string;
        value: string; // The display value
        level: number;
        count: number;
        children?: GroupNode[];
        rows?: T[];
        colorClass?: string;
    };

    const groupedData = useMemo(() => {
        if (groupRules.length === 0) return null;

        const buildGroups = (currentRows: T[], level: number, parentId: string): GroupNode[] => {
            const rule = groupRules[level];
            if (!rule) return []; // Should not happen if recursion is correct

            const groups = new Map<string, T[]>();
            const col = columns.find(c => c.key === rule.key);

            currentRows.forEach(row => {
                const value = col?.getValue
                    ? col.getValue(row)
                    : (row as any)[rule.key];
                const key = value === null || value === undefined || value === '' ? '(Empty)' : String(value);

                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key)!.push(row);
            });

            // Convert Map to Array and sort based on rule direction (already sorted by sortedData but good to ensure order)
            // actually sortedData handled the order, so we can just iterate the map in insertion order if we populated it correctly?
            // Map preserves insertion order. sortedData is sorted effectively.

            const nodes: GroupNode[] = [];
            groups.forEach((rows, key) => {
                const nodeId = `${parentId}-${rule.key}-${key}`;

                // Get display label
                let label = key;
                if (col?.options && Array.isArray(col.options)) {
                    const opt = col.options.find(o => String(o.value) === key);
                    if (opt) label = opt.label;
                }

                // Get color
                let colorClass = undefined;
                if (col?.colorMap) colorClass = col.colorMap[key];

                const node: GroupNode = {
                    id: nodeId,
                    key: rule.key,
                    value: label,
                    level,
                    count: rows.length,
                    colorClass
                };

                if (level < groupRules.length - 1) {
                    node.children = buildGroups(rows, level + 1, nodeId);
                } else {
                    node.rows = rows;
                }
                nodes.push(node);
            });

            return nodes;
        };

        return buildGroups(sortedData, 0, 'root');
    }, [sortedData, groupRules, columns]);



    // Toggle group collapse
    const toggleGroupCollapse = useCallback((groupKey: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    }, []);

    // Close sort/group panel when clicking outside
    // Helper to close all toolbar panels
    const closeAllPanels = useCallback(() => {
        setShowSortPanel(false);
        setShowFilterPanel(false);
        setShowGroupPanel(false);
        setShowWrapPanel(false);
    }, []);

    // Track if preferences have changed from initial/shared
    const getCurrentPreferences = useCallback(() => ({
        sort_config: sortRules,
        filter_config: filterRules as Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>,
        group_config: groupRules,
        wrap_config: wrapRules as Array<{ columnKey: string; lines: '1' | '3' | 'full' }>,
        column_widths: columnWidths,
        column_order: columnOrder
    }), [sortRules, filterRules, groupRules, wrapRules, columnWidths, columnOrder]);

    // Check if current preferences differ from shared preferences (or if any rules exist when no shared prefs)
    const hasUnsavedChanges = useMemo(() => {
        const current = getCurrentPreferences();

        // If no shared preferences, show Reset when ANY rules are active
        if (!sharedPreferences) {
            return (
                (current.sort_config?.length || 0) > 0 ||
                (current.filter_config?.length || 0) > 0 ||
                (current.group_config?.length || 0) > 0 ||
                (current.wrap_config?.length || 0) > 0
            );
        }

        // Compare with shared preferences
        const shared = sharedPreferences;
        const sortChanged = JSON.stringify(current.sort_config) !== JSON.stringify(shared.sort_config || []);
        const filterChanged = JSON.stringify(current.filter_config) !== JSON.stringify(shared.filter_config || []);
        const groupChanged = JSON.stringify(current.group_config) !== JSON.stringify(shared.group_config || []);
        const wrapChanged = JSON.stringify(current.wrap_config) !== JSON.stringify(shared.wrap_config || []);

        return sortChanged || filterChanged || groupChanged || wrapChanged;
    }, [getCurrentPreferences, sharedPreferences]);

    // Auto-save preferences when they change (debounced)
    const preferencesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstRenderRef = useRef(true);

    // Use a ref for the callback to avoid triggering effect when callback identity changes
    const onPreferencesChangeRef = useRef(onPreferencesChange);
    useEffect(() => {
        onPreferencesChangeRef.current = onPreferencesChange;
    }, [onPreferencesChange]);

    useEffect(() => {
        // Skip the first render to avoid saving empty preferences on mount
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return;
        }

        // Don't auto-save until initial preferences have been loaded
        // This prevents overwriting saved preferences with empty state during initial load
        if (!preferencesLoadedRef.current) return;
        if (!onPreferencesChangeRef.current) return;

        // Clear any pending timeout
        if (preferencesChangeTimeoutRef.current) {
            clearTimeout(preferencesChangeTimeoutRef.current);
        }

        // Debounce the save - wait 500ms after last change
        preferencesChangeTimeoutRef.current = setTimeout(() => {
            onPreferencesChangeRef.current?.(getCurrentPreferences());
        }, 500);

        return () => {
            if (preferencesChangeTimeoutRef.current) {
                clearTimeout(preferencesChangeTimeoutRef.current);
            }
        };
    }, [sortRules, filterRules, groupRules, wrapRules, columnWidths, columnOrder, getCurrentPreferences]);

    // Handle reset to shared preferences
    const handleReset = useCallback(() => {
        if (sharedPreferences) {
            setSortRules(sharedPreferences.sort_config || []);
            setFilterRules((sharedPreferences.filter_config || []) as FilterRule[]);
            setGroupRules(sharedPreferences.group_config || []);
            setWrapRules((sharedPreferences.wrap_config || []) as Array<{ columnKey: string; lines: '1' | '2' | '3' | 'full' }>);
            // Reset column widths to shared or default
            if (sharedPreferences.column_widths) {
                setColumnWidths(sharedPreferences.column_widths);
            } else {
                // Reset to column defaults
                const defaults: Record<string, number> = {};
                columns.forEach(col => { defaults[col.key] = col.width || 120; });
                setColumnWidths(defaults);
            }
            // Reset column order to shared or default
            if (sharedPreferences.column_order) {
                setInternalColumnOrder(sharedPreferences.column_order);
            } else {
                setInternalColumnOrder(columns.map(c => c.key));
            }
        } else {
            setSortRules([]);
            setFilterRules([]);
            setGroupRules([]);
            setWrapRules([]);
            // Reset column widths to defaults
            const defaults: Record<string, number> = {};
            columns.forEach(col => { defaults[col.key] = col.width || 120; });
            setColumnWidths(defaults);
            // Reset column order to default
            setInternalColumnOrder(columns.map(c => c.key));
        }
        onResetPreferences?.();
    }, [sharedPreferences, setGroupRules, setWrapRules, onResetPreferences, columns]);

    // Handle save for everyone
    const handleSaveForEveryone = useCallback(() => {
        if (onSaveForEveryone) {
            const preferences = getCurrentPreferences();
            onSaveForEveryone(preferences);
        }
    }, [getCurrentPreferences, onSaveForEveryone]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;

            // Check if click is inside a portaled SingleSelect dropdown
            const singleSelectDropdown = (target as Element).closest?.('[data-single-select-dropdown="true"]');
            if (singleSelectDropdown) return;

            const clickedInsideAnyPanel =
                (sortPanelRef.current && sortPanelRef.current.contains(target)) ||
                (filterPanelRef.current && filterPanelRef.current.contains(target)) ||
                (groupPanelRef.current && groupPanelRef.current.contains(target)) ||
                (wrapPanelRef.current && wrapPanelRef.current.contains(target));

            if (!clickedInsideAnyPanel) {
                closeAllPanels();
            }
        }
        if (showSortPanel || showFilterPanel || showGroupPanel || showWrapPanel) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showSortPanel, showFilterPanel, showGroupPanel, showWrapPanel, closeAllPanels]);

    // Handle sort from context menu (adds/replaces sort rule)
    const handleSort = useCallback((columnKey: string, direction: 'asc' | 'desc') => {
        setSortRules(prev => {
            // Check if this column already has a sort
            const existingIndex = prev.findIndex(r => r.key === columnKey);
            if (existingIndex >= 0) {
                // If same direction, remove the sort
                if (prev[existingIndex].direction === direction) {
                    return prev.filter((_, i) => i !== existingIndex);
                }
                // Otherwise update the direction
                const newRules = [...prev];
                newRules[existingIndex] = { ...prev[existingIndex], direction };
                return newRules;
            }
            // Add new sort rule
            return [...prev, { id: Math.random().toString(36).substr(2, 9), key: columnKey, direction }];
        });
    }, []);

    // Handle header right-click
    const handleHeaderContextMenu = useCallback((e: React.MouseEvent, col: ColumnDef<T>) => {
        e.preventDefault();
        setContextMenu({
            columnKey: col.key,
            columnHeader: col.header,
            position: { top: e.clientY, left: e.clientX }
        });
    }, []);

    // Resize handlers
    const handleResizeStart = useCallback((column: string, e: React.MouseEvent) => {
        if (!resizable) return;
        e.preventDefault();
        resizingRef.current = {
            column,
            startX: e.clientX,
            startWidth: columnWidths[column],
        };
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
    }, [columnWidths, resizable]);

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!resizingRef.current) return;
        const { column, startX, startWidth } = resizingRef.current;
        const delta = e.clientX - startX;
        const minWidth = columns.find(c => c.key === column)?.minWidth || 50;
        const newWidth = Math.max(minWidth, startWidth + delta);
        setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    }, [columns]);

    const handleResizeEnd = useCallback(() => {
        // Notify parent of final widths for persistence
        if (onColumnWidthsChange && resizingRef.current) {
            // Get current columnWidths state (closure captures the latest via setColumnWidths callback)
            setColumnWidths(currentWidths => {
                onColumnWidthsChange(currentWidths);
                return currentWidths; // Don't modify, just access
            });
        }
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
    }, [handleResizeMove, onColumnWidthsChange]);

    // Edit handlers
    const handleEditStart = useCallback((row: T, field: string, event: React.MouseEvent) => {
        const col = columns.find(c => c.key === field);
        if (!col?.editable) return;

        // Calculate position from the clicked element (cell)
        const target = event.currentTarget as HTMLElement;
        const cellElement = target.closest('td');
        const cellRect = cellElement ? cellElement.getBoundingClientRect() : target.getBoundingClientRect();
        setDropdownPosition({
            top: cellRect.top,
            left: cellRect.left,
            width: Math.max(cellRect.width, 300), // minimum 300px width
            cellHeight: cellRect.height,
        });

        const value = col.getValue ? col.getValue(row) : (row as Record<string, unknown>)[field];
        setEditingCell({ id: getRowId(row), field });
        setEditingValue(String(value || ''));
    }, [columns, getRowId]);

    const handleEditSave = useCallback(async (newValue?: string) => {
        if (!editingCell || !onUpdate) {
            setEditingCell(null);
            return;
        }

        const valueToSave = newValue !== undefined ? newValue : editingValue;

        try {
            await onUpdate(editingCell.id, editingCell.field, valueToSave);
        } catch (error) {
            console.error('Failed to update:', error);
        }
        setEditingCell(null);
    }, [editingCell, editingValue, onUpdate]);

    const handleEditCancel = useCallback(() => {
        setEditingCell(null);
        setEditingValue('');
    }, []);

    // Copy handler
    const handleCopy = useCallback((row: T) => {
        if (onCopy) {
            onCopy(row);
            setCopiedId(getRowId(row));
            setTimeout(() => setCopiedId(null), 2000);
        }
    }, [onCopy, getRowId]);

    // Inline row creation handler
    const handleCreateRow = useCallback(async () => {
        if (!onCreateRow || isCreating) return;

        setIsCreating(true);
        try {
            await onCreateRow();
            // Don't reload - parent component should optimistically update data
        } catch (error) {
            console.error('Failed to create row:', error);
        } finally {
            setIsCreating(false);
        }
    }, [onCreateRow, isCreating]);

    // Drag end handler
    const _handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !onReorder) return;

        const oldIndex = data.findIndex(row => getRowId(row) === active.id);
        const newIndex = data.findIndex(row => getRowId(row) === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = arrayMove(data.map(getRowId), oldIndex, newIndex);
            onReorder(newOrder);
        }
    }, [data, getRowId, onReorder]);

    // Create native drag handlers for a specific row
    const createRowDragHandlers = useCallback((rowId: string) => ({
        onRowDragStart: (e: React.DragEvent<HTMLTableRowElement>) => {
            setDraggingRowId(rowId);
            e.dataTransfer.setData('text/plain', rowId);
            e.dataTransfer.effectAllowed = 'move';
        },
        onRowDragEnd: () => {
            setDraggingRowId(null);
            setDragOverRowId(null);
        },
        onRowDragEnter: (e: React.DragEvent<HTMLTableRowElement>) => {
            e.preventDefault();
            if (draggingRowId && draggingRowId !== rowId) {
                setDragOverRowId(rowId);
            }
        },
        onRowDragOver: (e: React.DragEvent<HTMLTableRowElement>) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // Update dragOverRowId on every dragOver event for immediate visual feedback
            if (draggingRowId && draggingRowId !== rowId && dragOverRowId !== rowId) {
                setDragOverRowId(rowId);
            }
        },
        onRowDragLeave: (e: React.DragEvent<HTMLTableRowElement>) => {
            // Only clear if we're leaving to a non-child element
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (!e.currentTarget.contains(relatedTarget)) {
                if (dragOverRowId === rowId) {
                    setDragOverRowId(null);
                }
            }
        },
        onRowDrop: (e: React.DragEvent<HTMLTableRowElement>) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId !== rowId && onReorder) {
                const oldIndex = data.findIndex(row => getRowId(row) === draggedId);
                const newIndex = data.findIndex(row => getRowId(row) === rowId);
                if (oldIndex !== -1 && newIndex !== -1) {
                    const newOrder = arrayMove(data.map(getRowId), oldIndex, newIndex);
                    onReorder(newOrder);
                }
            }
            setDraggingRowId(null);
            setDragOverRowId(null);
        },
    }), [data, getRowId, onReorder, draggingRowId, dragOverRowId]);

    // Calculate total width
    const totalWidth = Object.values(columnWidths).reduce((a, b) => a + b, 0)
        + (sortable ? 40 : 0)  // Drag handle column (w-10 = 40px)
        + (showRowActions ? 80 : 0);  // Actions column (w-20 = 80px)

    const _rowIds = sortedData.map(getRowId);

    const handleSortDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setSortRules((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over!.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleGroupDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setGroupRules((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over!.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    return (
        <div className={cn(
            "bg-white border border-gray-200 shadow-sm",
            fullscreen ? "flex-1 flex flex-col h-full overflow-hidden" : "rounded-xl"
        )}>
            {/* Sort/Group Toolbar */}
            <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-gray-50 relative z-20 shadow-sm">
                {/* Sort Button */}
                <div className="relative">
                    <button
                        onClick={() => {
                            const wasOpen = showSortPanel;
                            closeAllPanels();
                            if (!wasOpen) setShowSortPanel(true);
                        }}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                            sortRules.length > 0
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        )}
                    >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        {sortRules.length === 0
                            ? 'Sort'
                            : sortRules.length === 1
                                ? `Sorted by ${columns.find(c => c.key === sortRules[0].key)?.header || sortRules[0].key}`
                                : `Sorted by ${sortRules.length} fields`}
                    </button>

                    {/* Sort Panel Popup */}
                    {showSortPanel && (
                        <div
                            ref={sortPanelRef}
                            className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[320px] z-50"
                        >
                            <div className="text-xs font-medium text-gray-500 mb-2">Sort by</div>

                            {sortRules.length > 0 ? (
                                <div className="space-y-2">
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleSortDragEnd}
                                    >
                                        <SortableContext items={sortRules} strategy={verticalListSortingStrategy}>
                                            {sortRules.map((rule) => (
                                                <SortableSortRule
                                                    key={rule.id}
                                                    rule={rule}
                                                    columns={orderedColumns}
                                                    onUpdate={(updates) => {
                                                        const newRules = [...sortRules];
                                                        const index = newRules.findIndex(r => r.id === rule.id);
                                                        if (index !== -1) {
                                                            newRules[index] = { ...newRules[index], ...updates };
                                                            setSortRules(newRules);
                                                        }
                                                    }}
                                                    onRemove={() => setSortRules(sortRules.filter(r => r.id !== rule.id))}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>

                                    {/* Add another sort button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setSortSearch(sortSearch === '' ? ' ' : '')}
                                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-1"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add another sort
                                        </button>

                                        {/* Sort field picker (shows when expanded) */}
                                        {sortSearch !== '' && (
                                            <div className="mt-2 border border-gray-200 rounded-lg bg-gray-50 p-2">
                                                <div className="mb-2">
                                                    <SearchInput
                                                        value={sortSearch.trim()}
                                                        onChange={(v) => setSortSearch(v || ' ')}
                                                        placeholder="Find a field"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="max-h-[150px] overflow-y-auto">
                                                    {columns
                                                        .filter(col => col.header.toLowerCase().includes(sortSearch.trim().toLowerCase()) && !sortRules.some(r => r.key === col.key))
                                                        .map(col => (
                                                            <button
                                                                key={col.key}
                                                                onClick={() => {
                                                                    setSortRules([...sortRules, {
                                                                        id: Math.random().toString(36).substr(2, 9),
                                                                        key: col.key,
                                                                        direction: 'asc'
                                                                    }]);
                                                                    setSortSearch('');
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-white rounded text-left transition-colors text-gray-700 hover:text-blue-600"
                                                            >
                                                                <span className="flex-1">{col.header}</span>
                                                            </button>
                                                        ))
                                                    }
                                                    {columns.filter(col => col.header.toLowerCase().includes(sortSearch.trim().toLowerCase()) && !sortRules.some(r => r.key === col.key)).length === 0 && (
                                                        <div className="px-2 py-1.5 text-xs text-gray-400 text-center">No more fields</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Initial field list when no sorts selected */
                                <>
                                    <div className="mb-2">
                                        <SearchInput
                                            value={sortSearch}
                                            onChange={setSortSearch}
                                            placeholder="Find a field"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {columns
                                            .filter(col => col.header.toLowerCase().includes(sortSearch.toLowerCase()))
                                            .map(col => (
                                                <button
                                                    key={col.key}
                                                    onClick={() => {
                                                        setSortRules([{
                                                            id: Math.random().toString(36).substr(2, 9),
                                                            key: col.key,
                                                            direction: 'asc'
                                                        }]);
                                                        setSortSearch('');
                                                    }}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded text-left transition-colors text-gray-700 hover:text-blue-600"
                                                >
                                                    <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                                                        <ArrowUpDown className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="flex-1">{col.header}</span>
                                                </button>
                                            ))
                                        }
                                        {columns.filter(col => col.header.toLowerCase().includes(sortSearch.toLowerCase())).length === 0 && (
                                            <div className="px-4 py-2 text-xs text-gray-400 text-center">No fields found</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Filter Button */}
                <div ref={filterPanelRef} className="relative">
                    <button
                        onClick={() => {
                            const wasOpen = showFilterPanel;
                            closeAllPanels();
                            if (!wasOpen) setShowFilterPanel(true);
                        }}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                            filterRules.length > 0
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        )}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        {filterRules.length === 0
                            ? 'Filter'
                            : filterRules.length === 1
                                ? `Filtered by ${columns.find(c => c.key === filterRules[0].field)?.header || filterRules[0].field}`
                                : `Filtered by ${filterRules.length} rules`}
                        {filterRules.length > 0 && (
                            <span
                                className="ml-1 p-0.5 hover:bg-green-200 rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFilterRules([]);
                                }}
                            >
                                <X className="w-3 h-3" />
                            </span>
                        )}
                    </button>

                    {/* Filter Panel Popup */}
                    {showFilterPanel && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[320px] z-50">
                            <div className="text-xs font-medium text-gray-500 mb-2">
                                {filterRules.length > 0 ? 'In this view, show records' : 'Filter by'}
                            </div>

                            {filterRules.length > 0 ? (
                                <div className="space-y-2">
                                    {/* Filter Rules */}
                                    <div className="space-y-2">
                                        {filterRules.map((rule, index) => (
                                            <div key={rule.id} className="flex items-center gap-2">
                                                {/* Conjunction (and/or) */}
                                                {index === 0 ? (
                                                    <div className="w-14 text-xs text-gray-500 text-right">Where</div>
                                                ) : (
                                                    <select
                                                        value={rule.conjunction}
                                                        onChange={(e) => setFilterRules(prev => prev.map(r =>
                                                            r.id === rule.id ? { ...r, conjunction: e.target.value as 'and' | 'or' } : r
                                                        ))}
                                                        className="w-14 text-xs px-1 py-1 border border-gray-200 rounded bg-gray-50"
                                                    >
                                                        <option value="and">and</option>
                                                        <option value="or">or</option>
                                                    </select>
                                                )}

                                                {/* Field */}
                                                <select
                                                    value={rule.field}
                                                    onChange={(e) => setFilterRules(prev => prev.map(r =>
                                                        r.id === rule.id ? { ...r, field: e.target.value } : r
                                                    ))}
                                                    className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded bg-white"
                                                >
                                                    {columns.map(col => (
                                                        <option key={col.key} value={col.key}>{col.header}</option>
                                                    ))}
                                                </select>

                                                {/* Operator - show different options for select vs text fields */}
                                                {(() => {
                                                    const col = columns.find(c => c.key === rule.field);
                                                    const rawOptions = col?.options;
                                                    const hasOptions = col?.filterOptions || Array.isArray(rawOptions);

                                                    return (
                                                        <select
                                                            value={rule.operator}
                                                            onChange={(e) => setFilterRules(prev => prev.map(r =>
                                                                r.id === rule.id ? { ...r, operator: e.target.value as FilterRule['operator'] } : r
                                                            ))}
                                                            className="w-32 text-xs px-2 py-1.5 border border-gray-200 rounded bg-white"
                                                        >
                                                            {hasOptions ? (
                                                                <>
                                                                    <option value="is">is</option>
                                                                    <option value="is_not">is not</option>
                                                                    <option value="is_empty">is empty</option>
                                                                    <option value="is_not_empty">is not empty</option>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <option value="contains">contains</option>
                                                                    <option value="does_not_contain">does not contain</option>
                                                                    <option value="is">is</option>
                                                                    <option value="is_not">is not</option>
                                                                    <option value="is_empty">is empty</option>
                                                                    <option value="is_not_empty">is not empty</option>
                                                                </>
                                                            )}
                                                        </select>
                                                    );
                                                })()}

                                                {/* Value - smart input based on column type */}
                                                {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && (() => {
                                                    const col = columns.find(c => c.key === rule.field);
                                                    const rawOptions = col?.options;
                                                    // Use filterOptions if available, otherwise use options if it's an array (not a function)
                                                    const colOptions = col?.filterOptions || (Array.isArray(rawOptions) ? rawOptions : undefined);

                                                    if (colOptions && colOptions.length > 0) {
                                                        // Column has options - use SingleSelect component
                                                        return (
                                                            <SingleSelect
                                                                value={rule.value}
                                                                options={colOptions}
                                                                onChange={(val) => setFilterRules(prev => prev.map(r =>
                                                                    r.id === rule.id ? { ...r, value: String(val) } : r
                                                                ))}
                                                                colorMap={col?.colorMap}
                                                                placeholder="Select..."
                                                                className="flex-1 border-gray-200"
                                                            />
                                                        );
                                                    } else {
                                                        // Regular text input
                                                        return (
                                                            <input
                                                                type="text"
                                                                value={rule.value}
                                                                onChange={(e) => setFilterRules(prev => prev.map(r =>
                                                                    r.id === rule.id ? { ...r, value: e.target.value } : r
                                                                ))}
                                                                placeholder="Enter a value"
                                                                className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                                                            />
                                                        );
                                                    }
                                                })()}

                                                {/* Delete */}
                                                <button
                                                    onClick={() => setFilterRules(prev => prev.filter(r => r.id !== rule.id))}
                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add another filter button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setFilterSearch(filterSearch === '' ? ' ' : '')}
                                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-1"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add condition
                                        </button>

                                        {/* Filter field picker (shows when expanded) */}
                                        {filterSearch !== '' && (
                                            <div className="mt-2 border border-gray-200 rounded-lg bg-gray-50 p-2">
                                                <div className="mb-2">
                                                    <SearchInput
                                                        value={filterSearch.trim()}
                                                        onChange={(v) => setFilterSearch(v || ' ')}
                                                        placeholder="Find a field"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="max-h-[150px] overflow-y-auto">
                                                    {columns
                                                        .filter(col => col.header.toLowerCase().includes(filterSearch.trim().toLowerCase()))
                                                        .map(col => (
                                                            <button
                                                                key={col.key}
                                                                onClick={() => {
                                                                    const hasOptions = col.filterOptions || Array.isArray(col.options);
                                                                    setFilterRules([...filterRules, {
                                                                        id: Math.random().toString(36).substring(2, 11),
                                                                        field: col.key,
                                                                        operator: hasOptions ? 'is' : 'contains',
                                                                        value: '',
                                                                        conjunction: 'and'
                                                                    }]);
                                                                    setFilterSearch('');
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-white rounded text-left transition-colors text-gray-700 hover:text-green-600"
                                                            >
                                                                <span className="flex-1">{col.header}</span>
                                                            </button>
                                                        ))
                                                    }
                                                    {columns.filter(col => col.header.toLowerCase().includes(filterSearch.trim().toLowerCase())).length === 0 && (
                                                        <div className="px-2 py-1.5 text-xs text-gray-400 text-center">No fields found</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Initial field list when no filters selected */
                                <>
                                    <div className="mb-2">
                                        <SearchInput
                                            value={filterSearch}
                                            onChange={setFilterSearch}
                                            placeholder="Find a field"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {columns
                                            .filter(col => col.header.toLowerCase().includes(filterSearch.toLowerCase()))
                                            .map(col => (
                                                <button
                                                    key={col.key}
                                                    onClick={() => {
                                                        const hasOptions = col.filterOptions || Array.isArray(col.options);
                                                        setFilterRules([{
                                                            id: Math.random().toString(36).substring(2, 11),
                                                            field: col.key,
                                                            operator: hasOptions ? 'is' : 'contains',
                                                            value: '',
                                                            conjunction: 'and'
                                                        }]);
                                                        setFilterSearch('');
                                                    }}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded text-left transition-colors text-gray-700 hover:text-green-600"
                                                >
                                                    <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                                                        <Filter className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="flex-1">{col.header}</span>
                                                </button>
                                            ))
                                        }
                                        {columns.filter(col => col.header.toLowerCase().includes(filterSearch.toLowerCase())).length === 0 && (
                                            <div className="px-4 py-2 text-xs text-gray-400 text-center">No fields found</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Group Button */}
                <div ref={groupPanelRef} className="relative">
                    <button
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                            groupRules.length > 0
                                ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        )}
                        onClick={() => {
                            const wasOpen = showGroupPanel;
                            closeAllPanels();
                            if (!wasOpen) setShowGroupPanel(true);
                        }}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        {groupRules.length === 0
                            ? 'Group'
                            : groupRules.length === 1
                                ? `Grouped by ${columns.find(c => c.key === groupRules[0].key)?.header || groupRules[0].key}`
                                : `Grouped by ${groupRules.length} fields`}
                        {groupRules.length > 0 && (
                            <span
                                className="ml-1 p-0.5 hover:bg-purple-200 rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setGroupRules([]);
                                }}
                            >
                                <X className="w-3 h-3" />
                            </span>
                        )}
                    </button>

                    {/* Group Panel Popup */}
                    {showGroupPanel && (
                        <div
                            className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[320px] z-50 flex flex-col gap-2"
                        >
                            {/* Header with Collapse/Expand */}
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-medium text-gray-500">
                                    Group by
                                </div>
                                {groupRules.length > 0 && groupedData && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allIds = new Set<string>();
                                                const traverse = (nodes: any[]) => {
                                                    nodes.forEach(n => {
                                                        allIds.add(n.id);
                                                        if (n.children) traverse(n.children);
                                                    });
                                                };
                                                traverse(groupedData);
                                                setCollapsedGroups(allIds);
                                            }}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            Collapse all
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCollapsedGroups(new Set())}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            Expand all
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Active Group Rules */}
                            {groupRules.length > 0 ? (
                                <div className="space-y-2">
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleGroupDragEnd}
                                    >
                                        <SortableContext items={groupRules.map(r => r.id)} strategy={verticalListSortingStrategy}>
                                            {groupRules.map(rule => (
                                                <SortableSortRule
                                                    key={rule.id}
                                                    rule={rule}
                                                    columns={orderedColumns}
                                                    onUpdate={(updates) => {
                                                        setGroupRules(prev => prev.map(r => r.id === rule.id ? { ...r, ...updates } : r));
                                                    }}
                                                    onRemove={() => {
                                                        setGroupRules(prev => prev.filter(r => r.id !== rule.id));
                                                    }}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>

                                    {/* Add subgroup button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setGroupSearch(groupSearch === '' ? ' ' : '')}
                                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-1"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add subgroup
                                        </button>

                                        {/* Subgroup field picker (shows when expanded) */}
                                        {groupSearch !== '' && (
                                            <div className="mt-2 border border-gray-200 rounded-lg bg-gray-50 p-2">
                                                <div className="mb-2">
                                                    <SearchInput
                                                        value={groupSearch.trim()}
                                                        onChange={(v) => setGroupSearch(v || ' ')}
                                                        placeholder="Find a field"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="max-h-[150px] overflow-y-auto">
                                                    {columns
                                                        .filter(col => col.header.toLowerCase().includes(groupSearch.trim().toLowerCase()) && !groupRules.some(r => r.key === col.key))
                                                        .map(col => (
                                                            <button
                                                                key={col.key}
                                                                onClick={() => {
                                                                    handleGroupByChange(col.key);
                                                                    setGroupSearch('');
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-white rounded text-left transition-colors text-gray-700 hover:text-blue-600"
                                                            >
                                                                <span className="flex-1">{col.header}</span>
                                                            </button>
                                                        ))
                                                    }
                                                    {columns.filter(col => col.header.toLowerCase().includes(groupSearch.trim().toLowerCase()) && !groupRules.some(r => r.key === col.key)).length === 0 && (
                                                        <div className="px-2 py-1.5 text-xs text-gray-400 text-center">No more fields</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Initial field list when no groups selected */
                                <>
                                    <SearchInput
                                        value={groupSearch}
                                        onChange={setGroupSearch}
                                        placeholder="Find a field"
                                        autoFocus
                                    />
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {columns
                                            .filter(col => col.header.toLowerCase().includes(groupSearch.toLowerCase()))
                                            .map(col => (
                                                <button
                                                    key={col.key}
                                                    onClick={() => {
                                                        handleGroupByChange(col.key);
                                                        setGroupSearch('');
                                                    }}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded text-left transition-colors text-gray-700 hover:text-blue-600"
                                                >
                                                    <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                                                        <GripVertical className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="flex-1">{col.header}</span>
                                                </button>
                                            ))
                                        }
                                        {columns.filter(col => col.header.toLowerCase().includes(groupSearch.toLowerCase())).length === 0 && (
                                            <div className="px-4 py-2 text-xs text-gray-400 text-center">No fields found</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Wrap Button and Panel */}
                <div className="relative" ref={wrapPanelRef}>
                    <button
                        onClick={() => {
                            const wasOpen = showWrapPanel;
                            closeAllPanels();
                            if (!wasOpen) setShowWrapPanel(true);
                        }}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                            wrapRules.length > 0
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        )}
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Expand
                        {wrapRules.length > 0 && (
                            <span className="text-[10px] bg-blue-200 text-blue-700 px-1.5 rounded-full">
                                {wrapRules.length}
                            </span>
                        )}
                    </button>

                    {showWrapPanel && (
                        <>
                            {/* Panel Container */}
                            <div
                                className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-72"
                            >
                                {/* Panel Header */}
                                <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-600">Expand columns</span>
                                    <div className="flex-1" />
                                    {wrapRules.length > 0 && (
                                        <button
                                            onClick={() => setWrapRules([])}
                                            className="text-[10px] text-gray-400 hover:text-gray-600"
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>

                                {/* Search */}
                                <div className="p-2 border-b border-gray-100">
                                    <SearchInput
                                        value={wrapSearch}
                                        onChange={setWrapSearch}
                                        placeholder="Find a field"
                                    />
                                </div>

                                {/* Column List */}
                                <div className="max-h-[250px] overflow-y-auto py-1">
                                    {columns
                                        .filter(col => col.header.toLowerCase().includes(wrapSearch.toLowerCase()))
                                        .map(col => {
                                            const wrapRule = wrapRules.find(r => r.columnKey === col.key);
                                            const currentLines = wrapRule?.lines || null;

                                            const handleLineClick = (lines: '1' | '2' | '3' | 'full') => {
                                                if (currentLines === lines) {
                                                    // Remove wrap rule
                                                    setWrapRules(wrapRules.filter(r => r.columnKey !== col.key));
                                                } else {
                                                    // Add or update wrap rule
                                                    const newRules = wrapRules.filter(r => r.columnKey !== col.key);
                                                    newRules.push({ columnKey: col.key, lines });
                                                    setWrapRules(newRules);
                                                }
                                            };

                                            return (
                                                <div
                                                    key={col.key}
                                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
                                                >
                                                    <GripVertical className="w-3 h-3 text-gray-300" />
                                                    <span className="flex-1 text-xs text-gray-700 truncate">{col.header}</span>

                                                    {/* Line Options */}
                                                    <div className="flex items-center gap-0.5 text-[9px]">
                                                        <button
                                                            onClick={() => handleLineClick('2')}
                                                            className={cn(
                                                                "px-1.5 py-0.5 rounded transition-colors",
                                                                currentLines === '2'
                                                                    ? "bg-blue-100 text-blue-700"
                                                                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                                            )}
                                                        >
                                                            2 lines
                                                        </button>
                                                        <button
                                                            onClick={() => handleLineClick('3')}
                                                            className={cn(
                                                                "px-1.5 py-0.5 rounded transition-colors",
                                                                currentLines === '3'
                                                                    ? "bg-blue-100 text-blue-700"
                                                                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                                            )}
                                                        >
                                                            3 lines
                                                        </button>
                                                        <button
                                                            onClick={() => handleLineClick('full')}
                                                            className={cn(
                                                                "px-1.5 py-0.5 rounded transition-colors",
                                                                currentLines === 'full'
                                                                    ? "bg-blue-100 text-blue-700"
                                                                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                                            )}
                                                        >
                                                            Full
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Collapse/Expand buttons for groups */}
                {groupRules.length > 0 && groupedData && (
                    <div className="flex items-center gap-2 text-xs">
                        <button
                            type="button"
                            onClick={() => {
                                const allIds = new Set<string>();
                                const traverse = (nodes: any[]) => {
                                    nodes.forEach(n => {
                                        allIds.add(n.id);
                                        if (n.children) traverse(n.children);
                                    });
                                };
                                traverse(groupedData);
                                setCollapsedGroups(allIds);
                            }}
                            className="text-gray-500 hover:text-gray-700 underline"
                        >
                            Collapse all
                        </button>
                        <button
                            type="button"
                            onClick={() => setCollapsedGroups(new Set())}
                            className="text-gray-500 hover:text-gray-700 underline"
                        >
                            Expand all
                        </button>
                    </div>
                )}

                {/* Spacer to push Reset/Save buttons to the right */}
                <div className="flex-1" />

                {/* Reset and Save for Everyone buttons */}
                {(onResetPreferences || onSaveForEveryone) && (
                    <div className="flex items-center gap-2">
                        {onResetPreferences && hasUnsavedChanges && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                Reset
                            </button>
                        )}
                        {onSaveForEveryone && (
                            <button
                                type="button"
                                onClick={handleSaveForEveryone}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors"
                            >
                                Save for everyone
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className={cn(
                "overflow-x-auto",
                fullscreen && "flex-1 overflow-y-auto"
            )}>
                <table
                    className="data-grid-table"
                    style={{ width: totalWidth, tableLayout: 'fixed' }}
                >
                    {/* Column Drag Indicator - vertical blue line */}
                    {columnIndicatorRect && createPortal(
                        <div
                            style={{
                                position: 'fixed',
                                left: columnIndicatorRect.left,
                                top: columnIndicatorRect.top,
                                width: '2px',
                                height: columnIndicatorRect.height,
                                background: '#3b82f6',
                                zIndex: 9999,
                                pointerEvents: 'none',
                            }}
                        />,
                        document.body
                    )}

                    {/* Column Header with native HTML5 drag-and-drop */}
                    <thead className="sticky top-0 z-10 bg-white">
                        <tr>
                            {sortable && <th className="data-grid-th w-10"></th>}
                            {orderedColumns.map((col) => {
                                const sortRule = sortRules.find(r => r.key === col.key);
                                const isDraggingThis = draggingColumnKey === col.key;
                                return (
                                    <th
                                        key={col.key}
                                        className={cn(
                                            "data-grid-th relative group/header cursor-grab active:cursor-grabbing",
                                            isDraggingThis && "opacity-50"
                                        )}
                                        style={{ width: columnWidths[col.key] }}
                                        onContextMenu={(e) => handleHeaderContextMenu(e, col)}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', col.key);
                                            e.dataTransfer.effectAllowed = 'move';
                                            setDraggingColumnKey(col.key);
                                        }}
                                        onDragEnd={() => {
                                            setDraggingColumnKey(null);
                                            setDragOverColumnKey(null);
                                            setColumnIndicatorRect(null);
                                        }}
                                        onDragEnter={(e) => {
                                            e.preventDefault();
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            // Update indicator position while dragging over this column
                                            // Check dataTransfer for the dragged key to avoid timing issues with state
                                            const draggedKey = e.dataTransfer.types.includes('text/plain') ? 'pending' : null;
                                            if (draggedKey && draggingColumnKey !== col.key) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                // Show indicator at LEFT edge - where the dragged column's left edge will be
                                                setDragOverColumnKey(col.key);
                                                setColumnIndicatorRect({ top: rect.top, left: rect.left, height: rect.height });
                                            }
                                        }}
                                        onDragLeave={(e) => {
                                            // Only clear if actually leaving the th element (not just moving to a child)
                                            const relatedTarget = e.relatedTarget as Node | null;
                                            if (!e.currentTarget.contains(relatedTarget)) {
                                                if (dragOverColumnKey === col.key) {
                                                    setDragOverColumnKey(null);
                                                    setColumnIndicatorRect(null);
                                                }
                                            }
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const draggedKey = e.dataTransfer.getData('text/plain');
                                            if (draggedKey && draggedKey !== col.key) {
                                                handleColumnReorder(draggedKey, col.key);
                                            }
                                            setDragOverColumnKey(null);
                                            setColumnIndicatorRect(null);
                                        }}
                                    >
                                        <div className="flex items-center gap-1">
                                            <GripVertical className="w-3 h-3 text-gray-300 group-hover/header:text-gray-500 rotate-90" />
                                            {col.header}
                                            {sortRule && (
                                                sortRule.direction === 'asc'
                                                    ? <ArrowUp className="w-3 h-3 text-blue-600" />
                                                    : <ArrowDown className="w-3 h-3 text-blue-600" />
                                            )}
                                            {/* Dropdown arrow - visible on hover, opens context menu on click */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setContextMenu({
                                                        columnKey: col.key,
                                                        columnHeader: col.header,
                                                        columnType: col.type,
                                                        position: { top: e.currentTarget.getBoundingClientRect().bottom + 4, left: e.currentTarget.getBoundingClientRect().left }
                                                    });
                                                }}
                                                className="ml-auto opacity-0 group-hover/header:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 transition-opacity"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        {resizable && (
                                            <div
                                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                                onMouseDown={(e) => handleResizeStart(col.key, e)}
                                            />
                                        )}
                                    </th>
                                );
                            })}
                            {showRowActions && (
                                <th
                                    className="data-grid-th w-20"
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        // Show indicator at the left edge of Actions column
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setColumnIndicatorRect({ top: rect.top, left: rect.left, height: rect.height });
                                    }}
                                    onDragLeave={() => {
                                        setColumnIndicatorRect(null);
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const draggedKey = e.dataTransfer.getData('text/plain');
                                        if (draggedKey) {
                                            // Move dragged column to the end
                                            const currentOrderedKeys = orderedColumns.map(c => c.key);
                                            const draggedIndex = currentOrderedKeys.indexOf(draggedKey);
                                            if (draggedIndex !== -1 && draggedIndex !== currentOrderedKeys.length - 1) {
                                                const newOrder = currentOrderedKeys.filter(k => k !== draggedKey);
                                                newOrder.push(draggedKey); // Add to end
                                                if (onColumnOrderChange) {
                                                    onColumnOrderChange(newOrder);
                                                } else {
                                                    setInternalColumnOrder(newOrder);
                                                }
                                            }
                                        }
                                        setColumnIndicatorRect(null);
                                    }}
                                >
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>

                    {/* Table Body - using native HTML5 drag-and-drop for rows */}
                    <tbody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {sortable && <td className="data-grid-td"><div className="h-4 bg-gray-200 rounded w-6 mx-2"></div></td>}
                                    {columns.map((col) => (
                                        <td key={col.key} className="data-grid-td">
                                            <div className="h-4 bg-gray-200 rounded w-3/4 mx-2"></div>
                                        </td>
                                    ))}
                                    {showRowActions && <td className="data-grid-td"><div className="h-4 bg-gray-200 rounded w-12 mx-2"></div></td>}
                                </tr>
                            ))
                        ) : data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (sortable ? 1 : 0) + (showRowActions ? 1 : 0)}
                                    className="data-grid-td px-4 py-8 text-center text-gray-500 text-xs"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : groupedData ? (
                            // Recursive Grouped Rendering
                            (() => {
                                const colSpan = columns.length + (sortable ? 1 : 0) + (showRowActions ? 1 : 0);

                                const renderGroupNodes = (nodes: any[]) => {
                                    return nodes.map((node: any) => {
                                        const isCollapsed = collapsedGroups.has(node.id);

                                        return (
                                            <React.Fragment key={node.id}>
                                                <GroupHeader
                                                    groupValue={node.value}
                                                    count={node.count}
                                                    isCollapsed={isCollapsed}
                                                    onToggle={() => toggleGroupCollapse(node.id)}
                                                    colSpan={colSpan}
                                                    colorClass={node.colorClass}
                                                    level={node.level}
                                                />
                                                {!isCollapsed && (
                                                    node.children
                                                        ? renderGroupNodes(node.children)
                                                        : node.rows?.map((row: any) => (
                                                            <MemoizedSortableRow
                                                                key={getRowId(row)}
                                                                row={row}
                                                                rowId={getRowId(row)}
                                                                columns={orderedColumns}
                                                                columnWidths={columnWidths}
                                                                sortable={sortable}
                                                                showRowActions={showRowActions}
                                                                editingCell={editingCell}
                                                                editingValue={editingValue}
                                                                wrapRules={wrapRules}
                                                                dropdownPosition={dropdownPosition}
                                                                onEditStart={handleEditStart}
                                                                onEditChange={setEditingValue}
                                                                onEditSave={handleEditSave}
                                                                onEditCancel={handleEditCancel}
                                                                onDelete={onDelete}
                                                                onCopy={handleCopy}
                                                                onDuplicate={onDuplicate}
                                                                copiedId={copiedId}
                                                                {...createRowDragHandlers(getRowId(row))}
                                                                isDragging={draggingRowId === getRowId(row)}
                                                                isDragOver={dragOverRowId === getRowId(row)}
                                                            />
                                                        ))
                                                )}
                                            </React.Fragment>
                                        );
                                    });
                                };
                                return renderGroupNodes(groupedData);
                            })()
                        ) : (
                            // Ungrouped rendering with pagination
                            paginatedData.map((row) => (
                                <MemoizedSortableRow
                                    key={getRowId(row)}
                                    row={row}
                                    rowId={getRowId(row)}
                                    columns={orderedColumns}
                                    columnWidths={columnWidths}
                                    sortable={sortable}
                                    showRowActions={showRowActions}
                                    editingCell={editingCell}
                                    editingValue={editingValue}
                                    wrapRules={wrapRules}
                                    dropdownPosition={dropdownPosition}
                                    onEditStart={handleEditStart}
                                    onEditChange={setEditingValue}
                                    onEditSave={handleEditSave}
                                    onEditCancel={handleEditCancel}
                                    onDelete={onDelete}
                                    onCopy={handleCopy}
                                    onDuplicate={onDuplicate}
                                    copiedId={copiedId}
                                    {...createRowDragHandlers(getRowId(row))}
                                    isDragging={draggingRowId === getRowId(row)}
                                    isDragOver={dragOverRowId === getRowId(row)}
                                />
                            ))
                        )}

                        {/* + New Row (inline creation) */}
                        {onCreateRow && (
                            <tr
                                onClick={handleCreateRow}
                                className="group cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100"
                            >
                                {sortable && <td className="w-10" />}
                                <td
                                    colSpan={columns.length}
                                    className="px-4 py-2 text-xs text-gray-400 group-hover:text-blue-600"
                                >
                                    <div className="flex items-center gap-2">
                                        {isCreating ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                                <span>Creating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4" />
                                                <span>New</span>
                                            </>
                                        )}
                                    </div>
                                </td>
                                {showRowActions && <td className="w-20" />}
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Column Context Menu */}
            {
                contextMenu && (
                    <ColumnContextMenu
                        columnKey={contextMenu.columnKey}
                        columnHeader={contextMenu.columnHeader}
                        columnType={contextMenu.columnType}
                        position={contextMenu.position}
                        onGroupBy={(colKey) => {
                            // onGroupBy usage from Context Menu should ADD the group
                            setGroupRules(prev => {
                                if (prev.find(r => r.key === colKey)) return prev.filter(r => r.key !== colKey);
                                return [...prev, { id: `${colKey}-${Date.now()}`, key: colKey, direction: 'asc' }];
                            });
                        }}
                        onSort={handleSort}
                        onFilter={(colKey) => {
                            // Add a filter rule for this column and open filter panel
                            const col = columns.find(c => c.key === colKey);
                            const hasOptions = col?.filterOptions || Array.isArray(col?.options);
                            setFilterRules(prev => [
                                ...prev,
                                {
                                    id: Math.random().toString(36).substr(2, 9),
                                    field: colKey,
                                    operator: hasOptions ? 'is' : 'contains',
                                    value: '',
                                    conjunction: prev.length > 0 ? 'and' : 'and'
                                }
                            ]);
                            setShowFilterPanel(true);
                        }}
                        onClose={() => setContextMenu(null)}
                        isGroupedBy={groupRules.some(r => r.key === contextMenu.columnKey)}
                        sortRules={sortRules}
                    />
                )
            }

            {/* Pagination Bottom Bar */}
            {
                groupRules.length === 0 && totalRows > 0 && (
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
                        {/* Left: Total count */}
                        <div className="flex items-center">
                            <span className="text-gray-500">
                                {totalRows} {totalRows === 1 ? 'row' : 'rows'}
                            </span>
                        </div>

                        {/* Right: Page navigation with rows per page dropdown */}
                        <div className="flex items-center gap-3">
                            <span className="text-gray-500">
                                {Math.min((currentPage - 1) * rowsPerPage + 1, totalRows)}-{Math.min(currentPage * rowsPerPage, totalRows)} of {totalRows}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className={cn(
                                        "p-1 rounded transition-colors",
                                        currentPage === 1
                                            ? "text-gray-300 cursor-not-allowed"
                                            : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                                    )}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className={cn(
                                        "p-1 rounded transition-colors",
                                        currentPage === totalPages
                                            ? "text-gray-300 cursor-not-allowed"
                                            : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                                    )}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="border-l border-gray-200 pl-3">
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="text-xs text-gray-600 bg-transparent border border-gray-200 rounded px-2 py-1 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    {rowsPerPageOptions.map(option => (
                                        <option key={option} value={option}>
                                            {option} / page
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default DataTable;
