import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Trash2, Copy, Check, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Plus, LayoutGrid, List, FileText, ArrowUp, ArrowDown, X, ArrowUpDown, Search, Filter, Maximize2, Pencil, Settings, Columns, LayoutList } from 'lucide-react';
import { SingleSelect, SearchInput } from '../fields';
import { BlockEditor, BlockEditorDisplay } from '../BlockEditor';
import { NotionEditor } from '../NotionEditor';
import { NotionEditorCell, NotionEditorCellDisplay } from '../NotionEditorCell';
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
import { cn } from '../../utils/cn';
import { CreativeCard } from '../CardView';
import {
    getCreativeUrl,
    getUserViewPreferences,
    saveUserViewPreferences,
    getSharedViewPreferences,
    saveSharedViewPreferences,
    deleteUserViewPreferences,
    type ViewPreferencesConfig,
} from '../../lib/supabase-service';
import { useAuth } from '../../contexts/AuthContext';
import { AdCopyPickerModal } from '../AdCopyPickerModal';

// Import types from extracted modules
import type { ColumnDef, DataTableProps, PeopleOption, SortRule, ThumbnailSize, ThumbnailSizeRule } from './types';
import { THUMBNAIL_SIZES } from './types';
// Cell components - using local versions for now until full refactoring is complete
import { UrlCell as UrlColumn, PriorityCell as PriorityColumn, RatingCell as RatingColumn, PeopleCell as PeopleColumn } from './cells';
// SortableSortRule from extracted components
import { SortableSortRule } from './components';
// Note: Other components (DropdownMenu, PeopleDropdownMenu, ColumnContextMenu, QuickFilter, FieldEditor, GroupHeader)
// are still defined locally in this file. They will be removed in a future refactoring pass
// once all references are updated to use the extracted versions.

// Re-export types for backwards compatibility
export type { ColumnDef, DataTableProps, PeopleOption } from './types';

// Types and helper components imported from extracted modules above

// ============ Internal Types (keeping local copies for now, will be removed in future refactoring) ============
// Note: These are duplicated from ./types.ts - the imports above are the canonical source

interface LocalColumnDef<T> {
    key: string;
    header: string;
    width?: number;
    minWidth?: number;
    editable?: boolean;
    type?: 'text' | 'longtext' | 'richtext' | 'blockeditor' | 'notioneditor' | 'select' | 'date' | 'url' | 'priority' | 'id' | 'people' | 'thumbnail' | 'filesize' | 'adcopy' | 'media' | 'custom';
    options?: { label: string; value: string | number }[] | ((row: T) => { label: string; value: string | number }[]);
    filterOptions?: { label: string; value: string | number }[]; // Static options for filter dropdown (use when options is a function)
    optionsEditable?: boolean; // For select type - whether options can be added/removed in field editor (default: true)
    colorMap?: Record<string, string>;
    render?: (value: unknown, row: T, isEditing: boolean, expandText?: boolean) => React.ReactNode;
    getValue?: (row: T) => unknown;
    fallbackKey?: string; // For legacy data - show this field's value if current value not found in options
    maxPriority?: number; // For priority type - max value (default: 5)
    urlMaxLength?: number; // For url type - max characters to show (default: 25)
    users?: PeopleOption[]; // For people type - list of users to select from
    adCopyType?: 'headline' | 'primary_text' | 'description'; // For adcopy type - which type of ad copy
    // Media column type options
    thumbnailSize?: ThumbnailSize; // For media type - size of thumbnail (default: 'small')
    mediaTypeKey?: string; // For media type - key to get media type ('image' or 'video') from row
    // Column dependency - when this column's value is set, auto-set the parent column value
    // Used for subproject -> project relationships where selecting a subproject should auto-select its project
    dependsOn?: {
        parentKey: string; // The column key this depends on (e.g., 'project_id')
        getParentValue: (value: string | number) => string | number | null; // Function to resolve parent value from this column's value
    };
}

// ============ Masonry Grid Component ============
// Smart horizontal-flow masonry that places items left-to-right while allowing dynamic heights

interface MasonryGridProps {
    children: ReactNode[];
    minWidth: number;
    gap?: number;
}

function MasonryGrid({ children, minWidth, gap = 16 }: MasonryGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [positions, setPositions] = useState<{ left: number; top: number; width: number }[]>([]);
    const [containerHeight, setContainerHeight] = useState<number | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const measurementVersionRef = useRef(0);

    // Calculate column width directly from minWidth prop (no state needed)
    const calculateColumnWidth = useCallback(() => {
        if (!containerRef.current) return minWidth;
        const containerWidth = containerRef.current.offsetWidth;
        if (containerWidth === 0) return minWidth;
        const numColumns = Math.max(1, Math.floor((containerWidth + gap) / (minWidth + gap)));
        return (containerWidth - (numColumns - 1) * gap) / numColumns;
    }, [minWidth, gap]);

    // Memoize column width to avoid recalculating on every render
    const [columnWidth, setColumnWidth] = useState<number>(minWidth);

    // Update column width when minWidth changes
    useEffect(() => {
        setColumnWidth(calculateColumnWidth());
    }, [calculateColumnWidth]);

    // Main measurement and positioning effect
    useLayoutEffect(() => {
        // Cancel any pending RAF from previous effect
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        if (!containerRef.current || children.length === 0) {
            setContainerHeight(null);
            setPositions([]);
            return;
        }

        // Increment version to invalidate any in-flight callbacks
        const currentVersion = ++measurementVersionRef.current;

        const containerWidth = containerRef.current.offsetWidth;
        if (containerWidth === 0) return;

        const numColumns = Math.max(1, Math.floor((containerWidth + gap) / (minWidth + gap)));
        const calculatedColumnWidth = (containerWidth - (numColumns - 1) * gap) / numColumns;

        // Update column width state for initial render
        setColumnWidth(calculatedColumnWidth);

        // Clear positions to trigger re-render at new width
        setPositions([]);
        setContainerHeight(null);

        // Measure and position after DOM updates
        const measureAndPosition = () => {
            // Check if this callback is still valid
            if (measurementVersionRef.current !== currentVersion) return;
            if (!containerRef.current) return;

            const columnHeights = new Array(numColumns).fill(0);
            const newPositions: { left: number; top: number; width: number }[] = [];

            // Measure each card and assign to shortest column
            cardRefs.current.forEach((cardEl, index) => {
                if (!cardEl) return;

                // Find the shortest column (left-to-right preference for ties)
                const minColHeight = Math.min(...columnHeights);
                const shortestCol = columnHeights.indexOf(minColHeight);

                const left = shortestCol * (calculatedColumnWidth + gap);
                const top = columnHeights[shortestCol];

                newPositions[index] = { left, top, width: calculatedColumnWidth };

                // Update column height (using getBoundingClientRect for precise measurement)
                const rect = cardEl.getBoundingClientRect();
                columnHeights[shortestCol] = top + rect.height + gap;
            });

            // Only update if this version is still current
            if (measurementVersionRef.current === currentVersion) {
                setPositions(newPositions);
                setContainerHeight(Math.max(...columnHeights, 0) - gap);
            }
        };

        // Use double RAF to ensure DOM has updated with new column width
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = requestAnimationFrame(() => {
                measureAndPosition();
            });
        });

        // Cleanup
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [children, minWidth, gap]);

    const hasPositions = positions.length > 0 && containerHeight !== null;

    return (
        <div
            ref={containerRef}
            className="relative"
            style={{ minHeight: hasPositions ? containerHeight : 'auto' }}
        >
            {React.Children.map(children, (child, index) => (
                <div
                    key={index}
                    ref={el => { cardRefs.current[index] = el; }}
                    style={hasPositions && positions[index] ? {
                        position: 'absolute',
                        left: positions[index].left,
                        top: positions[index].top,
                        width: positions[index].width,
                    } : {
                        // Initial/measurement render: use calculated column width
                        display: 'inline-block',
                        verticalAlign: 'top',
                        width: columnWidth,
                    }}
                >
                    {child}
                </div>
            ))}
        </div>
    );
}

// ============ Sortable Footer Item Component ============
// Compact draggable item for card settings footer order

interface SortableFooterItemProps {
    id: string;
    label: string;
    onRemove: () => void;
}

function SortableFooterItem({ id, label, onRemove }: SortableFooterItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-1 bg-white rounded px-1.5 py-1 border border-gray-200",
                isDragging && "opacity-50 shadow-lg z-50"
            )}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            >
                <GripVertical className="w-3 h-3" />
            </div>
            <span className="text-[11px] text-gray-700 flex-1">{label}</span>
            <button
                onClick={onRemove}
                className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

interface LocalDataTableProps<T> {
    columns: ColumnDef<T>[];
    data: T[];
    isLoading?: boolean;
    emptyMessage?: string;

    // Toolbar header (2-row toolbar)
    title?: string;
    onNewClick?: () => void;
    newButtonLabel?: string;
    headerActions?: React.ReactNode;

    // Row identification
    getRowId: (row: T) => string;

    // Editing
    onUpdate?: (id: string, field: string, value: unknown) => Promise<void> | void;

    // Row actions
    onDelete?: (id: string) => void;
    onCopy?: (row: T) => void;
    onDuplicate?: (row: T) => void;

    // Inline row creation (no popup)
    // defaults: filter values to pre-populate (extracted from active "is" filters)
    onCreateRow?: (defaults?: Record<string, unknown>) => Promise<T> | T;

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

    // Layout mode:
    // - 'fullPage': Fills available height, internal vertical scroll, footer visible (for main pages)
    // - 'inline': Normal flow, optional maxHeight (for embedded tables in accordions)
    // - 'contained': Fills parent container (modal, panel, sidebar), parent must have defined height
    layout?: 'fullPage' | 'inline' | 'contained';

    // Max height for inline layout (e.g., '400px', '50vh')
    maxHeight?: string;

    // Quick filters - array of column keys to show as quick filter dropdowns at far left of toolbar
    quickFilters?: string[];

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
        thumbnail_size_config?: Array<{ columnKey: string; size: 'small' | 'medium' | 'large' | 'xl' }>;
        row_order?: string[];
        column_widths?: Record<string, number>;
        column_order?: string[];
    };
    sharedPreferences?: {
        sort_config?: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        filter_config?: Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>;
        group_config?: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        wrap_config?: Array<{ columnKey: string; lines: '1' | '3' | 'full' }>;
        thumbnail_size_config?: Array<{ columnKey: string; size: 'small' | 'medium' | 'large' | 'xl' }>;
        row_order?: string[];
        column_widths?: Record<string, number>;
        column_order?: string[];
    };
    onPreferencesChange?: (preferences: {
        sort_config: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        filter_config: Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>;
        group_config: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        wrap_config: Array<{ columnKey: string; lines: '1' | '3' | 'full' }>;
        thumbnail_size_config: Array<{ columnKey: string; size: 'small' | 'medium' | 'large' | 'xl' }>;
        row_order?: string[];
        column_widths?: Record<string, number>;
        column_order?: string[];
    }) => void;
    onSaveForEveryone?: (preferences: {
        sort_config: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        filter_config: Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>;
        group_config: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
        wrap_config: Array<{ columnKey: string; lines: '1' | '3' | 'full' }>;
        thumbnail_size_config: Array<{ columnKey: string; size: 'small' | 'medium' | 'large' | 'xl' }>;
        row_order?: string[];
        column_widths?: Record<string, number>;
        column_order?: string[];
    }) => void;
    onResetPreferences?: () => void;

    // Column configuration editing (for select options, colors, etc.)
    onColumnConfigChange?: (columnKey: string, updates: { options?: { label: string; value: string | number }[]; colorMap?: Record<string, string> }) => void;

    // Multi-select mode with checkboxes
    selectable?: boolean;
    selectedIds?: Set<string>;
    onSelectionChange?: (selectedIds: Set<string>) => void;

    // Single-select mode (click row to select, only one at a time)
    singleSelect?: boolean;
    selectedRowId?: string | null;
    onRowSelect?: (id: string | null) => void;

    // View mode (table, gallery, or card view)
    viewMode?: 'table' | 'gallery' | 'card';
    onViewModeChange?: (mode: 'table' | 'gallery' | 'card') => void;
    cardColumns?: number;

    // Gallery configuration - maps data columns to gallery card fields
    // If provided, DataTable will use built-in CreativeCard for gallery view
    galleryConfig?: {
        /** Column key for media URL (image/video source) */
        mediaUrlKey: string;
        /** Column key for thumbnail URL (optional, falls back to mediaUrl) */
        thumbnailKey?: string;
        /** Column key for media type ('image' or 'video') */
        mediaTypeKey?: string;
        /** Column key for item name/title */
        nameKey?: string;
        /** Column key for project_id */
        projectKey?: string;
        /** Column key for subproject_id */
        subprojectKey?: string;
        /** Column key for user_id (created by) */
        userKey?: string;
        /** Column key for created_at/date */
        dateKey?: string;
        /** Column key for file size */
        fileSizeKey?: string;
        /** Column key for row number/ID */
        rowNumberKey?: string;
        /** Show file info (name, size, dimensions) - default true */
        showFileInfo?: boolean;
    };
    /** Lookup maps for resolving IDs to names in gallery view */
    galleryLookups?: {
        projects?: Map<string, string>;
        subprojects?: Map<string, string>;
        users?: Map<string, string>;
        projectColors?: Record<string, string>;
        subprojectColors?: Record<string, string>;
    };
    /** Ad copies for adcopy column type */
    adCopies?: Array<{
        id: string;
        text: string | null;
        name?: string | null;
        type: string;
        row_number?: number;
    }>;
    /** Custom gallery card renderer - overrides default CreativeCard rendering */
    renderGalleryCard?: (props: {
        item: T;
        isSelected: boolean;
        onToggle: () => void;
        selectable: boolean;
    }) => React.ReactNode;
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
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    // Focus search input on mount and calculate position
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Adjust position if dropdown would go off-screen
    useEffect(() => {
        if (dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const dropdownHeight = rect.height;
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - position.top - 10;

            let newTop = position.top;
            if (spaceBelow < dropdownHeight && position.top > dropdownHeight) {
                // Not enough space below, position above
                newTop = position.top - dropdownHeight - 8;
            }

            // Only update if position actually changed
            setAdjustedPosition(prev => {
                if (prev.top === newTop && prev.left === position.left) {
                    return prev; // No change, don't trigger re-render
                }
                return { ...position, top: newTop };
            });
        }
    }, [position.top, position.left]); // Use primitive deps instead of object

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    // Find current selected option
    const selectedOption = options.find(o => String(o.value) === String(value));

    return (
        <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl min-w-[180px] overflow-hidden"
            style={{ top: adjustedPosition.top, left: adjustedPosition.left, maxHeight: 'calc(100vh - 20px)' }}
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

// ============ People Dropdown Menu (Portal-based) ============

interface PeopleDropdownMenuProps {
    users: PeopleOption[];
    value: string;
    onSelect: (value: string) => void;
    onClear?: () => void;
    position: { top: number; left: number };
}

function getAvatarColor(str: string): string {
    const colors = [
        'bg-pink-500',
        'bg-purple-500',
        'bg-indigo-500',
        'bg-blue-500',
        'bg-cyan-500',
        'bg-teal-500',
        'bg-green-500',
        'bg-amber-500',
        'bg-orange-500',
        'bg-red-500',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function getInitials(user: PeopleOption): string {
    if (user.first_name) {
        const first = user.first_name.charAt(0).toUpperCase();
        const last = user.last_name?.charAt(0).toUpperCase() || '';
        return first + last;
    }
    if (user.name) {
        const parts = user.name.split(' ');
        return parts.map(p => p.charAt(0).toUpperCase()).slice(0, 2).join('');
    }
    return user.email.charAt(0).toUpperCase();
}

function PeopleDropdownMenu({ users, value, onSelect, onClear, position }: PeopleDropdownMenuProps) {
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const dropdownHeight = rect.height;
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - position.top - 10;

            let newTop = position.top;
            if (spaceBelow < dropdownHeight && position.top > dropdownHeight) {
                newTop = position.top - dropdownHeight - 8;
            }

            // Only update if position actually changed
            setAdjustedPosition(prev => {
                if (prev.top === newTop && prev.left === position.left) {
                    return prev;
                }
                return { ...position, top: newTop };
            });
        }
    }, [position.top, position.left]);

    const filteredUsers = users.filter(user => {
        const searchLower = search.toLowerCase();
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
        return fullName.includes(searchLower) || user.email.toLowerCase().includes(searchLower);
    });

    const selectedUser = users.find(u => u.id === value);

    return (
        <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl min-w-[200px] overflow-hidden"
            style={{ top: adjustedPosition.top, left: adjustedPosition.left, maxHeight: 'calc(100vh - 20px)' }}
        >
            {/* Selected user with X to clear */}
            {selectedUser && value && (
                <div className="p-2 border-b border-gray-100">
                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        <div
                            className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-medium flex-shrink-0",
                                !selectedUser.avatar_url && getAvatarColor(selectedUser.id)
                            )}
                        >
                            {selectedUser.avatar_url ? (
                                <img src={selectedUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                getInitials(selectedUser)
                            )}
                        </div>
                        {selectedUser.first_name || selectedUser.name || selectedUser.email}
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
                        placeholder="Find a person"
                        className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                </div>
            </div>

            {/* Hint text */}
            <div className="px-3 py-1.5 text-[10px] text-gray-400">
                Select a person
            </div>

            {/* Users List */}
            <div className="max-h-[200px] overflow-y-auto py-1">
                {filteredUsers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400 italic whitespace-nowrap">
                        No people found
                    </div>
                ) : (
                    filteredUsers.map((user) => (
                        <div
                            key={user.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(user.id);
                            }}
                            className={cn(
                                "px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 transition-colors whitespace-nowrap flex items-center gap-2",
                                user.id === value ? "bg-blue-50 text-blue-700" : "text-gray-700"
                            )}
                        >
                            {/* Avatar */}
                            <div
                                className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0",
                                    !user.avatar_url && getAvatarColor(user.id)
                                )}
                            >
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    getInitials(user)
                                )}
                            </div>
                            {/* Name */}
                            <span className="flex-1">
                                {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user.name || user.email)}
                            </span>
                            {user.id === value && (
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
    columnEditable?: boolean;
    position: { top: number; left: number };
    onGroupBy: (columnKey: string) => void;
    onSort: (columnKey: string, direction: 'asc' | 'desc') => void;
    onFilter: (columnKey: string) => void;
    onEditField?: () => void;
    onClose: () => void;
    isGroupedBy: boolean;
    sortRules: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
    // Media column thumbnail size
    currentThumbnailSize?: ThumbnailSize;
    onThumbnailSizeChange?: (size: ThumbnailSize) => void;
}

function ColumnContextMenu({
    columnKey,
    columnHeader,
    columnType,
    columnEditable,
    position,
    onGroupBy,
    onSort,
    onFilter,
    onEditField,
    onClose,
    isGroupedBy,
    sortRules,
    currentThumbnailSize,
    onThumbnailSizeChange
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
                        columnType === 'longtext' ? (columnEditable ? 'Long Text' : 'Long Text (Read-Only)') :
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

            {/* Thumbnail Size (only for media type) */}
            {columnType === 'media' && onThumbnailSizeChange && (
                <>
                    <div className="my-1 border-t border-gray-100" />
                    <div className="px-3 py-1.5">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Preview Size</span>
                    </div>
                    {(['small', 'medium', 'large', 'xl'] as ThumbnailSize[]).map((size) => (
                        <button
                            key={size}
                            onClick={() => {
                                onThumbnailSizeChange(size);
                                onClose();
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left",
                                currentThumbnailSize === size ? "bg-blue-50 text-blue-700" : "text-gray-700"
                            )}
                        >
                            <div
                                className={cn(
                                    "rounded bg-gray-200 flex-shrink-0",
                                    size === 'small' && "w-3 h-3",
                                    size === 'medium' && "w-4 h-4",
                                    size === 'large' && "w-5 h-5",
                                    size === 'xl' && "w-6 h-6"
                                )}
                            />
                            {size === 'small' ? 'Small (40px)' :
                             size === 'medium' ? 'Medium (64px)' :
                             size === 'large' ? 'Large (96px)' : 'Extra Large (128px)'}
                            {currentThumbnailSize === size && (
                                <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" />
                            )}
                        </button>
                    ))}
                </>
            )}
        </div>,
        document.body
    );
}

// ============ Field Editor Modal ============

const PRESET_COLORS = [
    { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', name: 'Red' },
    { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', name: 'Orange' },
    { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', name: 'Amber' },
    { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', name: 'Yellow' },
    { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200', name: 'Lime' },
    { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', name: 'Green' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', name: 'Emerald' },
    { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', name: 'Teal' },
    { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', name: 'Cyan' },
    { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200', name: 'Sky' },
    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', name: 'Blue' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', name: 'Indigo' },
    { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', name: 'Violet' },
    { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', name: 'Purple' },
    { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200', name: 'Fuchsia' },
    { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', name: 'Pink' },
    { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', name: 'Rose' },
    { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', name: 'Gray' },
];

interface FieldEditorProps {
    columnKey: string;
    columnHeader: string;
    options: { label: string; value: string | number }[];
    colorMap: Record<string, string>;
    colorOnly?: boolean; // When true, only allow color changes (no add/remove/rename options)
    onSave: (updates: { options: { label: string; value: string | number }[]; colorMap: Record<string, string> }) => void;
    onClose: () => void;
}

function FieldEditor({
    columnHeader,
    options: initialOptions,
    colorMap: initialColorMap,
    colorOnly = false,
    onSave,
    onClose
}: FieldEditorProps) {
    const [options, setOptions] = useState<{ label: string; value: string | number }[]>([...initialOptions]);
    const [colorMap, setColorMap] = useState<Record<string, string>>({ ...initialColorMap });
    const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close color picker on click outside
    useEffect(() => {
        if (!colorPickerOpen) return;
        function handleClickOutside(event: MouseEvent) {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setColorPickerOpen(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [colorPickerOpen]);

    const handleAddOption = () => {
        const newValue = `option_${Date.now()}`;
        setOptions([...options, { label: 'New option', value: newValue }]);
    };

    const handleRemoveOption = (index: number) => {
        const opt = options[index];
        setOptions(options.filter((_, i) => i !== index));
        // Also remove from colorMap
        const newColorMap = { ...colorMap };
        delete newColorMap[String(opt.value)];
        setColorMap(newColorMap);
    };

    const handleOptionLabelChange = (index: number, newLabel: string) => {
        const newOptions = [...options];
        newOptions[index] = { ...newOptions[index], label: newLabel };
        setOptions(newOptions);
    };

    const handleColorChange = (value: string, colorClass: string) => {
        setColorMap({ ...colorMap, [value]: colorClass });
        setColorPickerOpen(null);
    };

    const handleSave = () => {
        onSave({ options, colorMap });
        onClose();
    };

    const getColorClasses = (value: string) => {
        return colorMap[String(value)] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/30 z-[9998] flex items-center justify-center">
            <div
                ref={modalRef}
                className="bg-white rounded-xl shadow-2xl w-[400px] max-h-[80vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Edit field</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Field Name */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Field name</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                            {columnHeader}
                        </div>
                    </div>

                    {/* Field Type */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Field type</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                            Single Select
                        </div>
                    </div>

                    {/* Options */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Options</label>
                        {colorOnly && (
                            <p className="text-[11px] text-gray-400 mb-2">Options are managed externally. You can only change colors.</p>
                        )}
                        <div className="space-y-1.5">
                            {options.map((opt, index) => (
                                <div key={String(opt.value)} className="flex items-center gap-2 group">
                                    {/* Drag Handle - hidden in colorOnly mode */}
                                    {!colorOnly && (
                                        <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab" />
                                    )}

                                    {/* Color Picker Button */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setColorPickerOpen(colorPickerOpen === String(opt.value) ? null : String(opt.value))}
                                            className={cn(
                                                "w-5 h-5 rounded border flex items-center justify-center transition-all hover:scale-110",
                                                getColorClasses(String(opt.value))
                                            )}
                                        />

                                        {/* Color Picker Dropdown */}
                                        {colorPickerOpen === String(opt.value) && (
                                            <div
                                                ref={colorPickerRef}
                                                className="absolute top-7 left-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 w-[280px]"
                                            >
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {PRESET_COLORS.map((color) => (
                                                        <button
                                                            key={color.name}
                                                            type="button"
                                                            onClick={() => handleColorChange(String(opt.value), `${color.bg} ${color.text} ${color.border}`)}
                                                            className={cn(
                                                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-105 text-center truncate",
                                                                color.bg,
                                                                color.text,
                                                                color.border
                                                            )}
                                                        >
                                                            {opt.label || 'Option'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Option Label - editable input or read-only text */}
                                    {colorOnly ? (
                                        <span className="flex-1 px-2 py-1.5 text-sm text-gray-700">
                                            {opt.label}
                                        </span>
                                    ) : (
                                        <input
                                            type="text"
                                            value={opt.label}
                                            onChange={(e) => handleOptionLabelChange(index, e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    )}

                                    {/* Delete Button - hidden in colorOnly mode */}
                                    {!colorOnly && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveOption(index)}
                                            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Option Button - hidden in colorOnly mode */}
                        {!colorOnly && (
                            <button
                                type="button"
                                onClick={handleAddOption}
                                className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add option
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
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
    actionsColumnIndex: number; // -1 means at the end
    editingCell: { id: string; field: string } | null;
    editingValue: string;
    wrapRules: { columnKey: string; lines: '1' | '2' | '3' | 'full' }[];
    dropdownPosition: { top: number; left: number; width: number; cellHeight: number };
    onEditStart: (row: T, field: string, event: React.MouseEvent) => void;
    onEditChange: (value: string) => void;
    onCellCommit: (value?: string | null) => void;
    onEditCancel: () => void;
    onViewStart: (row: T, field: string, event: React.MouseEvent) => void;
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
    onRowDrop: (e: React.DragEvent<HTMLTableRowElement>, dropPosition: 'before' | 'after') => void;
    isDragging: boolean;
    isDragOver: boolean;
    // Multi-select
    selectable?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    // Single-select (click row to select, only one at a time)
    singleSelect?: boolean;
    isSingleSelected?: boolean;
    onSingleSelect?: () => void;
    // Ad copy column type
    adCopies?: Array<{
        id: string;
        text: string | null;
        name?: string | null;
        type: string;
        row_number?: number;
    }>;
    onAdCopyClick?: (rowId: string, columnKey: string, adCopyType: 'headline' | 'primary_text' | 'description', currentValue: string | null) => void;
    onMediaPreviewClick?: (url: string, isVideo: boolean, title?: string) => void;
    // Thumbnail size rules for media columns
    thumbnailSizeRules?: ThumbnailSizeRule[];
    // Fullscreen richtext editing
    setFullscreenEdit: React.Dispatch<React.SetStateAction<{ id: string; field: string; value: string; type?: string } | null>>;
    setEditingCell: React.Dispatch<React.SetStateAction<{ id: string; field: string } | null>>;
    getRowId: (row: T) => string;
    // View ID for collaborative editor rooms
    viewId?: string;
    // Auto-save for rich text editors (saves without closing popup)
    onAutoSave?: (id: string, field: string, value: string) => Promise<void>;
}

function SortableRow<T>({
    row,
    rowId,
    columns,
    columnWidths,
    sortable,
    showRowActions,
    actionsColumnIndex,
    editingCell,
    editingValue,
    wrapRules,
    dropdownPosition,
    onEditStart,
    onEditChange,
    onCellCommit,
    onEditCancel,
    onViewStart,
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
    selectable,
    isSelected,
    onToggleSelect,
    singleSelect,
    isSingleSelected,
    onSingleSelect,
    adCopies,
    onAdCopyClick,
    onMediaPreviewClick,
    thumbnailSizeRules,
    setFullscreenEdit,
    setEditingCell,
    getRowId,
    viewId,
    onAutoSave,
}: SortableRowProps<T>) {
    const rowRef = useRef<HTMLTableRowElement>(null);
    const [indicatorRect, setIndicatorRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const [dropPosition, setDropPosition] = useState<'before' | 'after'>('after');

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
                    } catch {
                        // Fallback: trigger click to open dropdown
                        inputRef.current.click();
                    }
                }
            }
        }
    }, [editingCell, rowId]);

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
                className={cn(
                    "group data-grid-row",
                    isSingleSelected
                        ? "bg-blue-50 border-l-4 border-l-blue-500 hover:bg-blue-100"
                        : "hover:bg-gray-50"
                )}
                draggable={sortable}
                onDragStart={onRowDragStart}
                onDragEnd={onRowDragEnd}
                onDragEnter={onRowDragEnter}
                onDragOver={(e) => {
                    onRowDragOver(e);
                    // Update indicator position based on cursor position within row
                    if (rowRef.current) {
                        const rect = rowRef.current.getBoundingClientRect();
                        const mouseY = e.clientY;
                        const rowMiddle = rect.top + rect.height / 2;
                        // Show indicator at top or bottom based on cursor position
                        const indicatorTop = mouseY < rowMiddle ? rect.top : rect.bottom;
                        setIndicatorRect({ top: indicatorTop, left: rect.left, width: rect.width });
                        setDropPosition(mouseY < rowMiddle ? 'before' : 'after');
                    }
                }}
                onDragLeave={(e) => {
                    onRowDragLeave(e);
                    // Clear indicator when leaving this row
                    setIndicatorRect(null);
                }}
                onDrop={(e) => {
                    onRowDrop(e, dropPosition);
                    setIndicatorRect(null);
                    setDropPosition('after');
                }}
            >
                {/* Selection Checkbox (multi-select) */}
                {selectable && (
                    <td className="data-grid-td w-10 px-2">
                        <div className="flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={isSelected || false}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onToggleSelect?.();
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                        </div>
                    </td>
                )}

                {/* Selection Radio Button (single-select) */}
                {singleSelect && (
                    <td className="data-grid-td w-10 px-2">
                        <div className="flex items-center justify-center">
                            <input
                                type="radio"
                                checked={isSingleSelected || false}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onSingleSelect?.();
                                }}
                                className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                        </div>
                    </td>
                )}

                {/* Data Columns - with actions inserted at correct position */}
                {columns.map((col, colIndex) => {
                    // Determine if actions should be inserted BEFORE this column
                    const insertActionsHere = showRowActions && actionsColumnIndex === colIndex;

                    // Helper to render the actions cell
                    const actionsCell = showRowActions ? (
                        <td key="_actions" className="data-grid-td px-2" style={{ width: columnWidths['_actions'] || 80 }}>
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
                    ) : null;
                    const value = col.getValue ? col.getValue(row) : ((row as Record<string, unknown>)[col.key] ?? '');
                    const isEditing = editingCell?.id === rowId && editingCell?.field === col.key;
                    const width = columnWidths[col.key] || col.width || 100;

                    // Resolve options if they are a function
                    const options = typeof col.options === 'function' ? col.options(row) : col.options;

                    // Get wrap setting for this column
                    const wrapRule = wrapRules.find(r => r.columnKey === col.key);
                    const wrapLines = wrapRule?.lines;

                    return (
                        <React.Fragment key={col.key}>
                            {insertActionsHere && actionsCell}
                            <td
                            className={cn(
                                "data-grid-td relative",
                                // Remove overflow-hidden when editing so inline textarea can expand
                                wrapLines !== 'full' && !isEditing && "overflow-hidden"
                            )}
                            style={{
                                width,
                                maxWidth: width,
                                // When editing, no height constraints - textarea expands naturally
                                // When not editing, apply maxHeight based on wrap settings
                                ...(!isEditing && (!wrapLines || wrapLines === '1') && { maxHeight: '24px' }),
                                ...(!isEditing && wrapLines === '2' && { maxHeight: '44px' }),
                                ...(!isEditing && wrapLines === '3' && { maxHeight: '64px' })
                            }}
                        >
                            {/* Check for editing FIRST - takes priority over custom render */}
                            {isEditing && col.editable ? (
                                col.type === 'select' ? (
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
                                                        onCellCommit(val);
                                                    }}
                                                    onClear={() => {
                                                        onCellCommit(null);
                                                    }}
                                                    position={dropdownPosition}
                                                    colorMap={col.colorMap}
                                                />
                                            </>,
                                            document.body
                                        )}
                                    </>
                                ) : col.type === 'people' ? (
                                    <>
                                        {/* Show avatar with ring when editing */}
                                        {value ? (
                                            <div className="flex items-center gap-2 ml-2 ring-2 ring-blue-400 rounded-full px-2 py-0.5">
                                                <PeopleColumn value={value} users={col.users || []} />
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center h-6 px-2 rounded ring-2 ring-blue-400 bg-gray-50 min-w-[60px] ml-2" />
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
                                                {/* People dropdown menu */}
                                                <PeopleDropdownMenu
                                                    users={col.users || []}
                                                    value={editingValue}
                                                    onSelect={(val: string) => {
                                                        onCellCommit(val);
                                                    }}
                                                    onClear={() => {
                                                        onCellCommit(null);
                                                    }}
                                                    position={dropdownPosition}
                                                />
                                            </>,
                                            document.body
                                        )}
                                    </>
                                ) : col.type === 'longtext' || col.type === 'text' ? (
                                    <>
                                        {/* Popup editor via portal - overlays the cell */}
                                        {createPortal(
                                            <>
                                                {/* Backdrop */}
                                                <div
                                                    className="fixed inset-0 z-[9998]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCellCommit();
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
                                                                    // Use scrollHeight for accurate measurement
                                                                    el.style.height = 'auto';
                                                                    const scrollH = el.scrollHeight;
                                                                    // Minimum 120px for longtext, 34px for text
                                                                    const minHeight = col.type === 'longtext' ? 120 : 34;
                                                                    const contentHeight = Math.max(scrollH, minHeight);
                                                                    const newHeight = Math.min(contentHeight, maxH);
                                                                    el.style.height = `${newHeight}px`;
                                                                    el.style.overflowY = contentHeight > maxH ? 'auto' : 'hidden';
                                                                    if (showAbove) {
                                                                        el.style.top = `${dropdownPosition.top - newHeight}px`;
                                                                    }
                                                                }
                                                            }}
                                                            value={editingValue}
                                                            onChange={(e) => {
                                                                onEditChange(e.target.value);
                                                                const el = e.target;
                                                                // Use scrollHeight for accurate measurement
                                                                el.style.height = 'auto';
                                                                const scrollH = el.scrollHeight;
                                                                const minHeight = col.type === 'longtext' ? 120 : 34;
                                                                const contentHeight = Math.max(scrollH, minHeight);
                                                                const currMaxH = showAbove ? spaceAbove : spaceBelow;
                                                                const newHeight = Math.min(contentHeight, currMaxH);
                                                                el.style.height = `${newHeight}px`;
                                                                el.style.overflowY = contentHeight > currMaxH ? 'auto' : 'hidden';
                                                                if (showAbove) {
                                                                    el.style.top = `${dropdownPosition.top - newHeight}px`;
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Escape') {
                                                                    onEditCancel();
                                                                }
                                                            }}
                                                            className="fixed z-[9999] bg-white shadow-xl border border-gray-300 rounded text-[13px] text-gray-900 resize focus:outline-none focus:border-blue-400"
                                                            style={{
                                                                top: showAbove ? undefined : dropdownPosition.top,
                                                                bottom: showAbove ? `${window.innerHeight - dropdownPosition.top}px` : undefined,
                                                                left: Math.max(8, Math.min(dropdownPosition.left, window.innerWidth - dropdownPosition.width - 8)),
                                                                width: dropdownPosition.width,
                                                                padding: '8px',
                                                                lineHeight: '20px',
                                                                boxSizing: 'border-box',
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
                                ) : col.type === 'richtext' ? (
                                    <>
                                        {/* Rich text editor via portal */}
                                        {createPortal(
                                            <>
                                                {/* Backdrop */}
                                                <div
                                                    className="fixed inset-0 z-[9998]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCellCommit();
                                                    }}
                                                />
                                                {/* Rich Text Editor popup */}
                                                <div
                                                    className="fixed z-[9999] bg-white shadow-xl border border-gray-300 rounded-lg flex flex-col resize overflow-hidden"
                                                    style={{
                                                        top: dropdownPosition.top,
                                                        left: Math.max(8, Math.min(dropdownPosition.left, window.innerWidth - Math.max(400, dropdownPosition.width) - 8)),
                                                        width: Math.max(400, dropdownPosition.width),
                                                        height: Math.min(400, window.innerHeight - dropdownPosition.top - 50),
                                                        minWidth: '400px',
                                                        minHeight: '200px',
                                                        maxWidth: '90vw',
                                                        maxHeight: window.innerHeight - dropdownPosition.top - 20,
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            onEditCancel();
                                                        }
                                                    }}
                                                >
                                                    <div className="flex-1 overflow-auto">
                                                        <NotionEditorCell
                                                            roomId={`${viewId || 'default'}-${editingCell.id}-${editingCell.field}`}
                                                            roomPrefix="admachin"
                                                            placeholder="Type '/' for commands..."
                                                            initialContent={editingValue}
                                                            onSave={(html) => {
                                                                // Auto-save without closing popup
                                                                if (onAutoSave && editingCell) {
                                                                    onAutoSave(editingCell.id, editingCell.field, html);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </>,
                                            document.body
                                        )}
                                    </>
                                ) : col.type === 'blockeditor' ? (
                                    <>
                                        {/* Block editor (Editor.js) via portal */}
                                        {createPortal(
                                            <>
                                                {/* Backdrop */}
                                                <div
                                                    className="fixed inset-0 z-[9998]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCellCommit();
                                                    }}
                                                />
                                                {/* Block Editor popup */}
                                                <div
                                                    className="fixed z-[9999] bg-white shadow-xl border border-gray-300 rounded-lg flex flex-col"
                                                    style={{
                                                        top: dropdownPosition.top,
                                                        left: Math.max(8, Math.min(dropdownPosition.left, window.innerWidth - Math.max(400, dropdownPosition.width) - 8)),
                                                        width: Math.max(400, dropdownPosition.width),
                                                        maxHeight: window.innerHeight - dropdownPosition.top - 50,
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            onEditCancel();
                                                        }
                                                    }}
                                                >
                                                    <div className="flex-1 overflow-y-auto overflow-x-auto">
                                                        <BlockEditor
                                                            content={editingValue || ''}
                                                            onChange={(html) => onEditChange(html)}
                                                            onBlur={() => {}}
                                                            placeholder="Start typing..."
                                                            minHeight="150px"
                                                            autoFocus
                                                            className="px-2 py-2"
                                                        />
                                                    </div>
                                                </div>
                                            </>,
                                            document.body
                                        )}
                                    </>
                                ) : col.type === 'notioneditor' ? (
                                    <>
                                        {/* Notion editor (Tiptap) via portal */}
                                        {createPortal(
                                            <>
                                                {/* Backdrop */}
                                                <div
                                                    className="fixed inset-0 z-[9998]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCellCommit();
                                                    }}
                                                />
                                                {/* Notion Editor popup - resizable */}
                                                <div
                                                    className="fixed z-[9999] bg-white shadow-xl border border-gray-300 rounded-lg flex flex-col resize overflow-hidden"
                                                    style={{
                                                        top: dropdownPosition.top,
                                                        left: Math.max(8, Math.min(dropdownPosition.left, window.innerWidth - Math.max(500, dropdownPosition.width) - 8)),
                                                        width: Math.max(500, dropdownPosition.width),
                                                        height: Math.min(400, window.innerHeight - dropdownPosition.top - 50),
                                                        minWidth: '400px',
                                                        minHeight: '200px',
                                                        maxWidth: '90vw',
                                                        maxHeight: window.innerHeight - dropdownPosition.top - 20,
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            onEditCancel();
                                                        }
                                                    }}
                                                >
                                                    <div className="flex-1 overflow-auto">
                                                        <NotionEditorCell
                                                            roomId={`${viewId || 'default'}-${editingCell.id}-${editingCell.field}`}
                                                            roomPrefix="admachin"
                                                            placeholder="Type '/' for commands..."
                                                            initialContent={editingValue}
                                                            onSave={(html) => {
                                                                // Auto-save without closing popup
                                                                if (onAutoSave && editingCell) {
                                                                    onAutoSave(editingCell.id, editingCell.field, html);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
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
                                                        onCellCommit();
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
                                                            onCellCommit();
                                                        } else if (e.key === 'Escape') {
                                                            onEditCancel();
                                                        }
                                                    }}
                                                    className="fixed z-[9999] bg-white shadow-xl border border-gray-300 rounded text-[13px] text-gray-900 focus:outline-none focus:border-blue-400"
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
                                // Default display mode - all types use h-[34px] for consistent row height
                                col.type === 'select' ? (() => {
                                    // Check if value exists in options
                                    const optionLabel = options?.find(o => String(o.value) === String(value))?.label;
                                    // Use fallback value if value not found in options (for legacy data)
                                    const fallbackRaw = col.fallbackKey ? (row as Record<string, unknown>)[col.fallbackKey] : null;
                                    // Handle fallback values that might be objects (e.g., from Supabase joins)
                                    const fallbackValue = fallbackRaw && typeof fallbackRaw === 'object'
                                        ? (fallbackRaw as Record<string, unknown>).name || null
                                        : fallbackRaw;
                                    // Only use fallback if value exists but wasn't found in options (legacy data)
                                    // Don't use fallback when value is empty/null (user intentionally cleared it)
                                    const shouldUseFallback = value != null && value !== '' && !optionLabel;
                                    const displayValue = optionLabel || (shouldUseFallback && fallbackValue ? String(fallbackValue) : null);

                                    if (!displayValue) {
                                        return (
                                            <span
                                                className="cursor-pointer w-full h-[34px] flex items-center"
                                                onClick={(e) => col.editable && onEditStart(row, col.key, e)}
                                            />
                                        );
                                    }

                                    return (
                                        <div className="h-[34px] flex items-center">
                                            <span
                                                className={cn(
                                                    "inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium cursor-pointer hover:opacity-80 whitespace-nowrap transition-opacity ml-2",
                                                    col.colorMap?.[String(value)] || col.colorMap?.['default'] || "bg-gray-500 text-white"
                                                )}
                                                onClick={(e) => col.editable && onEditStart(row, col.key, e)}
                                            >
                                                {displayValue}
                                            </span>
                                        </div>
                                    );
                                })() : col.type === 'date' ? (
                                    <span className="text-[10px] text-gray-500 px-2 h-[34px] flex items-center">
                                        {value ? new Date(String(value)).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true
                                        }) : '-'}
                                    </span>
                                ) : col.type === 'url' ? (
                                    <div
                                        className={cn(
                                            "px-2 h-[34px] flex items-center",
                                            (col.editable || col.viewable !== false) && "cursor-pointer"
                                        )}
                                        onClick={(e) => {
                                            if (col.editable) {
                                                onEditStart(row, col.key, e);
                                            } else if (col.viewable !== false && value) {
                                                onViewStart(row, col.key, e);
                                            }
                                        }}
                                    >
                                        <UrlColumn value={value} maxLength={col.urlMaxLength} />
                                    </div>
                                ) : col.type === 'priority' ? (
                                    <div
                                        className="px-2 h-[34px] flex items-center cursor-pointer"
                                        onClick={(e) => col.editable && onEditStart(row, col.key, e)}
                                    >
                                        <PriorityColumn value={value} maxPriority={col.maxPriority} />
                                    </div>
                                ) : col.type === 'rating' ? (
                                    <div
                                        className="px-2 h-[34px] flex items-center cursor-pointer"
                                        onClick={(e) => col.editable && onEditStart(row, col.key, e)}
                                    >
                                        <RatingColumn value={value} maxRating={col.maxRating} />
                                    </div>
                                ) : col.type === 'people' ? (
                                    <div
                                        className="px-2 h-[34px] flex items-center cursor-pointer"
                                        onClick={(e) => col.editable && onEditStart(row, col.key, e)}
                                    >
                                        <PeopleColumn value={value} users={col.users || []} />
                                    </div>
                                ) : col.type === 'id' ? (
                                    <span className="text-[11px] text-gray-700 font-medium px-2 h-[34px] flex items-center">{String(value || '-')}</span>
                                ) : col.type === 'thumbnail' ? (
                                    <div className="px-2 h-[34px] flex items-center">
                                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                            {value ? (
                                                <img
                                                    src={String(value)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <span className="text-gray-400 text-[10px]">-</span>
                                            )}
                                        </div>
                                    </div>
                                ) : col.type === 'media' ? (
                                    (() => {
                                        const mediaUrl = value ? String(value) : null;
                                        // Get size from rules first, then column default, then 'small'
                                        const sizeFromRule = thumbnailSizeRules?.find(r => r.columnKey === col.key)?.size;
                                        const size = sizeFromRule || col.thumbnailSize || 'small';
                                        const sizeConfig = THUMBNAIL_SIZES[size];
                                        // Determine if video by checking mediaTypeKey or URL extension
                                        const mediaTypeValue = col.mediaTypeKey ? (row as Record<string, unknown>)[col.mediaTypeKey] : null;
                                        const isVideo = mediaTypeValue === 'video' ||
                                            (mediaUrl && (mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm') || mediaUrl.endsWith('.mov')));
                                        // Get playback URL (may be different from thumbnail if mediaPlaybackKey is specified)
                                        const playbackUrl = col.mediaPlaybackKey
                                            ? String((row as Record<string, unknown>)[col.mediaPlaybackKey] || mediaUrl || '')
                                            : mediaUrl;

                                        return (
                                            <div className="px-2 py-1 flex items-center">
                                                <div
                                                    className={cn(
                                                        "rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer relative group",
                                                        sizeConfig.className
                                                    )}
                                                    onClick={() => playbackUrl && onMediaPreviewClick?.(playbackUrl, !!isVideo, col.header)}
                                                >
                                                    {mediaUrl ? (
                                                        <>
                                                            {isVideo ? (
                                                                // For videos: check if URL is a thumbnail image or video file
                                                                (() => {
                                                                    const isImageUrl = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(mediaUrl);
                                                                    if (isImageUrl) {
                                                                        // It's a thumbnail image for the video
                                                                        return (
                                                                            <img
                                                                                src={mediaUrl}
                                                                                alt=""
                                                                                className="w-full h-full object-cover"
                                                                                onError={(e) => {
                                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                                }}
                                                                            />
                                                                        );
                                                                    }
                                                                    // It's a video URL - show video element with poster fallback
                                                                    return (
                                                                        <>
                                                                            <video
                                                                                src={mediaUrl}
                                                                                className="w-full h-full object-cover"
                                                                                muted
                                                                                preload="metadata"
                                                                                onLoadedMetadata={(e) => {
                                                                                    // Seek to first frame to show thumbnail
                                                                                    (e.target as HTMLVideoElement).currentTime = 0.1;
                                                                                }}
                                                                            />
                                                                            {/* Fallback video icon (shown behind video if it doesn't load) */}
                                                                            <div className="absolute inset-0 flex items-center justify-center bg-gray-200 -z-10">
                                                                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                                </svg>
                                                                            </div>
                                                                        </>
                                                                    );
                                                                })()
                                                            ) : (
                                                                <img
                                                                    src={mediaUrl}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            )}
                                                            {/* Bottom-right icon overlay: Play for videos, Expand for images */}
                                                            <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <div className="w-5 h-5 rounded bg-black/50 flex items-center justify-center">
                                                                    {isVideo ? (
                                                                        <div className="w-0 h-0 border-l-[6px] border-l-white border-y-[4px] border-y-transparent ml-0.5" />
                                                                    ) : (
                                                                        <Maximize2 className="w-3 h-3 text-white" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400 text-[10px]">-</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : col.type === 'filesize' ? (
                                    <span className="text-[11px] text-gray-500 px-2 h-[34px] flex items-center">
                                        {value ? (() => {
                                            const bytes = Number(value);
                                            if (bytes < 1024) return `${bytes} B`;
                                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                                            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                                        })() : '-'}
                                    </span>
                                ) : col.type === 'adcopy' ? (
                                    (() => {
                                        const adCopyId = value as string | null;
                                        const adCopy = adCopyId ? adCopies?.find(c => c.id === adCopyId) : null;
                                        const displayText = adCopy?.text || null;
                                        const rowNum = adCopy?.row_number;

                                        return (
                                            <div
                                                className={cn(
                                                    "px-2 h-[34px] flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors",
                                                    (!wrapLines || wrapLines === '1') && "truncate"
                                                )}
                                                onClick={() => col.adCopyType && onAdCopyClick?.(rowId, col.key, col.adCopyType, adCopyId)}
                                            >
                                                {displayText ? (
                                                    <>
                                                        <span className="text-[10px] font-mono px-1 py-0.5 bg-gray-100 text-gray-600 rounded flex-shrink-0">
                                                            #{rowNum || '?'}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[13px] text-gray-900",
                                                            (!wrapLines || wrapLines === '1') && "truncate"
                                                        )}>
                                                            {displayText}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-[13px] text-gray-400 italic">
                                                        Click to select...
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()
                                ) : col.type === 'richtext' ? (
                                    <div
                                        className={cn(
                                            "relative group w-full flex items-start overflow-hidden",
                                            // Constrain height based on wrap setting
                                            (!wrapLines || wrapLines === '1') && "max-h-[24px]",
                                            wrapLines === '2' && "max-h-[44px]",
                                            wrapLines === '3' && "max-h-[64px]"
                                        )}
                                        // Stop drag events from bubbling up to the row's drag handlers
                                        // This prevents the DataTable row drag indicator from appearing
                                        // when interacting with RichText content
                                        draggable={false}
                                        onDragStart={(e) => e.stopPropagation()}
                                        onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                        onDragEnter={(e) => e.stopPropagation()}
                                        onDrop={(e) => e.stopPropagation()}
                                    >
                                        <div
                                            className={cn(
                                                "text-[13px] text-gray-900 transition-colors px-2 py-2 flex-1 overflow-hidden",
                                                // Clickable if editable OR viewable
                                                (col.editable || col.viewable !== false) && "cursor-pointer hover:text-blue-600",
                                                // For richtext, use max-height instead of line-clamp for proper truncation of HTML content
                                                (!wrapLines || wrapLines === '1') && "max-h-[24px]",
                                                wrapLines === '2' && "max-h-[48px]",
                                                wrapLines === '3' && "max-h-[72px]"
                                            )}
                                            onClick={(e) => {
                                                if (col.editable) {
                                                    onEditStart(row, col.key, e);
                                                } else if (col.viewable !== false) {
                                                    onViewStart(row, col.key, e);
                                                }
                                            }}
                                        >
                                            {value && String(value).trim() ? (
                                                <div
                                                    className="prose prose-sm max-w-none [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_table]:m-0 [&_*]:leading-[1.4]"
                                                    dangerouslySetInnerHTML={{ __html: String(value) }}
                                                />
                                            ) : <span className="text-gray-400">-</span>}
                                        </div>
                                        {/* Expand button */}
                                        {col.editable && (
                                            <button
                                                className="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const currentValue = col.getValue ? col.getValue(row) : ((row as Record<string, unknown>)[col.key] ?? '');
                                                    setFullscreenEdit({
                                                        id: getRowId(row),
                                                        field: col.key,
                                                        value: String(currentValue || ''),
                                                        type: 'richtext'
                                                    });
                                                }}
                                                title="Open fullscreen editor"
                                            >
                                                <Maximize2 className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                                            </button>
                                        )}
                                    </div>
                                ) : col.type === 'blockeditor' ? (
                                    <div
                                        className={cn(
                                            "relative group w-full flex items-start overflow-hidden",
                                            // Constrain height based on wrap setting
                                            (!wrapLines || wrapLines === '1') && "max-h-[24px]",
                                            wrapLines === '2' && "max-h-[44px]",
                                            wrapLines === '3' && "max-h-[64px]"
                                        )}
                                        // Stop drag events from bubbling up to the row's drag handlers
                                        // This prevents the DataTable row drag indicator from appearing
                                        // when interacting with BlockEditor content
                                        draggable={false}
                                        onDragStart={(e) => e.stopPropagation()}
                                        onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                        onDragEnter={(e) => e.stopPropagation()}
                                        onDrop={(e) => e.stopPropagation()}
                                    >
                                        <div
                                            className={cn(
                                                "text-[13px] text-gray-900 transition-colors px-2 py-2 flex-1 overflow-hidden",
                                                (col.editable || col.viewable !== false) && "cursor-pointer hover:text-blue-600",
                                                // For richtext/blockeditor, use max-height instead of line-clamp for proper truncation
                                                (!wrapLines || wrapLines === '1') && "max-h-[24px]",
                                                wrapLines === '2' && "max-h-[48px]",
                                                wrapLines === '3' && "max-h-[72px]"
                                            )}
                                            onClick={(e) => {
                                                if (col.editable) {
                                                    onEditStart(row, col.key, e);
                                                } else if (col.viewable !== false) {
                                                    onViewStart(row, col.key, e);
                                                }
                                            }}
                                        >
                                            {value && String(value).trim() ? (
                                                <BlockEditorDisplay
                                                    content={String(value)}
                                                    className="[&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_table]:m-0 [&_*]:leading-[1.4]"
                                                />
                                            ) : <span className="text-gray-400">-</span>}
                                        </div>
                                        {/* Expand button */}
                                        {col.editable && (
                                            <button
                                                className="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const currentValue = col.getValue ? col.getValue(row) : ((row as Record<string, unknown>)[col.key] ?? '');
                                                    setFullscreenEdit({
                                                        id: getRowId(row),
                                                        field: col.key,
                                                        value: String(currentValue || ''),
                                                        type: 'blockeditor'
                                                    });
                                                }}
                                                title="Open fullscreen editor"
                                            >
                                                <Maximize2 className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                                            </button>
                                        )}
                                    </div>
                                ) : col.type === 'notioneditor' ? (
                                    <div
                                        className="relative group w-full flex items-start"
                                        // Stop drag events from bubbling up to the row's drag handlers
                                        draggable={false}
                                        onDragStart={(e) => e.stopPropagation()}
                                        onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                        onDragEnter={(e) => e.stopPropagation()}
                                        onDrop={(e) => e.stopPropagation()}
                                    >
                                        <div
                                            className={cn(
                                                "text-[13px] text-gray-900 transition-colors px-2 py-2 flex-1",
                                                (col.editable || col.viewable !== false) && "cursor-pointer hover:text-blue-600",
                                                // Use truncate for single line (same as longtext)
                                                (!wrapLines || wrapLines === '1') && "truncate",
                                                wrapLines === '2' && "line-clamp-2",
                                                wrapLines === '3' && "line-clamp-3"
                                            )}
                                            onClick={(e) => {
                                                if (col.editable) {
                                                    onEditStart(row, col.key, e);
                                                } else if (col.viewable !== false) {
                                                    onViewStart(row, col.key, e);
                                                }
                                            }}
                                        >
                                            <NotionEditorCellDisplay
                                                content={String(col.getValue ? col.getValue(row) : ((row as Record<string, unknown>)[col.key] ?? ''))}
                                            />
                                        </div>
                                        {/* Expand button */}
                                        {col.editable && (
                                            <button
                                                className="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const currentValue = col.getValue ? col.getValue(row) : ((row as Record<string, unknown>)[col.key] ?? '');
                                                    setFullscreenEdit({
                                                        id: getRowId(row),
                                                        field: col.key,
                                                        value: String(currentValue || ''),
                                                        type: 'notioneditor'
                                                    });
                                                }}
                                                title="Open fullscreen editor"
                                            >
                                                <Maximize2 className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <p
                                        className={cn(
                                            "text-[13px] text-gray-900 transition-colors px-2 py-2",
                                            // Clickable if editable OR viewable (text/longtext)
                                            (col.editable || (col.viewable !== false && (col.type === 'text' || col.type === 'longtext'))) && "cursor-pointer hover:text-blue-600",
                                            (!wrapLines || wrapLines === '1') && "truncate",
                                            wrapLines === '2' && "line-clamp-2",
                                            wrapLines === '3' && "line-clamp-3",
                                            wrapLines === 'full' && "whitespace-pre-wrap leading-relaxed"
                                        )}
                                        onClick={(e) => {
                                            if (col.editable) {
                                                onEditStart(row, col.key, e);
                                            } else if (col.viewable !== false && (col.type === 'text' || col.type === 'longtext')) {
                                                onViewStart(row, col.key, e);
                                            }
                                        }}
                                    >
                                        {value && String(value).trim() ? String(value) : '-'}
                                    </p>
                                )
                            )}
                        </td>
                        </React.Fragment>
                    );
                })}

                {/* Row Actions - only render at end if actionsColumnIndex is -1 or >= columns.length */}
                {showRowActions && (actionsColumnIndex === -1 || actionsColumnIndex >= columns.length) && (
                    <td className="data-grid-td px-2" style={{ width: columnWidths['_actions'] || 80 }}>
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
                {/* Empty cell to match header's end drop zone */}
                <td className="!p-0 !border-0 !bg-transparent" style={{ width: 1, minWidth: 1, maxWidth: 1 }}></td>
            </tr>
        </>
    );
}

// Memoized SortableRow to prevent re-renders of unchanged rows
const MemoizedSortableRow = React.memo(SortableRow) as typeof SortableRow;

// ============ Quick Filter Component ============

interface QuickFilterProps {
    columnKey: string;
    header: string;
    options: { label: string; value: string | number }[];
    colorMap?: Record<string, string>;
    value: string | null; // Current filter value (null = no filter)
    onSelect: (value: string) => void;
    onClear: () => void;
}

function QuickFilter({ columnKey, header, options, colorMap, value, onSelect, onClear }: QuickFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Calculate dropdown position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 4,
                left: Math.max(8, Math.min(rect.left, window.innerWidth - 196)),
            });
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(o => String(o.value) === value);

    // Suppress unused variable warning - columnKey is used for uniqueness
    void columnKey;

    return (
        <div className="relative flex-shrink-0">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            >
                {value && selectedOption ? (
                    <>
                        <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                            colorMap?.[String(value)] || "bg-gray-100 text-gray-700"
                        )}>
                            {selectedOption.label}
                        </span>
                        <span
                            className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                        >
                            <X className="w-3 h-3" />
                        </span>
                    </>
                ) : (
                    <>
                        <Filter className="w-3.5 h-3.5" />
                        {header}
                    </>
                )}
            </button>

            {isOpen && createPortal(
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[9998]" onClick={() => { setIsOpen(false); setSearch(''); }} />

                    {/* Dropdown - positioned within viewport bounds */}
                    <div
                        ref={dropdownRef}
                        className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl min-w-[180px] max-w-[calc(100vw-16px)] overflow-hidden"
                        style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                        }}
                    >
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={`Filter ${header.toLowerCase()}...`}
                                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                                    autoFocus
                                />
                            </div>
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
                                        onClick={() => {
                                            onSelect(String(opt.value));
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className={cn(
                                            "px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 transition-colors whitespace-nowrap flex items-center gap-2",
                                            String(opt.value) === value ? "bg-blue-50 text-blue-700" : "text-gray-700"
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
                                        {String(opt.value) === value && (
                                            <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

// ============ Main DataTable Component ============

export function DataTable<T>({
    columns,
    data,
    isLoading = false,
    emptyMessage = 'No data found.',
    // Tabs
    tabs,
    activeTab,
    onTabChange,
    // Toolbar header
    title,
    onNewClick,
    newButtonLabel = 'New',
    headerActions,
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
    thumbnailSizeRules: externalThumbnailSizeRules,
    onThumbnailSizeRulesChange,
    fullscreen = false,
    layout = 'inline',
    maxHeight,
    quickFilters = [],
    groupRules: externalGroupRules,
    onGroupRulesChange,
    columnOrder: externalColumnOrder,
    onColumnOrderChange,
    savedColumnWidths,
    onColumnWidthsChange,
    // View persistence props
    viewId,
    userId: userIdProp,
    initialPreferences: externalInitialPreferences,
    sharedPreferences: externalSharedPreferences,
    onPreferencesChange,
    onSaveForEveryone,
    onResetPreferences,
    // Column config editing
    onColumnConfigChange,
    // Multi-select mode
    selectable = false,
    selectedIds,
    onSelectionChange,
    // Single-select mode
    singleSelect = false,
    selectedRowId,
    onRowSelect,
    // View mode
    viewMode: externalViewMode,
    onViewModeChange,
    cardColumns: _cardColumns = 4, // eslint-disable-line @typescript-eslint/no-unused-vars
    // Gallery configuration for native media preview
    galleryConfig,
    galleryLookups,
    // Card configuration for text-focused reading view
    cardConfig,
    cardLookups,
    // Ad copy data for adcopy column type
    adCopies,
    // Custom gallery card renderer
    renderGalleryCard,
    // Custom card renderer for text cards
    renderCard
}: DataTableProps<T>) {
    // ============ Auto-persistence: Load preferences when viewId is provided ============
    const { user: authUser } = useAuth();
    const userId = userIdProp || authUser?.id;

    // Internal preference state for auto-persistence
    const [internalUserPrefs, setInternalUserPrefs] = useState<ViewPreferencesConfig | null>(null);
    const [internalSharedPrefs, setInternalSharedPrefs] = useState<ViewPreferencesConfig | null>(null);
    // If external preferences provided OR no viewId, consider loaded immediately (skip DB fetch)
    const [prefsLoaded, setPrefsLoaded] = useState(!viewId || !!externalInitialPreferences);

    // Load preferences when viewId changes - skip if external preferences provided
    useEffect(() => {
        // Skip internal loading if external preferences are provided
        if (externalInitialPreferences) {
            setPrefsLoaded(true);
            return;
        }

        if (!viewId) {
            setPrefsLoaded(true);
            return;
        }

        const currentViewId = viewId; // Capture for closure
        let cancelled = false;
        async function loadPrefs() {
            try {
                const [userPrefs, sharedPrefs] = await Promise.all([
                    userId ? getUserViewPreferences(userId, currentViewId) : null,
                    getSharedViewPreferences(currentViewId),
                ]);
                if (cancelled) return;
                if (userPrefs) setInternalUserPrefs(userPrefs);
                if (sharedPrefs) setInternalSharedPrefs(sharedPrefs);
            } catch (error) {
                console.error('[DataTable] Failed to load preferences:', error);
            } finally {
                if (!cancelled) setPrefsLoaded(true);
            }
        }
        loadPrefs();
        return () => { cancelled = true; };
    }, [viewId, userId, externalInitialPreferences]);

    // Use external preferences if provided, otherwise use internal (auto-loaded)
    const initialPreferences = externalInitialPreferences || internalUserPrefs;
    const sharedPreferences = externalSharedPreferences || internalSharedPrefs;

    // ============ End auto-persistence setup ============

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

    // Initialize thumbnail size rules from preferences
    const getInitialThumbnailSizeRules = (): ThumbnailSizeRule[] => {
        if (initialPreferences?.thumbnail_size_config && initialPreferences.thumbnail_size_config.length > 0) {
            return initialPreferences.thumbnail_size_config;
        }
        if (sharedPreferences?.thumbnail_size_config && sharedPreferences.thumbnail_size_config.length > 0) {
            return sharedPreferences.thumbnail_size_config;
        }
        return [];
    };

    // Thumbnail size state (per-column thumbnail sizes for media columns)
    const [internalThumbnailSizeRules, setInternalThumbnailSizeRules] = useState<ThumbnailSizeRule[]>(getInitialThumbnailSizeRules);
    const thumbnailSizeRules = externalThumbnailSizeRules || internalThumbnailSizeRules;
    const setThumbnailSizeRules = (newRulesOrUpdater: ThumbnailSizeRule[] | ((prev: ThumbnailSizeRule[]) => ThumbnailSizeRule[])) => {
        const newRules = typeof newRulesOrUpdater === 'function'
            ? newRulesOrUpdater(thumbnailSizeRules)
            : newRulesOrUpdater;
        if (onThumbnailSizeRulesChange) {
            onThumbnailSizeRulesChange(newRules);
        } else {
            setInternalThumbnailSizeRules(newRules);
        }
    };

    // Helper to get thumbnail size for a column (from rules or column default)
    const getThumbnailSize = (columnKey: string, columnDefault?: ThumbnailSize): ThumbnailSize => {
        const rule = thumbnailSizeRules.find(r => r.columnKey === columnKey);
        return rule?.size || columnDefault || 'small';
    };

    // Helper to set thumbnail size for a column
    const handleThumbnailSizeChange = (columnKey: string, size: ThumbnailSize) => {
        setThumbnailSizeRules((prev: ThumbnailSizeRule[]) => {
            const existing = prev.find((r: ThumbnailSizeRule) => r.columnKey === columnKey);
            if (existing) {
                return prev.map((r: ThumbnailSizeRule) => r.columnKey === columnKey ? { ...r, size } : r);
            }
            return [...prev, { columnKey, size }];
        });
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

    // View mode state (managed internally if not provided externally)
    const [internalViewMode, setInternalViewMode] = useState<'table' | 'gallery' | 'card'>('table');
    const viewMode = externalViewMode || internalViewMode;
    const setViewMode = (mode: 'table' | 'gallery' | 'card') => {
        if (onViewModeChange) {
            onViewModeChange(mode);
        } else {
            setInternalViewMode(mode);
        }
    };

    // Card view settings state
    const [showCardSettings, setShowCardSettings] = useState(false);
    const [cardLayout, setCardLayout] = useState<'horizontal' | 'vertical'>(
        cardConfig?.layout === 'masonry' ? 'horizontal' : 'vertical'
    );
    const [cardMinWidth, setCardMinWidth] = useState(cardConfig?.minWidth || 300);
    const [cardVisibleMetadata, setCardVisibleMetadata] = useState<string[]>(
        cardConfig?.metadataKeys || []
    );

    // Sync cardVisibleMetadata when cardConfig.metadataKeys changes
    useEffect(() => {
        if (cardConfig?.metadataKeys) {
            setCardVisibleMetadata(cardConfig.metadataKeys);
        }
    }, [cardConfig?.metadataKeys?.join(',')]);

    const cardSettingsRef = useRef<HTMLDivElement>(null);

    // Close card settings on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (cardSettingsRef.current && !cardSettingsRef.current.contains(event.target as Node)) {
                setShowCardSettings(false);
            }
        };
        if (showCardSettings) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCardSettings]);

    // Ad copy picker modal state
    const [adCopyModalState, setAdCopyModalState] = useState<{
        isOpen: boolean;
        rowId: string;
        columnKey: string;
        adCopyType: 'headline' | 'primary_text' | 'description';
        currentValue: string | null;
    } | null>(null);

    // Media preview modal state
    const [mediaPreviewState, setMediaPreviewState] = useState<{
        isOpen: boolean;
        url: string;
        isVideo: boolean;
        title?: string;
    } | null>(null);

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


    // Type-based default widths for columns
    const getTypeDefaultWidth = (type?: string): number => {
        switch (type) {
            case 'id': return 50;
            case 'select': return 100;
            case 'people': return 100;
            case 'date': return 100;
            case 'thumbnail': return 60;
            case 'media': return 80;
            case 'filesize': return 80;
            case 'url': return 150;
            case 'longtext': return 300;
            case 'textarea': return 250;
            default: return 120;
        }
    };

    // Column widths state - prefer initialPreferences over savedColumnWidths
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const widths: Record<string, number> = {};
        const preferenceWidths = initialPreferences?.column_widths || savedColumnWidths;
        columns.forEach((col) => {
            // Use saved width if available, then column definition, then type-based default
            widths[col.key] = preferenceWidths?.[col.key] || col.width || getTypeDefaultWidth(col.type);
        });
        // Add actions column width (default 80px = w-20)
        widths['_actions'] = preferenceWidths?.['_actions'] || 80;
        return widths;
    });

    // Sync columnWidths when savedColumnWidths or initialPreferences.column_widths changes
    // IMPORTANT: Only update if values actually changed to prevent infinite loops
    useEffect(() => {
        const preferenceWidths = initialPreferences?.column_widths || savedColumnWidths;
        if (preferenceWidths && Object.keys(preferenceWidths).length > 0) {
            setColumnWidths(prev => {
                // Check if any values actually changed
                let hasChanges = false;
                for (const [key, width] of Object.entries(preferenceWidths)) {
                    if (typeof width === 'number' && prev[key] !== width) {
                        hasChanges = true;
                        break;
                    }
                }

                // Only create new object if there are actual changes
                if (!hasChanges) {
                    return prev; // Return same reference to prevent re-renders
                }

                const updated = { ...prev };
                for (const [key, width] of Object.entries(preferenceWidths)) {
                    if (typeof width === 'number') {
                        updated[key] = width;
                    }
                }
                return updated;
            });
        }
    }, [savedColumnWidths, initialPreferences?.column_widths, viewId]);

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

    // Row order state - for manual drag-and-drop ordering persistence
    const [internalRowOrder, setInternalRowOrder] = useState<string[]>([]);

    // Track actions column position (index in the full column order, -1 means at the end)
    const [actionsColumnIndex, setActionsColumnIndex] = useState<number>(-1);

    // Handle column reorder - now works with orderedColumns to include new columns
    // Also handles special '_actions' key for the Actions column
    // dropPosition: 'before' = insert before target, 'after' = insert after target
    const handleColumnReorder = useCallback((draggedKey: string, targetKey: string, dropPosition: 'before' | 'after') => {
        // Build new order from orderedColumns (which includes all columns, even new ones)
        const currentOrderedKeys = orderedColumns.map(c => c.key);

        // Handle _actions column specially
        if (draggedKey === '_actions') {
            // Moving actions column to a new position
            let targetIndex = targetKey === '_actions' ? currentOrderedKeys.length : currentOrderedKeys.indexOf(targetKey);
            if (targetIndex === -1) return;
            // Adjust for 'after' position
            if (dropPosition === 'after') targetIndex++;
            setActionsColumnIndex(targetIndex);
            return;
        }

        if (targetKey === '_actions') {
            // Moving a column to the actions position
            const draggedIndex = currentOrderedKeys.indexOf(draggedKey);
            if (draggedIndex === -1) return;

            const newOrder = currentOrderedKeys.filter(k => k !== draggedKey);
            // Insert at actions position, adjusted for before/after
            const insertAt = actionsColumnIndex === -1 ? newOrder.length : Math.min(actionsColumnIndex, newOrder.length);

            if (dropPosition === 'after') {
                // When dropping AFTER actions:
                // Insert the column after actions, and set actionsColumnIndex to fix actions position
                newOrder.splice(Math.min(insertAt + 1, newOrder.length), 0, draggedKey);
                setActionsColumnIndex(insertAt);
            } else {
                // When dropping BEFORE actions:
                // Insert the column at actions position, then shift actions right by 1
                newOrder.splice(Math.min(insertAt, newOrder.length), 0, draggedKey);
                // Actions should now be one position to the right
                setActionsColumnIndex(insertAt + 1);
            }

            if (onColumnOrderChange) {
                onColumnOrderChange(newOrder);
            } else {
                setInternalColumnOrder(newOrder);
            }
            return;
        }

        const draggedIndex = currentOrderedKeys.indexOf(draggedKey);
        const targetIndex = currentOrderedKeys.indexOf(targetKey);

        if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

        const newOrder = [...currentOrderedKeys];
        const [removed] = newOrder.splice(draggedIndex, 1);

        // Adjust target index based on drop position and drag direction
        // After removing the dragged item, indices shift if dragging left-to-right
        let adjustedTargetIndex = targetIndex;
        if (draggedIndex < targetIndex) {
            adjustedTargetIndex = targetIndex - 1;
        }
        // Apply 'after' offset
        if (dropPosition === 'after') {
            adjustedTargetIndex++;
        }

        const finalIndex = Math.min(adjustedTargetIndex, newOrder.length);
        newOrder.splice(finalIndex, 0, removed);

        // Adjust actionsColumnIndex if a column moved across the actions boundary
        if (actionsColumnIndex !== -1) {
            let newActionsIndex = actionsColumnIndex;
            // If dragged from before actions to after actions, decrement
            if (draggedIndex < actionsColumnIndex && finalIndex >= actionsColumnIndex) {
                newActionsIndex = actionsColumnIndex - 1;
            }
            // If dragged from after actions to before actions, increment
            else if (draggedIndex >= actionsColumnIndex && finalIndex < actionsColumnIndex) {
                newActionsIndex = actionsColumnIndex + 1;
            }
            if (newActionsIndex !== actionsColumnIndex) {
                setActionsColumnIndex(newActionsIndex);
            }
        }

        if (onColumnOrderChange) {
            onColumnOrderChange(newOrder);
        } else {
            setInternalColumnOrder(newOrder);
        }
    }, [orderedColumns, onColumnOrderChange, actionsColumnIndex]);

    // Resize tracking
    const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

    // Editing state
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number; cellHeight: number }>({ top: 0, left: 0, width: 200, cellHeight: 34 });

    // Viewing state (for read-only text popup)
    const [viewingCell, setViewingCell] = useState<{ id: string; field: string; value: string; type?: string } | null>(null);
    const [viewingPosition, setViewingPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 400 });

    // Fullscreen richtext editing state
    const [fullscreenEdit, setFullscreenEdit] = useState<{ id: string; field: string; value: string; type?: string } | null>(null);

    // Close fullscreen edit on Escape key
    useEffect(() => {
        if (!fullscreenEdit) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setFullscreenEdit(null);
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [fullscreenEdit]);

    // Copy state
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Native row drag state
    const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
    const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

    // Native column drag state
    const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
    const [dragOverColumnKey, setDragOverColumnKey] = useState<string | null>(null);
    const [columnIndicatorRect, setColumnIndicatorRect] = useState<{ top: number; left: number; height: number } | null>(null);
    const [columnDropPosition, setColumnDropPosition] = useState<'before' | 'after'>('before');

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

    // Team view dropdown visibility
    const [showTeamViewDropdown, setShowTeamViewDropdown] = useState(false);
    const teamViewDropdownRef = useRef<HTMLDivElement>(null);

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
    const [filterRules, setFilterRulesRaw] = useState<FilterRule[]>(getInitialFilterRules);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterSearch, setFilterSearch] = useState('');
    const filterPanelRef = useRef<HTMLDivElement>(null);

    // Helper to handle filter dependencies (e.g., subproject -> project)
    // When a filter is set for a column with dependsOn, auto-add/update parent column filter
    // When a parent filter is cleared, auto-clear child filters
    const setFilterRules = useCallback((updater: FilterRule[] | ((prev: FilterRule[]) => FilterRule[])) => {
        setFilterRulesRaw(prev => {
            let newRules = typeof updater === 'function' ? updater(prev) : [...updater];

            // First: Check if any parent columns have been cleared, and clear their children
            // Find columns that have children depending on them
            const parentColumns = columns.filter(c =>
                columns.some(child => child.dependsOn?.parentKey === c.key)
            );

            for (const parentCol of parentColumns) {
                const parentHadFilter = prev.some(r => r.field === parentCol.key && r.operator === 'is');
                const parentHasFilter = newRules.some(r => r.field === parentCol.key && r.operator === 'is');

                // Parent filter was cleared
                if (parentHadFilter && !parentHasFilter) {
                    // Find and remove all child filters
                    const childCols = columns.filter(c => c.dependsOn?.parentKey === parentCol.key);
                    for (const childCol of childCols) {
                        newRules = newRules.filter(r => r.field !== childCol.key);
                    }
                }
            }

            // Second: Find any rules for columns with dependencies that have values
            // and auto-add parent filters
            const additionalRules: FilterRule[] = [];
            for (const rule of newRules) {
                if (rule.value && rule.operator === 'is') {
                    const col = columns.find(c => c.key === rule.field);
                    if (col?.dependsOn) {
                        const parentValue = col.dependsOn.getParentValue(rule.value);
                        if (parentValue !== null) {
                            // Check if parent filter already exists with correct value
                            const existingParentRule = newRules.find(
                                r => r.field === col.dependsOn!.parentKey && r.operator === 'is'
                            );
                            if (!existingParentRule) {
                                // Add parent filter
                                additionalRules.push({
                                    id: Math.random().toString(36).substring(2, 11),
                                    field: col.dependsOn.parentKey,
                                    operator: 'is',
                                    value: String(parentValue),
                                    conjunction: 'and'
                                });
                            } else if (existingParentRule.value !== String(parentValue)) {
                                // Update existing parent filter - find and update in place
                                const idx = newRules.findIndex(r => r.id === existingParentRule.id);
                                if (idx !== -1) {
                                    newRules[idx] = { ...newRules[idx], value: String(parentValue) };
                                }
                            }
                        }
                    }
                }
            }

            return additionalRules.length > 0 ? [...newRules, ...additionalRules] : newRules;
        });
    }, [columns]);

    // Track if preferences have been loaded (to avoid resetting after user makes changes)
    const preferencesLoadedRef = useRef(false);
    // Track if we've applied user-specific preferences (not just shared)
    const userPrefsAppliedRef = useRef(false);
    // Track if we've applied shared preferences (separate from fallback timer)
    const sharedPrefsAppliedRef = useRef(false);

    // Sync state when preferences are loaded after initial mount
    // User preferences take priority over shared preferences
    useEffect(() => {
        // User preferences take priority - always apply them if they arrive
        if (initialPreferences) {
            if (userPrefsAppliedRef.current) return;

            userPrefsAppliedRef.current = true;

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
            // Apply thumbnail size from user preferences
            if (initialPreferences.thumbnail_size_config?.length) {
                setInternalThumbnailSizeRules(initialPreferences.thumbnail_size_config as ThumbnailSizeRule[]);
            }
            // Apply column widths from user preferences
            if (initialPreferences.column_widths && Object.keys(initialPreferences.column_widths).length > 0) {
                setColumnWidths(prev => {
                    const updated = { ...prev };
                    for (const [key, width] of Object.entries(initialPreferences.column_widths!)) {
                        if (typeof width === 'number') {
                            updated[key] = width;
                        }
                    }
                    return updated;
                });
            }
            // Apply column order from user preferences
            if (initialPreferences.column_order?.length) {
                setInternalColumnOrder(initialPreferences.column_order);
            }
            // Apply row order from user preferences
            if (initialPreferences.row_order?.length) {
                setInternalRowOrder(initialPreferences.row_order);
            }

            // Delay enabling auto-save until after React has processed all state updates
            setTimeout(() => {
                preferencesLoadedRef.current = true;
                prefsAppliedRef.current = true;
            }, 100);
            return;
        }

        // Fall back to shared preferences if no user preferences
        // Use separate ref to avoid race condition with fallback timer
        if (!sharedPreferences || sharedPrefsAppliedRef.current) return;

        sharedPrefsAppliedRef.current = true;

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
        // Apply thumbnail size from shared preferences
        if (sharedPreferences.thumbnail_size_config?.length) {
            setInternalThumbnailSizeRules(sharedPreferences.thumbnail_size_config as ThumbnailSizeRule[]);
        }
        // Apply column widths from shared preferences
        if (sharedPreferences.column_widths && Object.keys(sharedPreferences.column_widths).length > 0) {
            setColumnWidths(prev => {
                const updated = { ...prev };
                for (const [key, width] of Object.entries(sharedPreferences.column_widths!)) {
                    if (typeof width === 'number') {
                        updated[key] = width;
                    }
                }
                return updated;
            });
        }
        // Apply column order from shared preferences
        if (sharedPreferences.column_order?.length) {
            setInternalColumnOrder(sharedPreferences.column_order);
        }
        // Apply row order from shared preferences
        if (sharedPreferences.row_order?.length) {
            setInternalRowOrder(sharedPreferences.row_order);
        }

        // Delay enabling auto-save until after React has processed all state updates
        setTimeout(() => {
            preferencesLoadedRef.current = true;
            prefsAppliedRef.current = true;
        }, 100);
    }, [initialPreferences, sharedPreferences, externalGroupRules, externalWrapRules]);

    // Fallback: Enable auto-save after 1 second if no preferences arrive
    // This ensures auto-save works for new users with no saved preferences
    useEffect(() => {
        if (preferencesLoadedRef.current) return;

        const timeout = setTimeout(() => {
            if (!preferencesLoadedRef.current) {
                preferencesLoadedRef.current = true;
                prefsAppliedRef.current = true; // Also mark as applied so auto-save can work
            }
        }, 1000);

        return () => clearTimeout(timeout);
    }, []);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        columnKey: string;
        columnHeader: string;
        columnType?: string;
        columnEditable?: boolean;
        position: { top: number; left: number };
    } | null>(null);

    // Field editor state
    const [fieldEditor, setFieldEditor] = useState<{
        columnKey: string;
        columnHeader: string;
        options: { label: string; value: string | number }[];
        colorMap: Record<string, string>;
        colorOnly: boolean;
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
                const cellValue = col?.getValue ? col.getValue(row) : ((row as Record<string, unknown>)[rule.field] ?? '');
                const strValue = String(cellValue).toLowerCase();
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

        // When no sorting is applied, use saved row order if available
        if (effectiveSortRules.length === 0) {
            if (internalRowOrder.length > 0) {
                // Apply saved row order
                const orderMap = new Map(internalRowOrder.map((id, index) => [id, index]));
                return [...filteredData].sort((a, b) => {
                    const aIndex = orderMap.get(getRowId(a)) ?? Infinity;
                    const bIndex = orderMap.get(getRowId(b)) ?? Infinity;
                    return aIndex - bIndex;
                });
            }
            return filteredData;
        }

        const sorted = [...filteredData].sort((a, b) => {
            for (const rule of effectiveSortRules) {
                const col = columns.find(c => c.key === rule.key);
                const aVal = col?.getValue ? col.getValue(a) : ((a as Record<string, unknown>)[rule.key] ?? '');
                const bVal = col?.getValue ? col.getValue(b) : ((b as Record<string, unknown>)[rule.key] ?? '');

                // Handle empty values (null/undefined/empty string)
                const aEmpty = aVal == null || aVal === '';
                const bEmpty = bVal == null || bVal === '';
                if (aEmpty && bEmpty) continue;
                if (aEmpty) return 1;
                if (bEmpty) return -1;

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
    }, [filteredData, sortRules, groupRules, columns, internalRowOrder, getRowId]);

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
        setShowTeamViewDropdown(false);
    }, []);

    // Track if preferences have changed from initial/shared
    const getCurrentPreferences = useCallback(() => ({
        sort_config: sortRules,
        filter_config: filterRules as Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>,
        group_config: groupRules,
        wrap_config: wrapRules as Array<{ columnKey: string; lines: '1' | '3' | 'full' }>,
        thumbnail_size_config: thumbnailSizeRules as Array<{ columnKey: string; size: 'small' | 'medium' | 'large' | 'xl' }>,
        column_widths: columnWidths,
        column_order: columnOrder,
        row_order: internalRowOrder.length > 0 ? internalRowOrder : undefined
    }), [sortRules, filterRules, groupRules, wrapRules, thumbnailSizeRules, columnWidths, columnOrder, internalRowOrder]);

    // Check if current view matches team view
    const isMatchingTeamView = useMemo(() => {
        if (!sharedPreferences) return false;
        const current = getCurrentPreferences();

        // Helper to compare objects with sorted keys (JSON.stringify is key-order sensitive)
        const sortedStringify = (obj: Record<string, unknown> | undefined | null) => {
            if (!obj) return '{}';
            const sorted: Record<string, unknown> = {};
            Object.keys(obj).sort().forEach(key => { sorted[key] = obj[key]; });
            return JSON.stringify(sorted);
        };

        const sortMatch = JSON.stringify(current.sort_config || []) === JSON.stringify(sharedPreferences.sort_config || []);
        const filterMatch = JSON.stringify(current.filter_config || []) === JSON.stringify(sharedPreferences.filter_config || []);
        const groupMatch = JSON.stringify(current.group_config || []) === JSON.stringify(sharedPreferences.group_config || []);
        const wrapMatch = JSON.stringify(current.wrap_config || []) === JSON.stringify(sharedPreferences.wrap_config || []);
        const thumbnailMatch = JSON.stringify(current.thumbnail_size_config || []) === JSON.stringify(sharedPreferences.thumbnail_size_config || []);

        // Compare column widths excluding _actions (internal column not saved in team views)
        const currentWidths = { ...current.column_widths };
        const sharedWidths = { ...(sharedPreferences.column_widths || {}) };
        delete currentWidths['_actions'];
        delete sharedWidths['_actions'];
        const columnWidthsMatch = sortedStringify(currentWidths) === sortedStringify(sharedWidths);

        const columnOrderMatch = JSON.stringify(current.column_order || []) === JSON.stringify(sharedPreferences.column_order || []);

        return sortMatch && filterMatch && groupMatch && wrapMatch && thumbnailMatch && columnWidthsMatch && columnOrderMatch;
    }, [getCurrentPreferences, sharedPreferences]);

    // Auto-save preferences when they change (debounced)
    const preferencesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstRenderRef = useRef(true);
    const skipNextAutoSaveRef = useRef(false); // Skip auto-save after saving Team View
    const prefsAppliedRef = useRef(false); // Track when loaded prefs have been applied to state

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

        // Skip auto-save if we just saved Team View (to prevent re-creating user prefs)
        if (skipNextAutoSaveRef.current) {
            skipNextAutoSaveRef.current = false;
            return;
        }

        // Don't auto-save until initial preferences have been fully applied to state
        // This prevents overwriting loaded preferences with default state during initial load
        if (!preferencesLoadedRef.current || !prefsAppliedRef.current) return;

        // Need either external callback OR viewId for auto-save
        const hasExternalCallback = !!onPreferencesChangeRef.current;
        const hasAutoPersistence = !!viewId && !!userId;
        if (!hasExternalCallback && !hasAutoPersistence) return;

        // Clear any pending timeout
        if (preferencesChangeTimeoutRef.current) {
            clearTimeout(preferencesChangeTimeoutRef.current);
        }

        // Debounce the save - wait 500ms after last change
        preferencesChangeTimeoutRef.current = setTimeout(async () => {
            const prefs = getCurrentPreferences();
            // Call external callback if provided
            onPreferencesChangeRef.current?.(prefs);
            // Auto-save if viewId is provided (auto-persistence)
            if (viewId && userId) {
                try {
                    await saveUserViewPreferences(userId, viewId, prefs);
                    setInternalUserPrefs(prefs);
                } catch (error) {
                    console.error('[DataTable] Failed to auto-save preferences:', error);
                }
            }
        }, 500);

        return () => {
            if (preferencesChangeTimeoutRef.current) {
                clearTimeout(preferencesChangeTimeoutRef.current);
            }
        };
    }, [sortRules, filterRules, groupRules, wrapRules, thumbnailSizeRules, columnWidths, columnOrder, internalRowOrder, getCurrentPreferences, viewId, userId]);

    // Handle load team view - loads the shared/team preferences
    const handleLoadTeamView = useCallback(() => {
        if (!sharedPreferences) return; // No team view saved, do nothing

        setSortRules(sharedPreferences.sort_config || []);
        setFilterRules((sharedPreferences.filter_config || []) as FilterRule[]);
        setGroupRules(sharedPreferences.group_config || []);
        setWrapRules((sharedPreferences.wrap_config || []) as Array<{ columnKey: string; lines: '1' | '2' | '3' | 'full' }>);
        setThumbnailSizeRules((sharedPreferences.thumbnail_size_config || []) as ThumbnailSizeRule[]);

        // Load column widths from team view or use defaults
        if (sharedPreferences.column_widths) {
            setColumnWidths(sharedPreferences.column_widths);
        }

        // Load column order from team view or use defaults
        if (sharedPreferences.column_order) {
            setInternalColumnOrder(sharedPreferences.column_order);
        }
    }, [sharedPreferences, setGroupRules, setWrapRules, setThumbnailSizeRules]);

    // Handle save for everyone
    const handleSaveForEveryone = useCallback(async () => {
        // Cancel any pending auto-save to prevent race condition
        if (preferencesChangeTimeoutRef.current) {
            clearTimeout(preferencesChangeTimeoutRef.current);
            preferencesChangeTimeoutRef.current = null;
        }

        // Skip the next auto-save triggered by state changes
        skipNextAutoSaveRef.current = true;

        const preferences = getCurrentPreferences();
        // Call external callback if provided
        onSaveForEveryone?.(preferences);
        // Auto-save shared preferences if viewId is provided
        if (viewId) {
            try {
                // Save to shared (team) preferences
                await saveSharedViewPreferences(viewId, preferences);
                setInternalSharedPrefs(preferences);

                // Also save to user preferences so they match team view on reload
                // This ensures the user sees the team view they just saved
                if (userId) {
                    await saveUserViewPreferences(userId, viewId, preferences);
                    setInternalUserPrefs(preferences);
                }
            } catch (error) {
                console.error('[DataTable] Failed to save shared preferences:', error);
            }
        }
    }, [getCurrentPreferences, onSaveForEveryone, viewId, userId]);

    // Handle reset preferences (back to team/shared view)
    const handleResetPreferences = useCallback(async () => {
        // Call external callback if provided
        onResetPreferences?.();
        // Auto-delete user preferences if viewId is provided
        if (viewId && userId) {
            try {
                await deleteUserViewPreferences(userId, viewId);
                setInternalUserPrefs(null);
            } catch (error) {
                console.error('[DataTable] Failed to reset preferences:', error);
            }
        }
    }, [onResetPreferences, viewId, userId]);

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
                (wrapPanelRef.current && wrapPanelRef.current.contains(target)) ||
                (teamViewDropdownRef.current && teamViewDropdownRef.current.contains(target));

            if (!clickedInsideAnyPanel) {
                closeAllPanels();
            }
        }
        if (showSortPanel || showFilterPanel || showGroupPanel || showWrapPanel || showTeamViewDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showSortPanel, showFilterPanel, showGroupPanel, showWrapPanel, showTeamViewDropdown, closeAllPanels]);

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
            columnType: col.type,
            columnEditable: col.editable,
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
        const col = columns.find(c => c.key === column);
        // Type-based default minWidths: select/people columns can be narrower
        const typeMinWidth = col?.type === 'select' ? 60
            : col?.type === 'people' ? 60
            : col?.type === 'id' ? 40
            : col?.type === 'date' ? 80
            : 50;
        const minWidth = col?.minWidth || typeMinWidth;
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

        const value = col.getValue ? col.getValue(row) : ((row as Record<string, unknown>)[field] ?? '');
        setEditingCell({ id: getRowId(row), field });
        setEditingValue(String(value));
    }, [columns, getRowId]);

    const handleCellCommit = useCallback(async (newValue?: string | null) => {
        if (!editingCell || !onUpdate) {
            setEditingCell(null);
            return;
        }

        // For notioneditor, if no explicit value provided, just close without saving
        // NotionEditor handles its own saves via onSave callback (auto-save on blur/debounce)
        // BlockEditor does NOT auto-save, so it uses editingValue when closing
        const col = columns.find(c => c.key === editingCell.field);
        if (newValue === undefined && col?.type === 'notioneditor') {
            setEditingCell(null);
            return;
        }

        // Convert empty strings to null for UUID fields (project_id, subproject_id, user_id, etc.)
        let valueToSave: string | null = newValue !== undefined ? newValue : editingValue;
        if (valueToSave === '' || valueToSave === null) {
            valueToSave = null;
        }

        try {
            // First, save the edited field
            await onUpdate(editingCell.id, editingCell.field, valueToSave);

            // Check if this column has dependsOn config - update parent if needed
            // e.g., when subproject is selected, auto-set the project
            const col = columns.find(c => c.key === editingCell.field);
            if (col?.dependsOn && valueToSave) {
                const parentValue = col.dependsOn.getParentValue(valueToSave);
                if (parentValue !== null) {
                    // Get current row's parent value
                    const row = data.find(r => getRowId(r) === editingCell.id);
                    const currentParentValue = row ? (row as Record<string, unknown>)[col.dependsOn.parentKey] : null;
                    // Only update if different
                    if (parentValue !== currentParentValue) {
                        await onUpdate(editingCell.id, col.dependsOn.parentKey, parentValue);
                    }
                }
            }

            // Check if this column is a parent that has children depending on it
            // e.g., when project is changed, clear subproject if it doesn't belong to new project
            const childCol = columns.find(c => c.dependsOn?.parentKey === editingCell.field);
            if (childCol) {
                const row = data.find(r => getRowId(r) === editingCell.id);
                const currentChildValue = row ? (row as Record<string, unknown>)[childCol.key] : null;
                if (currentChildValue && valueToSave) {
                    // Check if child value still belongs to new parent
                    const childParentValue = childCol.dependsOn?.getParentValue(currentChildValue as string);
                    if (childParentValue !== valueToSave) {
                        await onUpdate(editingCell.id, childCol.key, null);
                    }
                } else if (!valueToSave && currentChildValue) {
                    // Parent cleared, clear child too
                    await onUpdate(editingCell.id, childCol.key, null);
                }
            }
        } catch (error) {
            console.error('Failed to update:', error);
        }
        setEditingCell(null);
    }, [editingCell, editingValue, onUpdate, columns, data, getRowId]);

    const handleEditCancel = useCallback(() => {
        setEditingCell(null);
        setEditingValue('');
    }, []);

    // Auto-save handler for rich text editors (saves without closing popup)
    const handleAutoSave = useCallback(async (id: string, field: string, value: string) => {
        if (!onUpdate) return;
        try {
            await onUpdate(id, field, value);
            setEditingValue(value); // Keep editingValue in sync
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, [onUpdate]);

    // View handlers (for read-only text viewing)
    const handleViewStart = useCallback((row: T, field: string, event: React.MouseEvent) => {
        const col = columns.find(c => c.key === field);
        if (!col) return;

        // Check if viewable (default true for text/longtext/richtext/blockeditor/url when not editable)
        const isViewable = col.viewable !== false && (col.type === 'text' || col.type === 'longtext' || col.type === 'richtext' || col.type === 'blockeditor' || col.type === 'notioneditor' || col.type === 'url');
        if (!isViewable) return;

        // Calculate position from the clicked element (cell)
        const target = event.currentTarget as HTMLElement;
        const cellElement = target.closest('td');
        const cellRect = cellElement ? cellElement.getBoundingClientRect() : target.getBoundingClientRect();
        setViewingPosition({
            top: cellRect.top,
            left: cellRect.left,
            width: Math.max(cellRect.width, 400), // minimum 400px width for viewing
        });

        const value = col.getValue ? col.getValue(row) : ((row as Record<string, unknown>)[field] ?? '');
        setViewingCell({ id: getRowId(row), field, value: String(value || ''), type: col.type });
    }, [columns, getRowId]);

    const handleViewClose = useCallback(() => {
        setViewingCell(null);
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
            // Extract default values from active "is" filters
            const defaults: Record<string, unknown> = {};
            for (const rule of filterRules) {
                if (rule.operator === 'is' && rule.value) {
                    defaults[rule.field] = rule.value;
                }
            }
            await onCreateRow(Object.keys(defaults).length > 0 ? defaults : undefined);
            // Don't reload - parent component should optimistically update data
        } catch (error) {
            console.error('Failed to create row:', error);
        } finally {
            setIsCreating(false);
        }
    }, [onCreateRow, isCreating, filterRules]);

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
        onRowDrop: (e: React.DragEvent<HTMLTableRowElement>, dropPosition: 'before' | 'after') => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId !== rowId) {
                // Use sortedData for index calculation since that's what's displayed
                const oldIndex = sortedData.findIndex(row => getRowId(row) === draggedId);
                let newIndex = sortedData.findIndex(row => getRowId(row) === rowId);
                if (oldIndex !== -1 && newIndex !== -1) {
                    // Adjust newIndex based on drop position and drag direction
                    if (dropPosition === 'after' && oldIndex < newIndex) {
                        // Dragging down, drop after target - no adjustment needed
                    } else if (dropPosition === 'before' && oldIndex > newIndex) {
                        // Dragging up, drop before target - no adjustment needed
                    } else if (dropPosition === 'after' && oldIndex > newIndex) {
                        // Dragging up, drop after target - increment index
                        newIndex = newIndex + 1;
                    } else if (dropPosition === 'before' && oldIndex < newIndex) {
                        // Dragging down, drop before target - decrement index
                        newIndex = newIndex - 1;
                    }
                    const newOrder = arrayMove(sortedData.map(getRowId), oldIndex, newIndex);
                    setInternalRowOrder(newOrder); // Update internal state for persistence
                    if (onReorder) {
                        onReorder(newOrder);
                    }
                }
            }
            setDraggingRowId(null);
            setDragOverRowId(null);
        },
    }), [sortedData, getRowId, onReorder, draggingRowId, dragOverRowId]);

    // Calculate total width (columnWidths now includes _actions)
    const totalWidth = Object.values(columnWidths).reduce((a, b) => a + b, 0);

    // Build combined column order including _actions at the right position
    const columnsWithActions = useMemo(() => {
        if (!showRowActions) return orderedColumns.map(col => ({ type: 'data' as const, col }));

        const result: Array<{ type: 'data'; col: typeof orderedColumns[0] } | { type: 'actions' }> = [];
        const insertIndex = actionsColumnIndex === -1 ? orderedColumns.length : Math.min(actionsColumnIndex, orderedColumns.length);

        orderedColumns.forEach((col, i) => {
            if (i === insertIndex) {
                result.push({ type: 'actions' });
            }
            result.push({ type: 'data', col });
        });

        // If actions should be at the end
        if (insertIndex >= orderedColumns.length) {
            result.push({ type: 'actions' });
        }

        return result;
    }, [orderedColumns, showRowActions, actionsColumnIndex]);

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
            "bg-white border border-gray-200 shadow-sm flex flex-col min-w-0",
            fullscreen ? "flex-1" : "rounded-xl",
            (layout === 'fullPage' || layout === 'contained') && "flex-1 overflow-hidden",
            layout === 'contained' && "h-full"
        )}>
            {/* Tab Bar - renders above toolbar if tabs are provided */}
            {tabs && tabs.length > 0 && (
                <div className="border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto scrollbar-thin">
                    <div className="flex items-center gap-1 px-3 pt-2 min-w-max">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange?.(tab.id)}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "text-blue-600 bg-gray-50 border-b-2 border-blue-600 -mb-px"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                )}
                            >
                                {tab.label}
                                {tab.count !== undefined && (
                                    <span className={cn(
                                        "ml-2 px-1.5 py-0.5 text-xs rounded-full",
                                        activeTab === tab.id
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-gray-200 text-gray-600"
                                    )}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Toolbar - fixed, does not scroll horizontally */}
            <div className="border-b border-gray-200 bg-gray-50 flex-shrink-0">
                {/* Row 1: Title + Quick Filters + Spacer + Actions - wraps when needed */}
                <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
                    {/* Title */}
                    {title && (
                        <h1 className="text-sm font-semibold text-gray-900 flex-shrink-0">{title}</h1>
                    )}

                    {/* Quick Filters */}
                    {quickFilters.map(columnKey => {
                        const col = columns.find(c => c.key === columnKey);
                        if (!col) return null;

                        // Get options for this column (static options only, not function-based)
                        const rawOptions = col.filterOptions || (Array.isArray(col.options) ? col.options : []);
                        if (rawOptions.length === 0) return null;

                        // Find current filter value for this column (look for "is" filter)
                        const currentFilter = filterRules.find(r => r.field === columnKey && r.operator === 'is');
                        const currentValue = currentFilter?.value || null;

                        return (
                            <QuickFilter
                                key={columnKey}
                                columnKey={columnKey}
                                header={col.header}
                                options={rawOptions.map(o => ({ label: o.label, value: o.value }))}
                                colorMap={col.colorMap}
                                value={currentValue}
                                onSelect={(value) => {
                                    // Remove any existing filter for this column, then add new one
                                    const newRules = filterRules.filter(r => r.field !== columnKey);
                                    newRules.push({
                                        id: Math.random().toString(36).substring(2, 11),
                                        field: columnKey,
                                        operator: 'is',
                                        value: value,
                                        conjunction: 'and'
                                    });
                                    setFilterRules(newRules);
                                }}
                                onClear={() => {
                                    // Remove filter for this column
                                    setFilterRules(filterRules.filter(r => r.field !== columnKey));
                                }}
                            />
                        );
                    })}

                    {/* Spacer - pushes right icons to the right */}
                    <div className="flex-1" />

                    {/* Right icons group - wraps together as a unit */}
                    <div className="flex items-center gap-2 flex-shrink-0">

                {/* View Mode Toggle - show if any view config is provided */}
                {(galleryConfig || renderGalleryCard || cardConfig || renderCard) && (
                    <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-0.5 flex-shrink-0">
                        {/* Gallery button - only if gallery is configured */}
                        {(galleryConfig || renderGalleryCard) && (
                            <button
                                onClick={() => setViewMode('gallery')}
                                className={cn(
                                    "p-1.5 rounded transition-colors",
                                    viewMode === 'gallery' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                                )}
                                title="Gallery view"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                        )}
                        {/* Card button - only if card is configured */}
                        {(cardConfig || renderCard) && (
                            <button
                                onClick={() => setViewMode('card')}
                                className={cn(
                                    "p-1.5 rounded transition-colors",
                                    viewMode === 'card' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                                )}
                                title="Card view"
                            >
                                <FileText className="w-4 h-4" />
                            </button>
                        )}
                        {/* Table button - always shown when toggle is visible */}
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                viewMode === 'table' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                            )}
                            title="Table view"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Card View Settings Button - only when in card view */}
                {viewMode === 'card' && cardConfig && (
                    <div className="relative flex-shrink-0" ref={cardSettingsRef}>
                        <button
                            onClick={() => setShowCardSettings(!showCardSettings)}
                            className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                                showCardSettings
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                            )}
                            title="Card settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        {/* Card Settings Dropdown */}
                        {showCardSettings && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4 space-y-4">
                                <div className="text-sm font-medium text-gray-900 border-b pb-2">Card Settings</div>

                                {/* Layout Toggle */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-700">Layout Style</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCardLayout('horizontal')}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors",
                                                cardLayout === 'horizontal'
                                                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                                                    : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                                            )}
                                        >
                                            <LayoutList className="w-3.5 h-3.5" />
                                            Horizontal
                                        </button>
                                        <button
                                            onClick={() => setCardLayout('vertical')}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors",
                                                cardLayout === 'vertical'
                                                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                                                    : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                                            )}
                                        >
                                            <Columns className="w-3.5 h-3.5" />
                                            Vertical
                                        </button>
                                    </div>
                                </div>

                                {/* Card Width */}
                                <div className="space-y-2">
                                    <label htmlFor="card-width-slider" className="text-xs font-medium text-gray-700">
                                        Card Width: {cardMinWidth}px
                                    </label>
                                    <input
                                        id="card-width-slider"
                                        name="card-width"
                                        type="range"
                                        min="200"
                                        max="600"
                                        step="50"
                                        value={cardMinWidth}
                                        onChange={(e) => setCardMinWidth(Number(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-400">
                                        <span>Narrow</span>
                                        <span>Wide</span>
                                    </div>
                                </div>

                                {/* Metadata Toggles - show all select/people columns as options */}
                                {(() => {
                                    // Get all columns that can be shown as metadata (select, people, or have colorMap)
                                    const metadataColumns = columns.filter(col =>
                                        col.type === 'select' ||
                                        col.type === 'people' ||
                                        col.colorMap ||
                                        col.key === 'project_id' ||
                                        col.key === 'subproject_id'
                                    );

                                    if (metadataColumns.length === 0) return null;

                                    // Split into visible (in order) and available
                                    const visibleItems = cardVisibleMetadata
                                        .map(key => metadataColumns.find(c => c.key === key))
                                        .filter(Boolean) as typeof metadataColumns;
                                    const availableItems = metadataColumns.filter(
                                        col => !cardVisibleMetadata.includes(col.key)
                                    );

                                    // Handle drag end for reordering
                                    const handleFooterDragEnd = (event: DragEndEvent) => {
                                        const { active, over } = event;
                                        if (!over || active.id === over.id) return;

                                        setCardVisibleMetadata(prev => {
                                            const oldIdx = prev.indexOf(String(active.id));
                                            const newIdx = prev.indexOf(String(over.id));
                                            if (oldIdx === -1 || newIdx === -1) return prev;
                                            const newArr = [...prev];
                                            newArr.splice(oldIdx, 1);
                                            newArr.splice(newIdx, 0, String(active.id));
                                            return newArr;
                                        });
                                    };

                                    return (
                                        <div className="space-y-2">
                                            {/* Visible items with drag reorder */}
                                            {visibleItems.length > 0 && (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-gray-700">Footer Order</label>
                                                    <DndContext
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={handleFooterDragEnd}
                                                    >
                                                        <SortableContext
                                                            items={cardVisibleMetadata}
                                                            strategy={verticalListSortingStrategy}
                                                        >
                                                            <div className="space-y-0.5">
                                                                {visibleItems.map((col) => (
                                                                    <SortableFooterItem
                                                                        key={col.key}
                                                                        id={col.key}
                                                                        label={col.header}
                                                                        onRemove={() => setCardVisibleMetadata(prev => prev.filter(k => k !== col.key))}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </SortableContext>
                                                    </DndContext>
                                                </div>
                                            )}

                                            {/* Available items to add */}
                                            {availableItems.length > 0 && (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-gray-700">
                                                        {visibleItems.length > 0 ? 'Add' : 'Show in Footer'}
                                                    </label>
                                                    <div className="flex flex-wrap gap-1">
                                                        {availableItems.map((col) => (
                                                            <button
                                                                key={col.key}
                                                                onClick={() => setCardVisibleMetadata(prev => [...prev, col.key])}
                                                                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                                {col.header}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}

                {/* Sort Button */}
                <div className="relative flex-shrink-0">
                    <button
                        onClick={() => {
                            const wasOpen = showSortPanel;
                            closeAllPanels();
                            if (!wasOpen) setShowSortPanel(true);
                        }}
                        title={sortRules.length === 0
                            ? 'Sort'
                            : sortRules.length === 1
                                ? `Sorted by ${columns.find(c => c.key === sortRules[0].key)?.header || sortRules[0].key}`
                                : `Sorted by ${sortRules.length} fields`}
                        className={cn(
                            "relative flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-colors",
                            sortRules.length > 0
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        )}
                    >
                        <ArrowUpDown className="w-4 h-4" />
                        {sortRules.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] bg-blue-600 text-white rounded-full">
                                {sortRules.length}
                            </span>
                        )}
                    </button>

                    {/* Sort Panel Popup */}
                    {showSortPanel && (
                        <div
                            ref={sortPanelRef}
                            className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[320px] max-w-[calc(100vw-24px)] z-50"
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
                <div ref={filterPanelRef} className="relative flex-shrink-0">
                    <button
                        onClick={() => {
                            const wasOpen = showFilterPanel;
                            closeAllPanels();
                            if (!wasOpen) setShowFilterPanel(true);
                        }}
                        title={filterRules.length === 0
                            ? 'Filter'
                            : filterRules.length === 1
                                ? `Filtered by ${columns.find(c => c.key === filterRules[0].field)?.header || filterRules[0].field}`
                                : `Filtered by ${filterRules.length} rules`}
                        className={cn(
                            "relative flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-colors",
                            filterRules.length > 0
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        )}
                    >
                        <Filter className="w-4 h-4" />
                        {filterRules.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] bg-green-600 text-white rounded-full">
                                {filterRules.length}
                            </span>
                        )}
                    </button>

                    {/* Filter Panel Popup */}
                    {showFilterPanel && (
                        <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[320px] max-w-[calc(100vw-24px)] z-50">
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
                                                    const hasOptions = col?.filterOptions || Array.isArray(rawOptions) || col?.type === 'people';

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

                                                    // For people type, generate options from users array
                                                    let colOptions = col?.filterOptions || (Array.isArray(rawOptions) ? rawOptions : undefined);

                                                    if (col?.type === 'people' && col?.users && !colOptions) {
                                                        colOptions = col.users.map((u: { id: string; first_name?: string; last_name?: string; email: string }) => ({
                                                            label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
                                                            value: u.id,
                                                        }));
                                                    }

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
                <div ref={groupPanelRef} className="relative flex-shrink-0">
                    <button
                        className={cn(
                            "relative flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-colors",
                            groupRules.length > 0
                                ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        )}
                        title={groupRules.length === 0
                            ? 'Group'
                            : groupRules.length === 1
                                ? `Grouped by ${columns.find(c => c.key === groupRules[0].key)?.header || groupRules[0].key}`
                                : `Grouped by ${groupRules.length} fields`}
                        onClick={() => {
                            const wasOpen = showGroupPanel;
                            closeAllPanels();
                            if (!wasOpen) setShowGroupPanel(true);
                        }}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        {groupRules.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] bg-purple-600 text-white rounded-full">
                                {groupRules.length}
                            </span>
                        )}
                    </button>

                    {/* Group Panel Popup */}
                    {showGroupPanel && (
                        <div
                            className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[320px] max-w-[calc(100vw-24px)] z-50 flex flex-col gap-2"
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
                <div className="relative flex-shrink-0" ref={wrapPanelRef}>
                    <button
                        onClick={() => {
                            const wasOpen = showWrapPanel;
                            closeAllPanels();
                            if (!wasOpen) setShowWrapPanel(true);
                        }}
                        title={wrapRules.length === 0 ? 'Expand' : `${wrapRules.length} columns expanded`}
                        className={cn(
                            "relative flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-colors",
                            wrapRules.length > 0
                                ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        )}
                    >
                        <Maximize2 className="w-4 h-4" />
                        {wrapRules.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] bg-orange-600 text-white rounded-full">
                                {wrapRules.length}
                            </span>
                        )}
                    </button>

                    {showWrapPanel && (
                        <>
                            {/* Panel Container - right-0 since button is on right side */}
                            <div
                                className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-72 max-w-[calc(100vw-24px)]"
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

                {/* Team View Dropdown - single button with dropdown menu */}
                {(onSaveForEveryone || viewId) && (
                    <div ref={teamViewDropdownRef} className="relative flex-shrink-0">
                        {isMatchingTeamView ? (
                            /* Just show indicator when on Team View - no dropdown */
                            <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-700 whitespace-nowrap">
                                ✓ Team View
                            </span>
                        ) : (
                            /* Show dropdown button when on Your View */
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const wasOpen = showTeamViewDropdown;
                                        closeAllPanels();
                                        if (!wasOpen) setShowTeamViewDropdown(true);
                                    }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap bg-gray-100 text-gray-600 hover:bg-gray-200"
                                >
                                    Your View
                                    <ChevronDown className="w-3 h-3" />
                                </button>

                                {/* Dropdown Menu */}
                                {showTeamViewDropdown && (
                                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] max-w-[calc(100vw-24px)] z-50">
                                        {/* Use Team View */}
                                        {(onResetPreferences || viewId) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    // Delete user preferences AND apply team view
                                                    handleResetPreferences();
                                                    handleLoadTeamView();
                                                    setShowTeamViewDropdown(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left"
                                            >
                                                Use Team View
                                            </button>
                                        )}

                                        {/* Save as Team View */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleSaveForEveryone();
                                                setShowTeamViewDropdown(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left"
                                        >
                                            Save as Team View
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                    {/* Header Actions */}
                    {headerActions}

                    {/* New Button */}
                    {onNewClick && (
                        <button
                            onClick={onNewClick}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex-shrink-0"
                        >
                            <Plus className="w-3 h-3" />
                            {newButtonLabel}
                        </button>
                    )}
                    </div>{/* End right icons group */}
                </div>

                {/* Row 2: Collapse/Expand buttons - only show when grouping is active */}
                {groupRules.length > 0 && groupedData && (
                    <div className="px-3 py-1.5 flex items-center gap-2 flex-nowrap border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs flex-shrink-0">
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
                    </div>
                )}
            </div>

            {/* Content area - horizontal scroll, vertical scroll for fullPage/contained modes */}
            <div
                className={cn(
                    "overflow-x-auto min-w-0",
                    (layout === 'fullPage' || layout === 'contained') && "flex-1 overflow-y-auto"
                )}
                style={layout === 'inline' && maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
            >
                {/* Table View */}
                {viewMode === 'table' && (
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
                    <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                        <tr className="bg-white">
                            {selectable && (
                                <th className="data-grid-th w-10 px-2 bg-white">
                                    <div className="flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds ? selectedIds.size > 0 && selectedIds.size === data.length : false}
                                            ref={(el) => {
                                                if (el && selectedIds) {
                                                    el.indeterminate = selectedIds.size > 0 && selectedIds.size < data.length;
                                                }
                                            }}
                                            onChange={(e) => {
                                                if (!onSelectionChange) return;
                                                if (e.target.checked) {
                                                    // Select all
                                                    const allIds = new Set(data.map(getRowId));
                                                    onSelectionChange(allIds);
                                                } else {
                                                    // Deselect all
                                                    onSelectionChange(new Set());
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                </th>
                            )}
                            {/* Single-select radio column header (no select-all for single-select) */}
                            {singleSelect && (
                                <th className="data-grid-th w-10 px-2 bg-white">
                                    {/* Empty header - single select doesn't have select-all */}
                                </th>
                            )}
                            {columnsWithActions.map((item) => {
                                if (item.type === 'actions') {
                                    // Render Actions column
                                    return (
                                        <th
                                            key="_actions"
                                            className={cn(
                                                "data-grid-th relative group/header cursor-grab active:cursor-grabbing bg-white",
                                                draggingColumnKey === '_actions' && "opacity-50"
                                            )}
                                            style={{ width: columnWidths['_actions'] || 80 }}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('text/plain', '_actions');
                                                e.dataTransfer.effectAllowed = 'move';
                                                setDraggingColumnKey('_actions');
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
                                                const draggedKey = e.dataTransfer.types.includes('text/plain') ? 'pending' : null;
                                                if (draggedKey && draggingColumnKey !== '_actions') {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const mouseX = e.clientX;
                                                    const colMiddle = rect.left + rect.width / 2;
                                                    const position = mouseX < colMiddle ? 'before' : 'after';
                                                    const indicatorLeft = position === 'before' ? rect.left : rect.right;
                                                    setDragOverColumnKey('_actions');
                                                    setColumnDropPosition(position);
                                                    setColumnIndicatorRect({ top: rect.top, left: indicatorLeft, height: rect.height });
                                                }
                                            }}
                                            onDragLeave={(e) => {
                                                const relatedTarget = e.relatedTarget as Node | null;
                                                if (!e.currentTarget.contains(relatedTarget)) {
                                                    if (dragOverColumnKey === '_actions') {
                                                        setDragOverColumnKey(null);
                                                        setColumnIndicatorRect(null);
                                                    }
                                                }
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const draggedKey = e.dataTransfer.getData('text/plain');
                                                if (draggedKey && draggedKey !== '_actions') {
                                                    handleColumnReorder(draggedKey, '_actions', columnDropPosition);
                                                }
                                                setDragOverColumnKey(null);
                                                setColumnIndicatorRect(null);
                                            }}
                                        >
                                            <div className="flex items-center gap-1">
                                                <GripVertical className="w-3 h-3 text-gray-300 group-hover/header:text-gray-500 rotate-90" />
                                                Actions
                                            </div>
                                            {resizable && (
                                                <div
                                                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                                                    onMouseDown={(e) => handleResizeStart('_actions', e)}
                                                />
                                            )}
                                        </th>
                                    );
                                }

                                // Render data column
                                const col = item.col;
                                const sortRule = sortRules.find(r => r.key === col.key);
                                const isDraggingThis = draggingColumnKey === col.key;
                                return (
                                    <th
                                        key={col.key}
                                        className={cn(
                                            "data-grid-th relative group/header cursor-grab active:cursor-grabbing bg-white",
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
                                            const draggedKey = e.dataTransfer.types.includes('text/plain') ? 'pending' : null;
                                            if (draggedKey && draggingColumnKey !== col.key) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const mouseX = e.clientX;
                                                const colMiddle = rect.left + rect.width / 2;
                                                const position = mouseX < colMiddle ? 'before' : 'after';
                                                const indicatorLeft = position === 'before' ? rect.left : rect.right;
                                                setDragOverColumnKey(col.key);
                                                setColumnDropPosition(position);
                                                setColumnIndicatorRect({ top: rect.top, left: indicatorLeft, height: rect.height });
                                            }
                                        }}
                                        onDragLeave={(e) => {
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
                                                handleColumnReorder(draggedKey, col.key, columnDropPosition);
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
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setContextMenu({
                                                        columnKey: col.key,
                                                        columnHeader: col.header,
                                                        columnType: col.type,
                                                        columnEditable: col.editable,
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
                            {/* Invisible drop zone for dragging columns to the far right */}
                            <th
                                className="!p-0 !border-0 !bg-transparent !border-none"
                                style={{ width: 1, minWidth: 1, maxWidth: 1, padding: 0 }}
                                onDragEnter={(e) => e.preventDefault()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (draggingColumnKey && draggingColumnKey !== '_end_zone') {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDragOverColumnKey('_end_zone');
                                        setColumnDropPosition('after');
                                        setColumnIndicatorRect({ top: rect.top, left: rect.left, height: rect.height });
                                    }
                                }}
                                onDragLeave={(e) => {
                                    const relatedTarget = e.relatedTarget as Node | null;
                                    if (!e.currentTarget.contains(relatedTarget)) {
                                        if (dragOverColumnKey === '_end_zone') {
                                            setDragOverColumnKey(null);
                                            setColumnIndicatorRect(null);
                                        }
                                    }
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const draggedKey = e.dataTransfer.getData('text/plain');
                                    if (draggedKey && draggedKey !== '_actions') {
                                        // Move column to the end (before actions if actions exists)
                                        const currentOrderedKeys = orderedColumns.map(c => c.key);
                                        const newOrder = currentOrderedKeys.filter(k => k !== draggedKey);
                                        newOrder.push(draggedKey);
                                        if (onColumnOrderChange) {
                                            onColumnOrderChange(newOrder);
                                        } else {
                                            setInternalColumnOrder(newOrder);
                                        }
                                    }
                                    setDragOverColumnKey(null);
                                    setColumnIndicatorRect(null);
                                }}
                            />
                        </tr>
                    </thead>

                    {/* Table Body - using native HTML5 drag-and-drop for rows */}
                    <tbody>
                        {(isLoading || !prefsLoaded) ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i}>
                                    {sortable && <td className="data-grid-td"><div className="h-3.5 skeleton-shimmer rounded w-4 mx-2"></div></td>}
                                    {selectable && <td className="data-grid-td"><div className="h-3.5 skeleton-shimmer rounded w-3.5 mx-2"></div></td>}
                                    {singleSelect && <td className="data-grid-td"><div className="h-3.5 skeleton-shimmer rounded w-3.5 mx-2"></div></td>}
                                    {orderedColumns.map((col, colIdx) => (
                                        <td key={col.key} className="data-grid-td">
                                            <div
                                                className="h-3.5 skeleton-shimmer rounded mx-2"
                                                style={{
                                                    width: col.type === 'id' ? '24px' :
                                                           col.type === 'thumbnail' ? '40px' :
                                                           col.type === 'select' ? '60px' :
                                                           col.type === 'date' ? '70px' :
                                                           `${60 + (colIdx % 3) * 20}%`,
                                                    animationDelay: `${colIdx * 0.05}s`
                                                }}
                                            ></div>
                                        </td>
                                    ))}
                                    {showRowActions && <td className="data-grid-td"><div className="h-3.5 skeleton-shimmer rounded w-10 mx-2"></div></td>}
                                    <td className="!p-0 !border-0 !bg-transparent" style={{ width: 1, minWidth: 1, maxWidth: 1 }}></td>
                                </tr>
                            ))
                        ) : data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (sortable ? 1 : 0) + (selectable ? 1 : 0) + (showRowActions ? 1 : 0) + 1}
                                    className="data-grid-td px-4 py-8 text-center text-gray-500 text-xs"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : groupedData ? (
                            // Recursive Grouped Rendering
                            (() => {
                                const colSpan = columns.length + (sortable ? 1 : 0) + (selectable ? 1 : 0) + (showRowActions ? 1 : 0) + 1;

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
                                                                actionsColumnIndex={actionsColumnIndex}
                                                                editingCell={editingCell}
                                                                editingValue={editingValue}
                                                                wrapRules={wrapRules}
                                                                dropdownPosition={dropdownPosition}
                                                                onEditStart={handleEditStart}
                                                                onEditChange={setEditingValue}
                                                                onCellCommit={handleCellCommit}
                                                                onEditCancel={handleEditCancel}
                                                                onViewStart={handleViewStart}
                                                                onDelete={onDelete}
                                                                onCopy={onCopy ? handleCopy : undefined}
                                                                onDuplicate={onDuplicate}
                                                                copiedId={copiedId}
                                                                {...createRowDragHandlers(getRowId(row))}
                                                                isDragging={draggingRowId === getRowId(row)}
                                                                isDragOver={dragOverRowId === getRowId(row)}
                                                                selectable={selectable}
                                                                isSelected={selectedIds?.has(getRowId(row))}
                                                                onToggleSelect={() => {
                                                                    if (!onSelectionChange || !selectedIds) return;
                                                                    const id = getRowId(row);
                                                                    const newSet = new Set(selectedIds);
                                                                    if (newSet.has(id)) {
                                                                        newSet.delete(id);
                                                                    } else {
                                                                        newSet.add(id);
                                                                    }
                                                                    onSelectionChange(newSet);
                                                                }}
                                                                singleSelect={singleSelect}
                                                                isSingleSelected={selectedRowId === getRowId(row)}
                                                                onSingleSelect={() => {
                                                                    if (!onRowSelect) return;
                                                                    const id = getRowId(row);
                                                                    // Toggle: if already selected, deselect; otherwise select
                                                                    onRowSelect(selectedRowId === id ? null : id);
                                                                }}
                                                                adCopies={adCopies}
                                                                onAdCopyClick={(rowId, columnKey, adCopyType, currentValue) => {
                                                                    setAdCopyModalState({
                                                                        isOpen: true,
                                                                        rowId,
                                                                        columnKey,
                                                                        adCopyType,
                                                                        currentValue
                                                                    });
                                                                }}
                                                                onMediaPreviewClick={(url, isVideo, title) => {
                                                                    setMediaPreviewState({
                                                                        isOpen: true,
                                                                        url,
                                                                        isVideo,
                                                                        title
                                                                    });
                                                                }}
                                                                thumbnailSizeRules={thumbnailSizeRules}
                                                                setFullscreenEdit={setFullscreenEdit}
                                                                setEditingCell={setEditingCell}
                                                                getRowId={getRowId}
                                                                viewId={viewId}
                                                                onAutoSave={handleAutoSave}
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
                                    actionsColumnIndex={actionsColumnIndex}
                                    editingCell={editingCell}
                                    editingValue={editingValue}
                                    wrapRules={wrapRules}
                                    dropdownPosition={dropdownPosition}
                                    onEditStart={handleEditStart}
                                    onEditChange={setEditingValue}
                                    onCellCommit={handleCellCommit}
                                    onEditCancel={handleEditCancel}
                                    onViewStart={handleViewStart}
                                    onDelete={onDelete}
                                    onCopy={onCopy ? handleCopy : undefined}
                                    onDuplicate={onDuplicate}
                                    copiedId={copiedId}
                                    {...createRowDragHandlers(getRowId(row))}
                                    isDragging={draggingRowId === getRowId(row)}
                                    isDragOver={dragOverRowId === getRowId(row)}
                                    selectable={selectable}
                                    isSelected={selectedIds?.has(getRowId(row))}
                                    onToggleSelect={() => {
                                        if (!onSelectionChange || !selectedIds) return;
                                        const id = getRowId(row);
                                        const newSet = new Set(selectedIds);
                                        if (newSet.has(id)) {
                                            newSet.delete(id);
                                        } else {
                                            newSet.add(id);
                                        }
                                        onSelectionChange(newSet);
                                    }}
                                    singleSelect={singleSelect}
                                    isSingleSelected={selectedRowId === getRowId(row)}
                                    onSingleSelect={() => {
                                        if (!onRowSelect) return;
                                        const id = getRowId(row);
                                        // Toggle: if already selected, deselect; otherwise select
                                        onRowSelect(selectedRowId === id ? null : id);
                                    }}
                                    adCopies={adCopies}
                                    onAdCopyClick={(rowId, columnKey, adCopyType, currentValue) => {
                                        setAdCopyModalState({
                                            isOpen: true,
                                            rowId,
                                            columnKey,
                                            adCopyType,
                                            currentValue
                                        });
                                    }}
                                    onMediaPreviewClick={(url, isVideo, title) => {
                                        setMediaPreviewState({
                                            isOpen: true,
                                            url,
                                            isVideo,
                                            title
                                        });
                                    }}
                                    thumbnailSizeRules={thumbnailSizeRules}
                                    setFullscreenEdit={setFullscreenEdit}
                                    setEditingCell={setEditingCell}
                                    getRowId={getRowId}
                                    viewId={viewId}
                                    onAutoSave={handleAutoSave}
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
                                {selectable && <td className="w-10" />}
                                {singleSelect && <td className="w-10" />}
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
                                {showRowActions && <td style={{ width: columnWidths['_actions'] || 80 }} />}
                            </tr>
                        )}
                    </tbody>
                </table>
                )}

                {/* Gallery/Card View */}
                {viewMode === 'gallery' && (galleryConfig || renderGalleryCard) && (
                    <div className="p-4">
                        {/* Select All Header */}
                        {selectable && (
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                                <span className="text-sm text-gray-600">
                                    {selectedIds ? selectedIds.size : 0} of {sortedData.length} selected
                                </span>
                                <button
                                    onClick={() => {
                                        if (!onSelectionChange) return;
                                        if (selectedIds && selectedIds.size === sortedData.length) {
                                            onSelectionChange(new Set());
                                        } else {
                                            onSelectionChange(new Set(sortedData.map(getRowId)));
                                        }
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    {selectedIds && selectedIds.size === sortedData.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                        )}

                        {/* Card Grid */}
                        {(isLoading || !prefsLoaded) ? (
                            <div
                                className="grid gap-4 justify-start"
                                style={{ gridTemplateColumns: 'repeat(auto-fill, 220px)' }}
                            >
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-[220px] h-[280px] bg-gray-100 rounded-lg skeleton-shimmer"
                                        style={{ animationDelay: `${i * 0.05}s` }}
                                    />
                                ))}
                            </div>
                        ) : sortedData.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 text-sm">
                                {emptyMessage}
                            </div>
                        ) : (
                            <div
                                className="grid gap-4 justify-start"
                                style={{ gridTemplateColumns: 'repeat(auto-fill, 220px)' }}
                            >
                                {sortedData.map((item) => {
                                    const id = getRowId(item);
                                    const isSelected = selectedIds ? selectedIds.has(id) : false;
                                    const isDraggingThisCard = draggingRowId === id;
                                    const isDragOverThisCard = dragOverRowId === id;
                                    const handleToggle = () => {
                                        if (!onSelectionChange || !selectedIds) return;
                                        const newSet = new Set(selectedIds);
                                        if (newSet.has(id)) {
                                            newSet.delete(id);
                                        } else {
                                            newSet.add(id);
                                        }
                                        onSelectionChange(newSet);
                                    };

                                    // Card drag handlers
                                    const cardDragHandlers = sortable ? {
                                        draggable: true,
                                        onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
                                            e.dataTransfer.setData('text/plain', id);
                                            e.dataTransfer.effectAllowed = 'move';
                                            setDraggingRowId(id);
                                        },
                                        onDragEnd: () => {
                                            setDraggingRowId(null);
                                            setDragOverRowId(null);
                                        },
                                        onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            if (draggingRowId && draggingRowId !== id && dragOverRowId !== id) {
                                                setDragOverRowId(id);
                                            }
                                        },
                                        onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
                                            const relatedTarget = e.relatedTarget as Node | null;
                                            if (!e.currentTarget.contains(relatedTarget)) {
                                                if (dragOverRowId === id) {
                                                    setDragOverRowId(null);
                                                }
                                            }
                                        },
                                        onDrop: (e: React.DragEvent<HTMLDivElement>) => {
                                            e.preventDefault();
                                            const draggedId = e.dataTransfer.getData('text/plain');
                                            if (draggedId !== id) {
                                                const oldIndex = sortedData.findIndex(row => getRowId(row) === draggedId);
                                                const newIndex = sortedData.findIndex(row => getRowId(row) === id);
                                                if (oldIndex !== -1 && newIndex !== -1) {
                                                    const newOrder = arrayMove(sortedData.map(getRowId), oldIndex, newIndex);
                                                    setInternalRowOrder(newOrder);
                                                    if (onReorder) {
                                                        onReorder(newOrder);
                                                    }
                                                }
                                            }
                                            setDraggingRowId(null);
                                            setDragOverRowId(null);
                                        },
                                    } : {};

                                    // Custom gallery card renderer takes priority
                                    if (renderGalleryCard) {
                                        return (
                                            <div
                                                key={id}
                                                className={cn(
                                                    "relative transition-all",
                                                    sortable && "cursor-grab active:cursor-grabbing",
                                                    isDraggingThisCard && "opacity-50",
                                                    isDragOverThisCard && "ring-2 ring-blue-500 ring-offset-2 rounded-lg"
                                                )}
                                                {...cardDragHandlers}
                                            >
                                                {renderGalleryCard({
                                                    item,
                                                    isSelected,
                                                    onToggle: handleToggle,
                                                    selectable,
                                                })}
                                            </div>
                                        );
                                    }

                                    // Gallery rendering using CreativeCard with galleryConfig
                                    if (galleryConfig) {
                                        // Extract values from item using galleryConfig keys
                                        const itemAny = item as Record<string, unknown>;
                                        const mediaUrl = galleryConfig.mediaUrlKey ? itemAny[galleryConfig.mediaUrlKey] as string | null : null;
                                        const thumbnailUrl = galleryConfig.thumbnailKey ? itemAny[galleryConfig.thumbnailKey] as string | null : null;
                                        const mediaType = galleryConfig.mediaTypeKey ? itemAny[galleryConfig.mediaTypeKey] as string | null : null;
                                        const name = galleryConfig.nameKey ? itemAny[galleryConfig.nameKey] as string | null : null;
                                        const projectId = galleryConfig.projectKey ? itemAny[galleryConfig.projectKey] as string | null : null;
                                        const subprojectId = galleryConfig.subprojectKey ? itemAny[galleryConfig.subprojectKey] as string | null : null;
                                        const userId = galleryConfig.userKey ? itemAny[galleryConfig.userKey] as string | null : null;
                                        const createdAt = galleryConfig.dateKey ? itemAny[galleryConfig.dateKey] as string | null : null;
                                        const fileSize = galleryConfig.fileSizeKey ? itemAny[galleryConfig.fileSizeKey] as number | null : null;
                                        const rowNumber = galleryConfig.rowNumberKey ? itemAny[galleryConfig.rowNumberKey] as number | null : null;

                                        // Get dimensions if available (from dimensions field or storage_path)
                                        const dimensions = itemAny.dimensions as { width?: number; height?: number; thumbnail?: string } | null;
                                        const storagePath = itemAny.storage_path as string | null;

                                        // Build the file_url - use storage_path if mediaUrl is a path, not a full URL
                                        const fileUrl = mediaUrl ? (
                                            mediaUrl.startsWith('http') ? mediaUrl : getCreativeUrl(mediaUrl)
                                        ) : (storagePath ? getCreativeUrl(storagePath) : null);

                                        // Build thumbnail_url
                                        const thumbUrl = thumbnailUrl ? (
                                            thumbnailUrl.startsWith('http') ? thumbnailUrl : getCreativeUrl(thumbnailUrl)
                                        ) : (dimensions?.thumbnail ? getCreativeUrl(dimensions.thumbnail) : fileUrl);

                                        return (
                                            <div
                                                key={id}
                                                className={cn(
                                                    "relative transition-all",
                                                    sortable && "cursor-grab active:cursor-grabbing",
                                                    isDraggingThisCard && "opacity-50",
                                                    isDragOverThisCard && "ring-2 ring-blue-500 ring-offset-2 rounded-lg"
                                                )}
                                                {...cardDragHandlers}
                                            >
                                                <CreativeCard
                                                    creative={{
                                                        id,
                                                        name,
                                                        file_url: fileUrl,
                                                        thumbnail_url: thumbUrl,
                                                        type: mediaType as 'image' | 'video' | null,
                                                        dimensions: dimensions ? { width: dimensions.width, height: dimensions.height } : null,
                                                        file_size: fileSize,
                                                        project_id: projectId,
                                                        subproject_id: subprojectId,
                                                        user_id: userId,
                                                        created_at: createdAt,
                                                    }}
                                                    isSelected={isSelected}
                                                    onToggle={handleToggle}
                                                    selectable={selectable}
                                                    rowNumber={rowNumber ?? undefined}
                                                    showFileInfo={galleryConfig.showFileInfo !== false}
                                                    projectName={projectId && galleryLookups?.projects?.get(projectId)}
                                                    subprojectName={subprojectId && galleryLookups?.subprojects?.get(subprojectId)}
                                                    userName={userId && galleryLookups?.users?.get(userId)}
                                                    projectColor={projectId ? (galleryLookups?.projectColors?.[projectId] ?? undefined) : undefined}
                                                    subprojectColor={subprojectId ? (galleryLookups?.subprojectColors?.[subprojectId] ?? undefined) : undefined}
                                                />
                                            </div>
                                        );
                                    }

                                    return null;
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Card View - text-focused reading mode */}
                {viewMode === 'card' && (cardConfig || renderCard) && (
                    <div className="p-4">
                        {/* Select All Header */}
                        {selectable && (
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                                <span className="text-sm text-gray-600">
                                    {selectedIds ? selectedIds.size : 0} of {sortedData.length} selected
                                </span>
                                <button
                                    onClick={() => {
                                        if (!onSelectionChange) return;
                                        if (selectedIds && selectedIds.size === sortedData.length) {
                                            onSelectionChange(new Set());
                                        } else {
                                            onSelectionChange(new Set(sortedData.map(getRowId)));
                                        }
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    {selectedIds && selectedIds.size === sortedData.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                        )}

                        {/* Card Grid */}
                        {(isLoading || !prefsLoaded) ? (
                            <div
                                className="grid gap-4"
                                style={{
                                    gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth}px, 1fr))`
                                }}
                            >
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-48 bg-gray-100 rounded-xl skeleton-shimmer"
                                        style={{ animationDelay: `${i * 0.05}s` }}
                                    />
                                ))}
                            </div>
                        ) : sortedData.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 text-sm">
                                {emptyMessage}
                            </div>
                        ) : (() => {
                            // Build card elements - use paginatedData to respect pagination
                            const cardElements = paginatedData.map((item) => {
                                    const id = getRowId(item);
                                    const isSelected = selectedIds ? selectedIds.has(id) : false;
                                    const handleToggle = () => {
                                        if (!onSelectionChange || !selectedIds) return;
                                        const newSet = new Set(selectedIds);
                                        if (newSet.has(id)) {
                                            newSet.delete(id);
                                        } else {
                                            newSet.add(id);
                                        }
                                        onSelectionChange(newSet);
                                    };

                                    // Custom card renderer takes priority
                                    if (renderCard) {
                                        return (
                                            <div key={id} className="relative transition-all">
                                                {renderCard({ item, isSelected, onToggle: handleToggle, selectable })}
                                            </div>
                                        );
                                    }

                                    // Built-in TextCard rendering using cardConfig
                                    if (cardConfig) {
                                        const itemAny = item as Record<string, unknown>;

                                        // Extract values using cardConfig keys
                                        const bodyText = cardConfig.bodyKey ? String(itemAny[cardConfig.bodyKey] || '') : '';
                                        const titleText = cardConfig.titleKey ? String(itemAny[cardConfig.titleKey] || '') : '';
                                        const subtitleText = cardConfig.subtitleKey ? String(itemAny[cardConfig.subtitleKey] || '') : '';
                                        const rowNumber = cardConfig.rowNumberKey ? itemAny[cardConfig.rowNumberKey] as number : null;

                                        // Get metadata values - use cardVisibleMetadata for filtering which to show
                                        const metadataKeys = cardVisibleMetadata.length > 0 ? cardVisibleMetadata : (cardConfig.metadataKeys || []);
                                        const metadataItems = metadataKeys.map(key => {
                                            const col = columns.find(c => c.key === key);
                                            const rawValue = itemAny[key];

                                            // Skip if no value
                                            if (rawValue === null || rawValue === undefined || rawValue === '') {
                                                return null;
                                            }

                                            const valueStr = String(rawValue);

                                            // Resolve ID to name if lookups available
                                            let displayValue = valueStr;
                                            let colorClass: string | undefined;
                                            let avatarUrl: string | null | undefined;
                                            let isUser = false;

                                            // For ID fields, require successful lookup - don't show raw UUIDs
                                            if (key === 'project_id') {
                                                if (cardLookups?.projects) {
                                                    const resolved = cardLookups.projects.get(valueStr);
                                                    if (!resolved) return null; // Hide if lookup fails
                                                    displayValue = resolved;
                                                    colorClass = cardLookups.projectColors?.[valueStr];
                                                } else {
                                                    return null; // No lookup available, hide UUID
                                                }
                                            } else if (key === 'subproject_id') {
                                                if (cardLookups?.subprojects) {
                                                    const resolved = cardLookups.subprojects.get(valueStr);
                                                    if (!resolved) return null; // Hide if lookup fails
                                                    displayValue = resolved;
                                                    colorClass = cardLookups.subprojectColors?.[valueStr];
                                                } else {
                                                    return null; // No lookup available, hide UUID
                                                }
                                            } else if (key === 'user_id') {
                                                if (cardLookups?.users) {
                                                    const resolved = cardLookups.users.get(valueStr);
                                                    if (!resolved) return null; // Hide if lookup fails
                                                    displayValue = resolved;
                                                    avatarUrl = cardLookups.userAvatars?.get(valueStr);
                                                    isUser = true;
                                                } else {
                                                    return null; // No lookup available, hide UUID
                                                }
                                            } else if (col?.type === 'select' && col?.options) {
                                                // For select columns, look up the display label from options
                                                const options = typeof col.options === 'function' ? [] : col.options;
                                                const option = options.find(o => String(o.value) === valueStr);
                                                if (option) {
                                                    displayValue = option.label;
                                                }
                                                if (col?.colorMap) {
                                                    colorClass = col.colorMap[valueStr];
                                                }
                                            } else if (col?.colorMap) {
                                                colorClass = col.colorMap[valueStr];
                                            }

                                            return {
                                                key,
                                                header: col?.header || key,
                                                value: displayValue,
                                                colorClass,
                                                avatarUrl,
                                                isUser
                                            };
                                        }).filter((m): m is NonNullable<typeof m> => m !== null && m.value !== '');

                                        // Color scheme styling
                                        const colorSchemeClasses = {
                                            neutral: 'bg-white border-gray-200 hover:border-gray-300',
                                            warm: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 hover:border-amber-300',
                                            cool: 'bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200 hover:border-slate-300'
                                        };
                                        const colorScheme = cardConfig.colorScheme || 'warm';
                                        const cardBgClass = colorSchemeClasses[colorScheme];
                                        const borderDividerClass = colorScheme === 'warm' ? 'border-amber-200/50' : colorScheme === 'cool' ? 'border-slate-200/50' : 'border-gray-100';

                                        // Use cardLayout state for masonry style (horizontal = JS masonry, vertical = CSS columns)
                                        const isMasonry = cardLayout === 'horizontal';

                                        return (
                                            <div
                                                key={id}
                                                onClick={selectable ? handleToggle : undefined}
                                                className={cn(
                                                    "relative rounded-xl border-2 overflow-hidden transition-all",
                                                    cardBgClass,
                                                    "shadow-sm hover:shadow-md",
                                                    isSelected
                                                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                                                        : '',
                                                    selectable ? 'cursor-pointer' : 'cursor-default'
                                                )}
                                                style={isMasonry ? { breakInside: 'avoid' } : undefined}
                                            >
                                                {/* Selection checkbox */}
                                                {selectable && (
                                                    <div className="absolute top-3 left-3 z-10">
                                                        <div
                                                            className={cn(
                                                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                                                isSelected
                                                                    ? 'bg-blue-500 border-blue-500 text-white'
                                                                    : 'bg-white/80 border-gray-300'
                                                            )}
                                                        >
                                                            {isSelected && <Check className="w-3 h-3" />}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Row number badge - positioned at bottom-right to avoid text overlap */}
                                                {rowNumber !== null && (
                                                    <div className="absolute bottom-3 right-3 z-10">
                                                        <span className="text-xs text-gray-400 font-medium">#{rowNumber}</span>
                                                    </div>
                                                )}

                                                {/* Content */}
                                                <div className={cn(
                                                    "p-4",
                                                    selectable && "pt-10"
                                                )}>
                                                    {/* Title */}
                                                    {titleText && (
                                                        <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                                                            {titleText}
                                                        </h3>
                                                    )}

                                                    {/* Subtitle */}
                                                    {subtitleText && (
                                                        <p className="text-xs text-gray-500 mb-2">{subtitleText}</p>
                                                    )}

                                                    {/* Body - main text content, expands to fit */}
                                                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                                        {bodyText}
                                                    </div>

                                                    {/* Metadata footer */}
                                                    {metadataItems.length > 0 && (
                                                        <div className={cn("mt-4 pt-3 border-t flex flex-wrap items-center gap-1.5", borderDividerClass)}>
                                                            {metadataItems.map((meta) => (
                                                                meta.isUser ? (
                                                                    // User with avatar
                                                                    <div
                                                                        key={meta.key}
                                                                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600"
                                                                    >
                                                                        {meta.avatarUrl ? (
                                                                            <img
                                                                                src={meta.avatarUrl}
                                                                                alt=""
                                                                                className="w-4 h-4 rounded-full object-cover"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[8px] font-medium">
                                                                                {meta.value.charAt(0).toUpperCase()}
                                                                            </div>
                                                                        )}
                                                                        <span className="text-[10px] font-medium pr-0.5">{meta.value}</span>
                                                                    </div>
                                                                ) : (
                                                                    // Regular tag
                                                                    <span
                                                                        key={meta.key}
                                                                        className={cn(
                                                                            "px-2 py-0.5 rounded-full text-[10px] font-medium",
                                                                            meta.colorClass || "bg-gray-100 text-gray-600"
                                                                        )}
                                                                    >
                                                                        {meta.value}
                                                                    </span>
                                                                )
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return null;
                            });

                            // Wrap in appropriate container based on layout setting
                            // horizontal = JS masonry (horizontal reading order), vertical = CSS columns
                            if (cardLayout === 'horizontal') {
                                return (
                                    <MasonryGrid minWidth={cardMinWidth} gap={16}>
                                        {cardElements}
                                    </MasonryGrid>
                                );
                            }

                            // Vertical layout: CSS columns (flows top-to-bottom in each column)
                            return (
                                <div
                                    style={{
                                        columnWidth: `${cardMinWidth}px`,
                                        columnGap: '16px',
                                    }}
                                >
                                    {cardElements.map((el, idx) => (
                                        <div key={idx} style={{ breakInside: 'avoid', marginBottom: '16px' }}>
                                            {el}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Column Context Menu */}
            {
                contextMenu && (
                    <ColumnContextMenu
                        columnKey={contextMenu.columnKey}
                        columnHeader={contextMenu.columnHeader}
                        columnType={contextMenu.columnType}
                        columnEditable={contextMenu.columnEditable}
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
                        onEditField={onColumnConfigChange ? () => {
                            const col = columns.find(c => c.key === contextMenu.columnKey);
                            // Use options if it's an array, otherwise fall back to filterOptions
                            const isOptionsArray = Array.isArray(col?.options);
                            const optionsArray = isOptionsArray
                                ? col.options
                                : col?.filterOptions;
                            // colorOnly when optionsEditable is explicitly false, or when using filterOptions (options is a function)
                            const colorOnly = col?.optionsEditable === false || !isOptionsArray;
                            if (col && col.type === 'select' && Array.isArray(optionsArray)) {
                                setFieldEditor({
                                    columnKey: contextMenu.columnKey,
                                    columnHeader: contextMenu.columnHeader,
                                    options: optionsArray as { label: string; value: string | number }[],
                                    colorMap: col.colorMap || {},
                                    colorOnly
                                });
                            }
                        } : undefined}
                        onClose={() => setContextMenu(null)}
                        isGroupedBy={groupRules.some(r => r.key === contextMenu.columnKey)}
                        sortRules={sortRules}
                        currentThumbnailSize={contextMenu.columnType === 'media' ? getThumbnailSize(contextMenu.columnKey, columns.find(c => c.key === contextMenu.columnKey)?.thumbnailSize) : undefined}
                        onThumbnailSizeChange={contextMenu.columnType === 'media' ? (size) => handleThumbnailSizeChange(contextMenu.columnKey, size) : undefined}
                    />
                )
            }

            {/* Field Editor Modal */}
            {fieldEditor && onColumnConfigChange && (
                <FieldEditor
                    columnKey={fieldEditor.columnKey}
                    columnHeader={fieldEditor.columnHeader}
                    options={fieldEditor.options}
                    colorMap={fieldEditor.colorMap}
                    colorOnly={fieldEditor.colorOnly}
                    onSave={(updates) => {
                        onColumnConfigChange(fieldEditor.columnKey, updates);
                    }}
                    onClose={() => setFieldEditor(null)}
                />
            )}

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

            {/* Ad Copy Picker Modal */}
            {adCopyModalState && (
                <AdCopyPickerModal
                    isOpen={adCopyModalState.isOpen}
                    onClose={() => setAdCopyModalState(null)}
                    onSelect={async (adCopyId) => {
                        if (onUpdate && adCopyModalState) {
                            await onUpdate(adCopyModalState.rowId, adCopyModalState.columnKey, adCopyId);
                        }
                        setAdCopyModalState(null);
                    }}
                    adCopies={adCopies || []}
                    currentValue={adCopyModalState.currentValue}
                    title={`Select ${adCopyModalState.adCopyType.replace('_', ' ')}`}
                    type={adCopyModalState.adCopyType}
                />
            )}


            {/* Media Preview Modal */}
            {mediaPreviewState && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
                    onClick={() => setMediaPreviewState(null)}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setMediaPreviewState(null)}
                        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-8 h-8" />
                    </button>

                    {/* Title */}
                    {mediaPreviewState.title && (
                        <div className="absolute top-4 left-4 text-white font-medium">
                            {mediaPreviewState.title}
                        </div>
                    )}

                    {/* Media */}
                    <div
                        className="max-w-[90vw] max-h-[85vh] relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {mediaPreviewState.isVideo ? (
                            <video
                                src={mediaPreviewState.url}
                                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
                                controls
                                autoPlay
                            />
                        ) : (
                            <img
                                src={mediaPreviewState.url}
                                alt=""
                                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
                            />
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Read-only Text Viewer Popup */}
            {viewingCell && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[9998]"
                        onClick={handleViewClose}
                    />
                    {/* Popup - read-only viewer (matches edit popup style) */}
                    {(() => {
                        const spaceBelow = window.innerHeight - viewingPosition.top - 50;
                        const spaceAbove = viewingPosition.top - 50;
                        const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
                        const maxH = Math.min(showAbove ? spaceAbove : spaceBelow, 400);

                        // Estimate wrapped lines based on character count and column width
                        const charPerLine = Math.floor(viewingPosition.width / 8); // ~8px per char at 13px font
                        const estimatedWrappedLines = Math.ceil((viewingCell.value?.length || 0) / charPerLine);
                        const explicitLineCount = (viewingCell.value?.split('\n').length || 1);
                        const lineCount = Math.max(explicitLineCount, estimatedWrappedLines);

                        const lineHeight = 20;
                        const verticalPadding = 14; // 7px top + 7px bottom padding
                        const cellHeight = 34;
                        const contentHeight = Math.min(Math.max(cellHeight, lineCount * lineHeight + verticalPadding), maxH);

                        return (
                            <div
                                className="fixed z-[9999] bg-white shadow-xl border border-gray-300 rounded text-[13px] text-gray-900 whitespace-pre-wrap overflow-y-auto resize overflow-auto"
                                style={{
                                    top: showAbove ? viewingPosition.top - contentHeight : viewingPosition.top,
                                    left: Math.max(8, Math.min(viewingPosition.left, window.innerWidth - viewingPosition.width - 8)),
                                    width: viewingPosition.width,
                                    maxHeight: maxH,
                                    padding: '8px',
                                    lineHeight: '20px',
                                    boxSizing: 'border-box',
                                }}
                            >
                                {viewingCell.type === 'url' ? (
                                    <a
                                        href={viewingCell.value}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {viewingCell.value || '-'}
                                    </a>
                                ) : viewingCell.type === 'richtext' ? (
                                    <div
                                        className="prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: viewingCell.value || '-' }}
                                    />
                                ) : viewingCell.type === 'blockeditor' ? (
                                    <BlockEditorDisplay
                                        content={viewingCell.value || '-'}
                                        className="prose prose-sm max-w-none"
                                    />
                                ) : viewingCell.type === 'notioneditor' ? (
                                    <NotionEditorCellDisplay
                                        content={viewingCell.value}
                                    />
                                ) : (
                                    viewingCell.value || '-'
                                )}
                            </div>
                        );
                    })()}
                </>,
                document.body
            )}

            {/* Fullscreen Rich Text Editor Modal */}
            {fullscreenEdit && createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setFullscreenEdit(null)}
                >
                    {fullscreenEdit.type === 'blockeditor' ? (
                        // BlockEditor with custom header (needs Save/Cancel)
                        <div
                            className="bg-white dark:bg-[#0e0e11] rounded-xl shadow-2xl w-[90vw] h-[90vh] max-w-4xl flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Content</h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                        onClick={() => setFullscreenEdit(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        onClick={async () => {
                                            if (onUpdate && fullscreenEdit) {
                                                try {
                                                    await onUpdate(fullscreenEdit.id, fullscreenEdit.field, fullscreenEdit.value);
                                                } catch (error) {
                                                    console.error('Failed to save:', error);
                                                }
                                            }
                                            setFullscreenEdit(null);
                                        }}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-6">
                                <BlockEditor
                                    content={fullscreenEdit.value}
                                    onChange={(html) => setFullscreenEdit(prev => prev ? { ...prev, value: html } : null)}
                                    placeholder="Start typing..."
                                    minHeight="100%"
                                    className="h-full"
                                    autoFocus
                                />
                            </div>
                        </div>
                    ) : (
                        // NotionEditor - letter-format layout with Tiptap toolbar
                        <div
                            className="relative bg-white dark:bg-[#0e0e11] rounded-xl shadow-2xl h-[90vh] max-w-3xl w-full overflow-hidden pl-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* NotionEditor with toolbar - click outside to close, pl-8 for block controls */}
                            <NotionEditorCell
                                roomId={`${viewId || 'default'}-${fullscreenEdit.id}-${fullscreenEdit.field}`}
                                roomPrefix="admachin"
                                placeholder="Type '/' for commands..."
                                className="h-full"
                                initialContent={fullscreenEdit.value}
                                onSave={async (html) => {
                                    if (onUpdate && fullscreenEdit) {
                                        try {
                                            await onUpdate(fullscreenEdit.id, fullscreenEdit.field, html);
                                        } catch (error) {
                                            console.error('Failed to save notion content:', error);
                                        }
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div >
    );
}

export default DataTable;
