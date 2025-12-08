import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical, Trash2, Copy, Check } from 'lucide-react';
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

// ============ Types ============

export interface ColumnDef<T> {
    key: string;
    header: string;
    width?: number;
    minWidth?: number;
    editable?: boolean;
    type?: 'text' | 'textarea' | 'select' | 'badge' | 'date' | 'custom';
    options?: { label: string; value: string }[];
    colorMap?: Record<string, string>;
    render?: (value: unknown, row: T, isEditing: boolean) => React.ReactNode;
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
    showRowActions?: boolean;

    // Drag & drop
    sortable?: boolean;
    onReorder?: (ids: string[]) => void;

    // Resize
    resizable?: boolean;

    // Expand text
    expandText?: boolean;
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
    expandText: boolean;
    onEditStart: (row: T, field: string) => void;
    onEditChange: (value: string) => void;
    onEditSave: () => void;
    onEditCancel: () => void;
    onDelete?: (id: string) => void;
    onCopy?: (row: T) => void;
    copiedId: string | null;
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
    expandText,
    onEditStart,
    onEditChange,
    onEditSave,
    onEditCancel,
    onDelete,
    onCopy,
    copiedId,
}: SortableRowProps<T>) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: rowId, disabled: !sortable });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

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
        <tr ref={setNodeRef} style={style} className="group hover:bg-gray-50">
            {/* Drag Handle */}
            {sortable && (
                <td className="data-grid-td w-10 px-2">
                    <button
                        {...attributes}
                        {...listeners}
                        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>
                </td>
            )}

            {/* Data Columns */}
            {columns.map((col) => {
                const value = col.getValue ? col.getValue(row) : (row as Record<string, unknown>)[col.key];
                const isEditing = editingCell?.id === rowId && editingCell?.field === col.key;
                const width = columnWidths[col.key] || col.width || 100;

                return (
                    <td
                        key={col.key}
                        className="data-grid-td px-2"
                        style={{ width, maxWidth: width }}
                    >
                        {/* Check for editing FIRST - takes priority over custom render */}
                        {isEditing && col.editable ? (
                            col.type === 'select' || col.type === 'badge' ? (
                                <select
                                    ref={inputRef as React.RefObject<HTMLSelectElement>}
                                    value={editingValue}
                                    onChange={(e) => {
                                        onEditChange(e.target.value);
                                        setTimeout(onEditSave, 0);
                                    }}
                                    onBlur={onEditSave}
                                    className="w-full p-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                                >
                                    {col.options?.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            ) : col.type === 'textarea' || col.type === 'text' ? (
                                <textarea
                                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                                    value={editingValue}
                                    onChange={(e) => {
                                        onEditChange(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    onBlur={onEditSave}
                                    onKeyDown={handleKeyDown}
                                    className="w-full p-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none overflow-hidden"
                                    rows={1}
                                />
                            ) : (
                                <input
                                    ref={inputRef as React.RefObject<HTMLInputElement>}
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => onEditChange(e.target.value)}
                                    onBlur={onEditSave}
                                    onKeyDown={handleKeyDown}
                                    className="w-full p-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                            )
                        ) : col.render ? (
                            // Custom render for display mode only
                            col.render(value, row, isEditing)
                        ) : (
                            // Default display mode
                            col.type === 'badge' || col.type === 'select' ? (
                                <span
                                    className={cn(
                                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:ring-1 hover:ring-blue-300",
                                        col.colorMap?.[String(value)] || "bg-gray-50 text-gray-700 border-gray-200"
                                    )}
                                    onClick={() => col.editable && onEditStart(row, col.key)}
                                >
                                    {col.options?.find(o => o.value === value)?.label || String(value || '-')}
                                </span>
                            ) : col.type === 'date' ? (
                                <span className="text-[10px] text-gray-500">
                                    {value ? new Date(String(value)).toLocaleDateString() : '-'}
                                </span>
                            ) : (
                                <p
                                    className={cn(
                                        "text-xs text-gray-900 cursor-pointer hover:text-blue-600 transition-colors",
                                        !expandText && "line-clamp-1",
                                        expandText && "whitespace-pre-wrap"
                                    )}
                                    onClick={() => col.editable && onEditStart(row, col.key)}
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
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onCopy && (
                            <button
                                onClick={() => onCopy(row)}
                                className={cn(
                                    "p-1 rounded transition-colors",
                                    copiedId === rowId
                                        ? "text-green-600 bg-green-50"
                                        : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                )}
                                title="Copy"
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
    );
}

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
    showRowActions = true,
    sortable = false,
    onReorder,
    resizable = true,
    expandText = false,
}: DataTableProps<T>) {
    // Column widths state
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const widths: Record<string, number> = {};
        columns.forEach((col) => {
            widths[col.key] = col.width || 120;
        });
        return widths;
    });

    // Resize tracking
    const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

    // Editing state
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');

    // Copy state
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

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
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
    }, [handleResizeMove]);

    // Edit handlers
    const handleEditStart = useCallback((row: T, field: string) => {
        const col = columns.find(c => c.key === field);
        if (!col?.editable) return;

        const value = col.getValue ? col.getValue(row) : (row as Record<string, unknown>)[field];
        setEditingCell({ id: getRowId(row), field });
        setEditingValue(String(value || ''));
    }, [columns, getRowId]);

    const handleEditSave = useCallback(async () => {
        if (!editingCell || !onUpdate) {
            setEditingCell(null);
            return;
        }

        try {
            await onUpdate(editingCell.id, editingCell.field, editingValue);
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

    // Drag end handler
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !onReorder) return;

        const oldIndex = data.findIndex(row => getRowId(row) === active.id);
        const newIndex = data.findIndex(row => getRowId(row) === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = arrayMove(data.map(getRowId), oldIndex, newIndex);
            onReorder(newOrder);
        }
    }, [data, getRowId, onReorder]);

    // Calculate total width
    const totalWidth = Object.values(columnWidths).reduce((a, b) => a + b, 0)
        + (sortable ? 40 : 0)
        + (showRowActions ? 80 : 0);

    const rowIds = data.map(getRowId);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table
                    className="data-grid-table"
                    style={{ width: totalWidth, tableLayout: 'fixed' }}
                >
                    <thead>
                        <tr>
                            {sortable && <th className="data-grid-th w-10"></th>}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className="data-grid-th relative"
                                    style={{ width: columnWidths[col.key] }}
                                >
                                    {col.header}
                                    {resizable && (
                                        <div
                                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                            onMouseDown={(e) => handleResizeStart(col.key, e)}
                                        />
                                    )}
                                </th>
                            ))}
                            {showRowActions && <th className="data-grid-th w-20">Actions</th>}
                        </tr>
                    </thead>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
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
                                ) : (
                                    data.map((row) => (
                                        <SortableRow
                                            key={getRowId(row)}
                                            row={row}
                                            rowId={getRowId(row)}
                                            columns={columns}
                                            columnWidths={columnWidths}
                                            sortable={sortable}
                                            showRowActions={showRowActions}
                                            editingCell={editingCell}
                                            editingValue={editingValue}
                                            expandText={expandText}
                                            onEditStart={handleEditStart}
                                            onEditChange={setEditingValue}
                                            onEditSave={handleEditSave}
                                            onEditCancel={handleEditCancel}
                                            onDelete={onDelete}
                                            onCopy={handleCopy}
                                            copiedId={copiedId}
                                        />
                                    ))
                                )}
                            </tbody>
                        </SortableContext>
                    </DndContext>
                </table>
            </div>
        </div>
    );
}

export default DataTable;
