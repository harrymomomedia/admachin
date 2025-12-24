/**
 * DataTable Default Configuration
 *
 * Centralized configuration for all DataTable instances to ensure consistency
 * across the application. Includes:
 * - Color palettes and maps
 * - Column width defaults
 * - Preference persistence handlers
 * - Common column configurations
 */

import type { Dispatch, SetStateAction } from 'react';
import type { Project, Subproject, User, CampaignParameter } from './supabase-service';
import type { ColumnDef, ViewPreferences } from '../components/datatable/types';

// ============ Color Palette ============

/**
 * Standard 10-color palette for dynamic color assignment.
 * Used for projects, subprojects, and any list that needs distinct colors.
 */
export const COLOR_PALETTE = [
    'bg-pink-500 text-white',
    'bg-indigo-500 text-white',
    'bg-cyan-500 text-white',
    'bg-amber-500 text-white',
    'bg-rose-500 text-white',
    'bg-violet-500 text-white',
    'bg-teal-500 text-white',
    'bg-orange-500 text-white',
    'bg-lime-500 text-white',
    'bg-fuchsia-500 text-white',
] as const;

/**
 * Generate a color map from an array of items with IDs
 */
export function generateColorMap<T extends { id: string }>(items: T[]): Record<string, string> {
    return items.reduce((map, item, index) => {
        map[item.id] = COLOR_PALETTE[index % COLOR_PALETTE.length];
        return map;
    }, {} as Record<string, string>);
}

// ============ Predefined Color Maps ============

/** Color map for ad copy types */
export const AD_COPY_TYPE_COLORS: Record<string, string> = {
    'primary_text': 'bg-blue-500 text-white',
    'headline': 'bg-purple-500 text-white',
    'description': 'bg-gray-500 text-white',
    'video_ad_script': 'bg-emerald-500 text-white',
};

/** Color map for traffic/platform types */
export const TRAFFIC_PLATFORM_COLORS: Record<string, string> = {
    'FB': 'bg-teal-500 text-white',
    'IG': 'bg-rose-500 text-white',
    'All': 'bg-indigo-500 text-white',
};

/** Color map for status types */
export const STATUS_COLORS: Record<string, string> = {
    'active': 'bg-green-500 text-white',
    'paused': 'bg-yellow-500 text-white',
    'draft': 'bg-gray-500 text-white',
    'archived': 'bg-red-500 text-white',
};

// ============ Column Width Defaults ============

/** Default column widths by type */
export const COLUMN_WIDTH_DEFAULTS = {
    id: { width: 50, minWidth: 40 },
    select: { width: 100, minWidth: 60 },
    project: { width: 100, minWidth: 70 },
    subproject: { width: 120, minWidth: 70 },
    people: { width: 130, minWidth: 100 },
    date: { width: 120, minWidth: 100 },
    longtext: { width: 250, minWidth: 150 },
    textarea: { width: 300, minWidth: 180 },
    url: { width: 200, minWidth: 150 },
    thumbnail: { width: 80, minWidth: 70 },
    media: { width: 80, minWidth: 70 },
    text: { width: 150, minWidth: 100 },
    name: { width: 150, minWidth: 100 },
} as const;

// ============ Column Builders ============

interface ProjectSubprojectColumnOptions {
    projects: Project[];
    subprojects: Subproject[];
    projectColorMap?: Record<string, string>;
    subprojectColorMap?: Record<string, string>;
    editable?: boolean;
}

/**
 * Create standard project column configuration
 * Matches AdCopyLibrary implementation - the reference for all DataTables
 */
export function createProjectColumn<T extends { project_id?: string | null }>(
    options: ProjectSubprojectColumnOptions
): ColumnDef<T> {
    const { projects, projectColorMap, editable = true } = options;
    return {
        key: 'project_id',
        header: 'Project',
        type: 'select',
        editable,
        ...COLUMN_WIDTH_DEFAULTS.project,
        options: projects.map(p => ({ label: p.name, value: p.id })),
        optionsEditable: false, // Options managed by projects table
        fallbackKey: 'project', // Legacy field for old data
        colorMap: projectColorMap || generateColorMap(projects),
    };
}

/**
 * Create standard subproject column configuration with project dependency
 * Matches AdCopyLibrary implementation - the reference for all DataTables
 */
export function createSubprojectColumn<T extends { project_id?: string | null; subproject_id?: string | null }>(
    options: ProjectSubprojectColumnOptions
): ColumnDef<T> {
    const { subprojects, subprojectColorMap, editable = true } = options;
    return {
        key: 'subproject_id',
        header: 'Subproject',
        type: 'select',
        editable,
        ...COLUMN_WIDTH_DEFAULTS.subproject,
        options: (row: T) => {
            // Show all subprojects if no project selected, otherwise filter by project
            const projectId = row.project_id;
            if (!projectId) {
                return subprojects.map(s => ({ label: s.name, value: s.id }));
            }
            return subprojects
                .filter(s => s.project_id === projectId)
                .map(s => ({ label: s.name, value: s.id }));
        },
        filterOptions: subprojects.map(s => ({ label: s.name, value: s.id })),
        fallbackKey: 'subproject', // Legacy field for old data
        colorMap: subprojectColorMap || generateColorMap(subprojects),
        dependsOn: {
            parentKey: 'project_id',
            getParentValue: (subprojectId: string | number) => {
                const sub = subprojects.find(s => s.id === subprojectId);
                return sub?.project_id || null;
            },
        },
    };
}

/**
 * Create standard people/user column configuration
 */
export function createUserColumn<T>(
    users: User[],
    options: {
        key?: string;
        header?: string;
        editable?: boolean;
    } = {}
): ColumnDef<T> {
    const { key = 'user_id', header = 'Created By', editable = true } = options;
    return {
        key,
        header,
        type: 'people',
        editable,
        ...COLUMN_WIDTH_DEFAULTS.people,
        users: users.map(u => ({
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            name: `${u.first_name} ${u.last_name}`.trim() || u.email,
            email: u.email,
            avatar_url: u.avatar_url,
        })),
    };
}

/**
 * Create standard date column configuration
 */
export function createDateColumn<T>(
    options: {
        key?: string;
        header?: string;
        editable?: boolean;
    } = {}
): ColumnDef<T> {
    const { key = 'created_at', header = 'Created', editable = false } = options;
    return {
        key,
        header,
        type: 'date',
        editable,
        ...COLUMN_WIDTH_DEFAULTS.date,
    };
}

/**
 * Create standard ID column configuration
 */
export function createIdColumn<T>(
    options: {
        key?: string;
        header?: string;
    } = {}
): ColumnDef<T> {
    const { key = 'row_number', header = 'ID' } = options;
    return {
        key,
        header,
        type: 'id',
        editable: false,
        ...COLUMN_WIDTH_DEFAULTS.id,
    };
}

// ============ Row Order Application ============

/**
 * Apply saved row order to data array
 */
export function applyRowOrder<T extends { id: string }>(
    data: T[],
    rowOrder: string[] | undefined
): T[] {
    if (!rowOrder || rowOrder.length === 0) {
        return data;
    }

    const orderMap = new Map(rowOrder.map((id, index) => [id, index]));
    return [...data].sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? Infinity;
        const bIndex = orderMap.get(b.id) ?? Infinity;
        return aIndex - bIndex;
    });
}

// ============ Gallery Configuration Builders ============

interface GalleryConfigOptions {
    mediaUrlKey: string;
    thumbnailKey?: string;
    mediaTypeKey?: string;
    projectKey?: string;
    subprojectKey?: string;
    userKey?: string;
    dateKey?: string;
    fileSizeKey?: string;
    rowNumberKey?: string;
    showFileInfo?: boolean;
}

/**
 * Create gallery configuration with sensible defaults
 */
export function createGalleryConfig(options: GalleryConfigOptions) {
    return {
        mediaUrlKey: options.mediaUrlKey,
        thumbnailKey: options.thumbnailKey || options.mediaUrlKey,
        mediaTypeKey: options.mediaTypeKey,
        projectKey: options.projectKey || 'project_id',
        subprojectKey: options.subprojectKey || 'subproject_id',
        userKey: options.userKey || 'user_id',
        dateKey: options.dateKey || 'created_at',
        fileSizeKey: options.fileSizeKey,
        rowNumberKey: options.rowNumberKey || 'row_number',
        showFileInfo: options.showFileInfo ?? true,
    };
}

/**
 * Create gallery lookups from standard data
 */
export function createGalleryLookups(
    projects: Project[],
    subprojects: Subproject[],
    users: User[],
    projectColorMap?: Record<string, string>,
    subprojectColorMap?: Record<string, string>
) {
    return {
        projects: new Map(projects.map(p => [p.id, p.name])),
        subprojects: new Map(subprojects.map(s => [s.id, s.name])),
        users: new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim() || u.email])),
        projectColors: projectColorMap || generateColorMap(projects),
        subprojectColors: subprojectColorMap || generateColorMap(subprojects),
    };
}

// ============ Campaign Parameter Columns ============

/**
 * Options for creating campaign parameter columns
 */
export interface CampaignParamColumnsOptions {
    projects: Project[];
    subprojects: Subproject[];
    users: User[];
    projectColorMap?: Record<string, string>;
    subprojectColorMap?: Record<string, string>;
    /** Auto-fill button column - renders after Nickname */
    autoFillColumn?: ColumnDef<CampaignParameter>;
    /** Whether to include the ID column */
    includeId?: boolean;
}

/**
 * Create standard columns for Campaign Parameters tables
 * Shared between CampaignParams.tsx and CopyWizard.tsx
 */
export function createCampaignParamColumns(
    options: CampaignParamColumnsOptions
): ColumnDef<CampaignParameter>[] {
    const {
        projects,
        subprojects,
        users,
        projectColorMap,
        subprojectColorMap,
        autoFillColumn,
        includeId = true,
    } = options;

    const columns: ColumnDef<CampaignParameter>[] = [];

    // ID column (optional)
    if (includeId) {
        columns.push(createIdColumn<CampaignParameter>());
    }

    // Nickname column
    columns.push({ key: 'name', header: 'Nickname', editable: true, width: 150, minWidth: 100 });

    // Auto-fill button column (optional, inserted after nickname)
    if (autoFillColumn) {
        columns.push(autoFillColumn);
    }

    // Project/Subproject columns
    columns.push(
        createProjectColumn<CampaignParameter>({ projects, subprojects, projectColorMap }),
        createSubprojectColumn<CampaignParameter>({ projects, subprojects, subprojectColorMap }),
    );

    // Description column
    columns.push({
        key: 'description',
        header: 'Description',
        editable: true,
        type: 'longtext',
        width: 250,
        minWidth: 150,
    });

    // New marketing context columns
    columns.push(
        { key: 'key_qualifying_criteria', header: 'Key Qualifying Criteria', editable: true, type: 'longtext', width: 200, minWidth: 150 },
        { key: 'offer_flow', header: 'Offer Flow', editable: true, type: 'longtext', width: 200, minWidth: 150 },
        { key: 'proof_points', header: 'Proof Points', editable: true, type: 'longtext', width: 200, minWidth: 150 },
        { key: 'primary_objections', header: 'Primary Objections', editable: true, type: 'longtext', width: 200, minWidth: 150 },
    );

    // AI/prompt columns
    columns.push(
        { key: 'persona_input', header: 'Persona Input', editable: true, type: 'longtext', width: 150, minWidth: 100 },
        { key: 'swipe_files', header: 'Swipe File/Winner Ad', editable: true, type: 'longtext', width: 150, minWidth: 100 },
        { key: 'custom_prompt', header: 'Custom Prompt', editable: true, type: 'longtext', width: 150, minWidth: 100 },
    );

    // Meta columns
    columns.push(
        createUserColumn<CampaignParameter>(users, { key: 'created_by', editable: false }),
        createDateColumn<CampaignParameter>(),
    );

    return columns;
}

// ============ Default DataTable Props ============

/**
 * Standard DataTable props that should be used by default
 */
/**
 * Props for full-page DataTables (main content of a page)
 * Use with DataTablePageLayout wrapper
 */
export const DEFAULT_DATATABLE_PROPS = {
    sortable: true,
    resizable: true,
    fullscreen: true,
    layout: 'fullPage' as const,
    showRowActions: true,
} as const;

/**
 * Props for inline/embedded DataTables (inside accordions, cards, etc.)
 * Does NOT include fullscreen or fullPage layout
 */
export const INLINE_DATATABLE_PROPS = {
    sortable: true,
    resizable: true,
    showRowActions: true,
} as const;

/**
 * Common quick filter keys for most tables
 */
export const DEFAULT_QUICK_FILTERS = ['project_id', 'subproject_id'] as const;

// ============ Row Creation Factory ============

/**
 * Configuration for creating a row handler
 */
export interface CreateRowHandlerConfig<T> {
    /** The create function from supabase-service */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createFn: (data: any) => Promise<T>;
    /** State setter to update local data */
    setData: Dispatch<SetStateAction<T[]>>;
    /** Current user ID (for created_by/user_id/owner_id fields) */
    currentUserId?: string | null;
    /** Field name for user ID (defaults to 'created_by') */
    userIdField?: 'created_by' | 'user_id' | 'owner_id';
    /** Additional default values to include */
    defaults?: Record<string, unknown>;
}

/**
 * Create a standardized handleCreateRow function for DataTable
 *
 * This factory creates a consistent row creation handler that:
 * - Accepts defaults from active filters (project_id, subproject_id)
 * - Sets the current user as owner/creator
 * - Adds the new row to the top of the list
 * - Returns the new row for DataTable
 *
 * @example
 * ```tsx
 * const handleCreateRow = createRowHandler({
 *     createFn: createAdPlan,
 *     setData: setPlans,
 *     currentUserId,
 *     userIdField: 'user_id',
 * });
 *
 * <DataTable onCreateRow={handleCreateRow} ... />
 * ```
 */
export function createRowHandler<T>(
    config: CreateRowHandlerConfig<T>
): (defaults?: Record<string, unknown>) => Promise<T> {
    const {
        createFn,
        setData,
        currentUserId,
        userIdField = 'created_by',
        defaults: additionalDefaults = {},
    } = config;

    return async (filterDefaults?: Record<string, unknown>): Promise<T> => {
        // Build the create payload
        const payload: Record<string, unknown> = {
            // From active filters
            project_id: (filterDefaults?.project_id as string) || null,
            subproject_id: (filterDefaults?.subproject_id as string) || null,
            // Current user
            [userIdField]: currentUserId || null,
            // Additional defaults
            ...additionalDefaults,
        };

        // Create the row
        const newRow = await createFn(payload);

        // Add to top of list
        setData(prev => [newRow, ...prev]);

        return newRow;
    };
}

// ============ Row Delete Factory ============

/**
 * Configuration for creating a delete handler
 */
export interface DeleteHandlerConfig<T extends { id: string }> {
    /** The delete function from supabase-service */
    deleteFn: (id: string) => Promise<void>;
    /** State setter to update local data */
    setData: Dispatch<SetStateAction<T[]>>;
    /** Confirmation message (set to false to skip confirmation) */
    confirmMessage?: string | false;
}

/**
 * Create a standardized handleDelete function for DataTable
 *
 * @example
 * ```tsx
 * const handleDelete = useMemo(() => createDeleteHandler({
 *     deleteFn: deleteAdCopy,
 *     setData,
 * }), []);
 *
 * <DataTable onDelete={handleDelete} ... />
 * ```
 */
export function createDeleteHandler<T extends { id: string }>(
    config: DeleteHandlerConfig<T>
): (id: string) => Promise<void> {
    const {
        deleteFn,
        setData,
        confirmMessage = 'Are you sure you want to delete this item?',
    } = config;

    return async (id: string): Promise<void> => {
        // Confirmation dialog (skip if confirmMessage is false)
        if (confirmMessage !== false && !confirm(confirmMessage)) {
            return;
        }

        try {
            await deleteFn(id);
            setData(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error('Failed to delete:', error);
            throw error;
        }
    };
}

// ============ Row Reorder Factory ============

/**
 * Configuration for creating a reorder handler
 */
export interface ReorderHandlerConfig<T extends { id: string }> {
    /** State setter to update local data */
    setData: Dispatch<SetStateAction<T[]>>;
    /** Current user ID for saving preferences */
    currentUserId: string | null;
    /** View ID for saving row order */
    viewId: string;
}

/**
 * Create a standardized handleReorder function for DataTable
 *
 * @example
 * ```tsx
 * const handleReorder = useMemo(() => createReorderHandler({
 *     setData,
 *     currentUserId,
 *     viewId: 'ad_copies',
 * }), [currentUserId]);
 *
 * <DataTable onReorder={handleReorder} ... />
 * ```
 */
export function createReorderHandler<T extends { id: string }>(
    config: ReorderHandlerConfig<T>
): (newOrder: string[]) => Promise<void> {
    const { setData, currentUserId, viewId } = config;

    // Import saveRowOrder dynamically to avoid circular dependency
    return async (newOrder: string[]): Promise<void> => {
        // Reorder local state
        setData(prev => {
            const itemMap = new Map(prev.map(item => [item.id, item]));
            return newOrder
                .map(id => itemMap.get(id))
                .filter((item): item is T => item !== undefined);
        });

        // Save order to database
        if (currentUserId) {
            try {
                const { saveRowOrder } = await import('./supabase-service');
                await saveRowOrder(currentUserId, viewId, newOrder);
            } catch (error) {
                console.error('Failed to save row order:', error);
            }
        }
    };
}

// ============ Row Update Factory ============

/**
 * Configuration for creating an update handler
 */
export interface UpdateHandlerConfig<T extends { id: string }> {
    /** The update function from supabase-service */
    updateFn: (id: string, updates: Partial<T>) => Promise<T | void>;
    /** State setter to update local data */
    setData: Dispatch<SetStateAction<T[]>>;
    /** Optional field transformers for special handling */
    fieldTransformers?: Record<string, (value: unknown, row: T) => Partial<T>>;
    /** Enable optimistic updates with rollback on error (default: true) */
    optimistic?: boolean;
}

/**
 * Create a standardized handleUpdate function for DataTable
 *
 * Supports two modes:
 * 1. Simple: Direct update with optimistic state
 * 2. Complex: Field transformers for special handling (e.g., project_id -> project name)
 *
 * @example
 * ```tsx
 * // Simple mode
 * const handleUpdate = useMemo(() => createUpdateHandler({
 *     updateFn: updateCreativeConcept,
 *     setData,
 * }), []);
 *
 * // Complex mode with field transformers
 * const handleUpdate = useMemo(() => createUpdateHandler({
 *     updateFn: updateAdCopy,
 *     setData,
 *     fieldTransformers: {
 *         project_id: (value, row) => ({
 *             project_id: value ? String(value) : null,
 *             project: projects.find(p => p.id === value)?.name || null,
 *         }),
 *     },
 * }), [projects]);
 *
 * <DataTable onUpdate={handleUpdate} ... />
 * ```
 */
export function createUpdateHandler<T extends { id: string }>(
    config: UpdateHandlerConfig<T>
): (id: string, field: string, value: unknown) => Promise<void> {
    const {
        updateFn,
        setData,
        fieldTransformers = {},
        optimistic = true,
    } = config;

    return async (id: string, field: string, value: unknown): Promise<void> => {
        let updates: Partial<T>;
        let original: T | undefined;

        // Build updates and get original in one pass
        setData(prev => {
            const row = prev.find(item => item.id === id);
            if (!row) return prev;

            original = row;

            // Build updates using transformer or simple field update
            if (fieldTransformers[field]) {
                updates = fieldTransformers[field](value, row);
            } else {
                updates = { [field]: value } as Partial<T>;
            }

            // Optimistic update
            if (optimistic) {
                return prev.map(item =>
                    item.id === id ? { ...item, ...updates } : item
                );
            }
            return prev;
        });

        // If no row found, exit
        if (!original) return;

        try {
            await updateFn(id, updates!);

            // If not optimistic, update state after success
            if (!optimistic) {
                setData(prev => prev.map(item =>
                    item.id === id ? { ...item, ...updates } : item
                ));
            }
        } catch (error) {
            console.error('Failed to update:', error);

            // Rollback on error (only if optimistic)
            if (optimistic && original) {
                setData(prev => prev.map(item =>
                    item.id === id ? original! : item
                ));
            }

            throw error;
        }
    };
}

// ============ Type Exports ============

export type { ViewPreferences };
