import type { ReactNode } from 'react';

// ============ People Types ============

export interface PeopleOption {
    id: string;
    first_name: string;
    last_name?: string;
    name?: string;
    email: string;
    avatar_url?: string | null;
}

// ============ Sort & Filter Types ============

export interface SortRule {
    id: string;
    key: string;
    direction: 'asc' | 'desc';
}

export interface FilterRule {
    id: string;
    field: string;
    operator: string;
    value: string;
    conjunction: 'and' | 'or';
}

export interface WrapRule {
    columnKey: string;
    lines: '1' | '2' | '3' | 'full';
}

// StoredWrapRule for persistence (doesn't include '2')
export interface StoredWrapRule {
    columnKey: string;
    lines: '1' | '3' | 'full';
}

export interface GroupRule {
    id: string;
    key: string;
    direction: 'asc' | 'desc';
}

// ============ Column Definition ============

/** Thumbnail size options for media column type */
export type ThumbnailSize = 'small' | 'medium' | 'large' | 'xl';

/** Thumbnail size rule for media columns - stored per column */
export interface ThumbnailSizeRule {
    columnKey: string;
    size: ThumbnailSize;
}

/** Size configuration for thumbnails */
export const THUMBNAIL_SIZES: Record<ThumbnailSize, { width: number; height: number; className: string }> = {
    small: { width: 40, height: 40, className: 'h-10 w-10' },
    medium: { width: 64, height: 64, className: 'h-16 w-16' },
    large: { width: 96, height: 96, className: 'h-24 w-24' },
    xl: { width: 128, height: 128, className: 'h-32 w-32' },
};

export interface ColumnDef<T> {
    key: string;
    header: string;
    width?: number;
    minWidth?: number;
    editable?: boolean;
    viewable?: boolean; // For text/longtext types - allows clicking to view full text in a read-only popup (default: true when not editable)
    type?: 'text' | 'longtext' | 'select' | 'date' | 'url' | 'priority' | 'id' | 'people' | 'thumbnail' | 'filesize' | 'adcopy' | 'media' | 'custom';
    options?: { label: string; value: string | number }[] | ((row: T) => { label: string; value: string | number }[]);
    filterOptions?: { label: string; value: string | number }[]; // Static options for filter dropdown (use when options is a function)
    optionsEditable?: boolean; // For select type - whether options can be added/removed in field editor (default: true)
    colorMap?: Record<string, string>;
    render?: (value: unknown, row: T, isEditing: boolean, expandText?: boolean) => ReactNode;
    getValue?: (row: T) => unknown;
    fallbackKey?: string; // For legacy data - show this field's value if current value not found in options
    maxPriority?: number; // For priority type - max value (default: 5)
    urlMaxLength?: number; // For url type - max characters to show (default: 25)
    users?: PeopleOption[]; // For people type - list of users to select from
    adCopyType?: 'headline' | 'primary_text' | 'description'; // For adcopy type - which type of ad copy
    // Media column type options
    thumbnailSize?: ThumbnailSize; // For media type - size of thumbnail (default: 'small')
    mediaTypeKey?: string; // For media type - key to get media type ('image' or 'video') from row
    mediaPlaybackKey?: string; // For media type - key to get the actual video/image URL for playback (if different from thumbnail)
    // Column dependency - when this column's value is set, auto-set the parent column value
    // Used for subproject -> project relationships where selecting a subproject should auto-select its project
    dependsOn?: {
        parentKey: string; // The column key this depends on (e.g., 'project_id')
        getParentValue: (value: string | number) => string | number | null; // Function to resolve parent value from this column's value
    };
}

// ============ View Preferences ============

export interface ViewPreferences {
    sort_config?: SortRule[];
    filter_config?: FilterRule[];
    group_config?: GroupRule[];
    wrap_config?: StoredWrapRule[];  // Uses StoredWrapRule for persistence compatibility
    thumbnail_size_config?: ThumbnailSizeRule[];  // Per-column thumbnail sizes for media columns
    row_order?: string[];
    column_widths?: Record<string, number>;
    column_order?: string[];
}

// ============ Gallery Configuration ============

export interface GalleryConfig {
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
}

export interface GalleryLookups {
    projects?: Map<string, string>;
    subprojects?: Map<string, string>;
    users?: Map<string, string>;
    projectColors?: Record<string, string>;
    subprojectColors?: Record<string, string>;
}

// ============ Ad Copy Type ============

export interface AdCopyItem {
    id: string;
    text: string | null;
    name?: string | null;
    type: string;
    row_number?: number;
}

// ============ DataTable Props ============

export interface DataTableProps<T> {
    columns: ColumnDef<T>[];
    data: T[];
    isLoading?: boolean;
    emptyMessage?: string;

    // Tabs - render tab bar above toolbar
    tabs?: TabConfig[];
    activeTab?: string;
    onTabChange?: (tabId: string) => void;

    // Toolbar header (2-row toolbar)
    title?: string;
    onNewClick?: () => void;
    newButtonLabel?: string;
    headerActions?: ReactNode;

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
    wrapRules?: WrapRule[];
    onWrapRulesChange?: (rules: WrapRule[]) => void;

    // Thumbnail sizes - per-column thumbnail sizes for media columns
    thumbnailSizeRules?: ThumbnailSizeRule[];
    onThumbnailSizeRulesChange?: (rules: ThumbnailSizeRule[]) => void;

    // Fullscreen spreadsheet mode - fills viewport with grid lines
    fullscreen?: boolean;

    // Layout mode:
    // - 'fullPage': Fills entire viewport, for main pages
    // - 'inline': Normal document flow with optional maxHeight, for embedded tables
    // - 'contained': Fills parent container (modal, panel, sidebar), parent must have defined height
    layout?: 'fullPage' | 'inline' | 'contained';

    // Max height for inline layout (e.g., '400px', '50vh')
    maxHeight?: string;

    // Quick filters - array of column keys to show as quick filter dropdowns at far left of toolbar
    quickFilters?: string[];

    // Grouping
    groupRules?: GroupRule[];
    onGroupRulesChange?: (rules: GroupRule[]) => void;

    // Column order (for drag-to-reorder columns)
    columnOrder?: string[];
    onColumnOrderChange?: (order: string[]) => void;

    // Column widths persistence
    savedColumnWidths?: Record<string, number>;
    onColumnWidthsChange?: (widths: Record<string, number>) => void;

    // View persistence (per-user and shared settings)
    viewId?: string;
    userId?: string;
    initialPreferences?: ViewPreferences;
    sharedPreferences?: ViewPreferences;
    onPreferencesChange?: (preferences: ViewPreferences) => void;
    onSaveForEveryone?: (preferences: ViewPreferences) => void;
    onResetPreferences?: () => void;

    // Column configuration editing (for select options, colors, etc.)
    onColumnConfigChange?: (columnKey: string, updates: { options?: { label: string; value: string | number }[]; colorMap?: Record<string, string> }) => void;

    // Multi-select mode with checkboxes
    selectable?: boolean;
    selectedIds?: Set<string>;
    onSelectionChange?: (selectedIds: Set<string>) => void;

    // Single-select mode (click row to select, only one at a time)
    // When enabled, clicking a row selects it (highlighted), clicking again deselects
    singleSelect?: boolean;
    selectedRowId?: string | null;
    onRowSelect?: (id: string | null) => void;

    // View mode (table or gallery/card view)
    viewMode?: 'table' | 'gallery';
    onViewModeChange?: (mode: 'table' | 'gallery') => void;
    cardColumns?: number;

    // Gallery configuration - maps data columns to gallery card fields
    // If provided, DataTable will use built-in CreativeCard for gallery view
    galleryConfig?: GalleryConfig;
    /** Lookup maps for resolving IDs to names in gallery view */
    galleryLookups?: GalleryLookups;
    /** Ad copies for adcopy column type */
    adCopies?: AdCopyItem[];
    /** Custom gallery card renderer - overrides default CreativeCard rendering */
    renderGalleryCard?: (props: {
        item: T;
        isSelected: boolean;
        onToggle: () => void;
        selectable: boolean;
    }) => ReactNode;
}

// ============ Internal Component Props ============

export interface DropdownMenuProps {
    options: { label: string; value: string }[];
    value: string;
    onSelect: (value: string) => void;
    onClear?: () => void;
    position: { top: number; left: number };
    colorMap?: Record<string, string>;
}

export interface PeopleDropdownMenuProps {
    users: PeopleOption[];
    value: string;
    onSelect: (value: string) => void;
    onClear?: () => void;
    position: { top: number; left: number };
}

export interface ColumnContextMenuProps {
    column: ColumnDef<unknown>;
    position: { x: number; y: number };
    onClose: () => void;
    onSort: (direction: 'asc' | 'desc') => void;
    onGroup: () => void;
    onFilter: (operator: string, value: string) => void;
    onEditField?: () => void;
    canEditField?: boolean;
}

export interface FieldEditorProps {
    column: ColumnDef<unknown>;
    onClose: () => void;
    onSave: (updates: { options?: { label: string; value: string | number }[]; colorMap?: Record<string, string> }) => void;
    colorOnly?: boolean;
}

export interface GroupHeaderProps {
    groupValue: string;
    count: number;
    isCollapsed: boolean;
    onToggle: () => void;
    colSpan: number;
    colorClass?: string;
    level?: number;
}

export interface QuickFilterProps {
    columnKey: string;
    header: string;
    options: { label: string; value: string | number }[];
    colorMap?: Record<string, string>;
    value: string | null;
    onSelect: (value: string) => void;
    onClear: () => void;
}

// ============ Tab Configuration ============

export interface TabConfig {
    id: string;
    label: string;
    count?: number;
}

// ============ Preset Colors ============

export const PRESET_COLORS = [
    { name: 'Gray', value: 'bg-gray-100 text-gray-700' },
    { name: 'Red', value: 'bg-red-100 text-red-700' },
    { name: 'Orange', value: 'bg-orange-100 text-orange-700' },
    { name: 'Amber', value: 'bg-amber-100 text-amber-700' },
    { name: 'Yellow', value: 'bg-yellow-100 text-yellow-700' },
    { name: 'Lime', value: 'bg-lime-100 text-lime-700' },
    { name: 'Green', value: 'bg-green-100 text-green-700' },
    { name: 'Emerald', value: 'bg-emerald-100 text-emerald-700' },
    { name: 'Teal', value: 'bg-teal-100 text-teal-700' },
    { name: 'Cyan', value: 'bg-cyan-100 text-cyan-700' },
    { name: 'Sky', value: 'bg-sky-100 text-sky-700' },
    { name: 'Blue', value: 'bg-blue-100 text-blue-700' },
    { name: 'Indigo', value: 'bg-indigo-100 text-indigo-700' },
    { name: 'Violet', value: 'bg-violet-100 text-violet-700' },
    { name: 'Purple', value: 'bg-purple-100 text-purple-700' },
    { name: 'Fuchsia', value: 'bg-fuchsia-100 text-fuchsia-700' },
    { name: 'Pink', value: 'bg-pink-100 text-pink-700' },
    { name: 'Rose', value: 'bg-rose-100 text-rose-700' },
];
