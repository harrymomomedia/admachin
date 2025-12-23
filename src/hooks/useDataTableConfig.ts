/**
 * useDataTableConfig Hook
 *
 * Provides common DataTable configuration including:
 * - User and shared preferences state
 * - Preference persistence handlers (save, saveForEveryone, reset)
 * - Color maps for projects/subprojects
 * - Standard column builders
 *
 * Usage:
 * ```tsx
 * const {
 *     userPreferences,
 *     sharedPreferences,
 *     handlePreferencesChange,
 *     handleSaveForEveryone,
 *     handleResetPreferences,
 *     projectColorMap,
 *     subprojectColorMap,
 *     createColumns,
 * } = useDataTableConfig({
 *     viewId: 'my-page',
 *     userId: currentUserId,
 *     projects,
 *     subprojects,
 *     users,
 * });
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getUserViewPreferences,
    getSharedViewPreferences,
    saveUserViewPreferences,
    saveSharedViewPreferences,
    deleteUserViewPreferences,
    type Project,
    type Subproject,
    type User,
} from '../lib/supabase-service';
import type { ViewPreferences } from '../components/datatable/types';
import {
    generateColorMap,
    createProjectColumn,
    createSubprojectColumn,
    createUserColumn,
    createDateColumn,
    createIdColumn,
    applyRowOrder,
    DEFAULT_DATATABLE_PROPS,
    INLINE_DATATABLE_PROPS,
    DEFAULT_QUICK_FILTERS,
} from '../lib/datatable-defaults';

interface UseDataTableConfigOptions {
    /** Unique identifier for this view's preferences */
    viewId: string;
    /** Current user's ID for user-specific preferences */
    userId: string | null;
    /** Projects for color maps and columns */
    projects: Project[];
    /** Subprojects for color maps and columns */
    subprojects: Subproject[];
    /** Users for people columns */
    users?: User[];
    /** Callback when preferences are loaded (for applying row order) */
    onPreferencesLoaded?: (prefs: ViewPreferences | null, sharedPrefs: ViewPreferences | null) => void;
}

interface UseDataTableConfigReturn {
    /** User-specific preferences */
    userPreferences: ViewPreferences | null;
    /** Shared/team preferences */
    sharedPreferences: ViewPreferences | null;
    /** Loading state for preferences */
    isLoadingPreferences: boolean;
    /** Handler for saving user preferences (called automatically on change) */
    handlePreferencesChange: (preferences: ViewPreferences) => Promise<void>;
    /** Handler for saving shared preferences (team-wide) */
    handleSaveForEveryone: (preferences: ViewPreferences, rowOrder?: string[]) => Promise<void>;
    /** Handler for resetting to shared preferences */
    handleResetPreferences: () => Promise<void>;
    /** Color map for projects */
    projectColorMap: Record<string, string>;
    /** Color map for subprojects */
    subprojectColorMap: Record<string, string>;
    /** Helper to create project column */
    createProjectCol: <T extends { project_id?: string | null }>(editable?: boolean) => ReturnType<typeof createProjectColumn<T>>;
    /** Helper to create subproject column */
    createSubprojectCol: <T extends { project_id?: string | null; subproject_id?: string | null }>(editable?: boolean) => ReturnType<typeof createSubprojectColumn<T>>;
    /** Helper to create user column */
    createUserCol: <T>(key?: string, header?: string, editable?: boolean) => ReturnType<typeof createUserColumn<T>>;
    /** Helper to create date column */
    createDateCol: <T>(key?: string, header?: string, editable?: boolean) => ReturnType<typeof createDateColumn<T>>;
    /** Helper to create ID column */
    createIdCol: <T>(key?: string, header?: string) => ReturnType<typeof createIdColumn<T>>;
    /** Apply row order from preferences */
    applyRowOrderFromPrefs: <T extends { id: string }>(data: T[]) => T[];
    /** Default DataTable props for full-page tables */
    defaultProps: typeof DEFAULT_DATATABLE_PROPS;
    /** Props for inline/embedded DataTables (inside accordions, cards, etc.) */
    inlineProps: typeof INLINE_DATATABLE_PROPS;
    /** Default quick filter keys */
    defaultQuickFilters: readonly string[];
    /** Reload preferences from database */
    reloadPreferences: () => Promise<void>;
}

export function useDataTableConfig(options: UseDataTableConfigOptions): UseDataTableConfigReturn {
    const { viewId, userId, projects, subprojects, users = [], onPreferencesLoaded } = options;

    // Preferences state
    const [userPreferences, setUserPreferences] = useState<ViewPreferences | null>(null);
    const [sharedPreferences, setSharedPreferences] = useState<ViewPreferences | null>(null);
    const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

    // Color maps (memoized)
    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(subprojects), [subprojects]);

    // Load preferences on mount and when userId changes
    const loadPreferences = useCallback(async () => {
        setIsLoadingPreferences(true);
        try {
            const [userPrefs, sharedPrefs] = await Promise.all([
                userId ? getUserViewPreferences(userId, viewId) : null,
                getSharedViewPreferences(viewId),
            ]);

            // Extract and set user preferences
            if (userPrefs) {
                setUserPreferences({
                    sort_config: userPrefs.sort_config,
                    filter_config: userPrefs.filter_config,
                    group_config: userPrefs.group_config,
                    wrap_config: userPrefs.wrap_config,
                    thumbnail_size_config: userPrefs.thumbnail_size_config,
                    row_order: userPrefs.row_order,
                    column_widths: userPrefs.column_widths,
                    column_order: userPrefs.column_order,
                });
            } else {
                setUserPreferences(null);
            }

            // Extract and set shared preferences
            if (sharedPrefs) {
                setSharedPreferences({
                    sort_config: sharedPrefs.sort_config,
                    filter_config: sharedPrefs.filter_config,
                    group_config: sharedPrefs.group_config,
                    wrap_config: sharedPrefs.wrap_config,
                    thumbnail_size_config: sharedPrefs.thumbnail_size_config,
                    row_order: sharedPrefs.row_order,
                    column_widths: sharedPrefs.column_widths,
                    column_order: sharedPrefs.column_order,
                });
            } else {
                setSharedPreferences(null);
            }

            // Notify parent if callback provided
            if (onPreferencesLoaded) {
                onPreferencesLoaded(userPrefs, sharedPrefs);
            }
        } catch (error) {
            console.error(`[useDataTableConfig] Failed to load preferences for ${viewId}:`, error);
        } finally {
            setIsLoadingPreferences(false);
        }
    }, [userId, viewId, onPreferencesLoaded]);

    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    // Preference handlers
    const handlePreferencesChange = useCallback(async (preferences: ViewPreferences) => {
        if (!userId) return;
        try {
            await saveUserViewPreferences(userId, viewId, preferences);
            setUserPreferences(preferences);
        } catch (error) {
            console.error(`[useDataTableConfig] Failed to save user preferences for ${viewId}:`, error);
        }
    }, [userId, viewId]);

    const handleSaveForEveryone = useCallback(async (preferences: ViewPreferences, rowOrder?: string[]) => {
        try {
            const prefsToSave = rowOrder ? { ...preferences, row_order: rowOrder } : preferences;
            await saveSharedViewPreferences(viewId, prefsToSave);
            setSharedPreferences(prefsToSave);
        } catch (error) {
            console.error(`[useDataTableConfig] Failed to save shared preferences for ${viewId}:`, error);
        }
    }, [viewId]);

    const handleResetPreferences = useCallback(async () => {
        if (!userId) return;
        try {
            await deleteUserViewPreferences(userId, viewId);
            setUserPreferences(null);
        } catch (error) {
            console.error(`[useDataTableConfig] Failed to reset preferences for ${viewId}:`, error);
        }
    }, [userId, viewId]);

    // Column builders (memoized)
    const createProjectCol = useCallback(<T extends { project_id?: string | null }>(editable = true) => {
        return createProjectColumn<T>({
            projects,
            subprojects,
            projectColorMap,
            editable,
        });
    }, [projects, subprojects, projectColorMap]);

    const createSubprojectCol = useCallback(<T extends { project_id?: string | null; subproject_id?: string | null }>(editable = true) => {
        return createSubprojectColumn<T>({
            projects,
            subprojects,
            subprojectColorMap,
            editable,
        });
    }, [projects, subprojects, subprojectColorMap]);

    const createUserCol = useCallback(<T,>(key = 'user_id', header = 'Created By', editable = true) => {
        return createUserColumn<T>(users, { key, header, editable });
    }, [users]);

    const createDateCol = useCallback(<T,>(key = 'created_at', header = 'Created', editable = false) => {
        return createDateColumn<T>({ key, header, editable });
    }, []);

    const createIdCol = useCallback(<T,>(key = 'row_number', header = 'ID') => {
        return createIdColumn<T>({ key, header });
    }, []);

    // Row order application
    const applyRowOrderFromPrefs = useCallback(<T extends { id: string }>(data: T[]): T[] => {
        const rowOrder = userPreferences?.row_order || sharedPreferences?.row_order;
        return applyRowOrder(data, rowOrder);
    }, [userPreferences, sharedPreferences]);

    return {
        userPreferences,
        sharedPreferences,
        isLoadingPreferences,
        handlePreferencesChange,
        handleSaveForEveryone,
        handleResetPreferences,
        projectColorMap,
        subprojectColorMap,
        createProjectCol,
        createSubprojectCol,
        createUserCol,
        createDateCol,
        createIdCol,
        applyRowOrderFromPrefs,
        defaultProps: DEFAULT_DATATABLE_PROPS,
        inlineProps: INLINE_DATATABLE_PROPS,
        defaultQuickFilters: DEFAULT_QUICK_FILTERS,
        reloadPreferences: loadPreferences,
    };
}

export default useDataTableConfig;
