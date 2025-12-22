import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { DataTable } from "../components/datatable";
import type { ColumnDef } from "../components/datatable";
import { DataTablePageLayout } from "../components/DataTablePageLayout";
import {
    getVideoGenerators,
    createVideoGenerator,
    updateVideoGenerator,
    deleteVideoGenerator,
    createVideoOutput,
    saveVideoOutputLogs,
    getVideoOutput,
    getProjects,
    getSubprojects,
    getUsers,
    getUserViewPreferences,
    saveUserViewPreferences,
    getSharedViewPreferences,
    saveSharedViewPreferences,
    deleteUserViewPreferences,
    saveRowOrder,
} from "../lib/supabase-service";
import type { ViewPreferencesConfig, Project, Subproject, User, VideoOutput, VideoOutputLogEntry } from "../lib/supabase-service";
import { useAuth } from "../contexts/AuthContext";
import { generateVideo } from "../lib/video-service";
import { Play, Loader2, Terminal, X, Minimize2, Maximize2, RefreshCw } from "lucide-react";

// Color palette for dynamic colorMaps (defined outside component to avoid recreation)
const COLOR_PALETTE = [
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
];

interface VideoGeneratorRow {
    id: string;
    row_number: number;
    project_id: string | null;
    subproject_id: string | null;
    owner_id: string | null;
    image_storage_path: string | null;
    video_prompt: string | null;
    model: 'sora-2-text-to-video' | 'sora-2-web-t2v';
    duration: 10 | 15;  // kie.ai Sora 2 API supports 10 or 15 seconds
    aspect_ratio: 'landscape' | 'portrait';
    status: 'pending' | 'generating' | 'completed' | 'failed';
    middle_frame_path: string | null;
    transcript: string | null;
    created_at: string;
    updated_at: string;
    // Joined data
    video_outputs?: VideoOutput[];
}

export function VideoGenerator() {
    const { user } = useAuth();
    const currentUserId = user?.id;

    const [generators, setGenerators] = useState<VideoGeneratorRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Projects, subprojects, and users
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // View preferences
    const [userPreferences, setUserPreferences] = useState<ViewPreferencesConfig | null>(null);
    const [sharedPreferences, setSharedPreferences] = useState<ViewPreferencesConfig | null>(null);

    // Track which rows are currently submitting (prevents double-click)
    const [generatingRows, setGeneratingRows] = useState<Set<string>>(new Set());

    // Track selected rows for batch generation
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Track sync status
    const [isSyncing, setIsSyncing] = useState(false);

    // Confirmation dialog for re-generating
    const [confirmGenerate, setConfirmGenerate] = useState<VideoGeneratorRow | null>(null);

    // Multi-session log panels - each generation gets its own window
    // Logs are persisted in video_output.logs in the database
    interface LogEntry {
        id: number;
        timestamp: Date;
        type: 'info' | 'success' | 'error' | 'warning';
        message: string;
    }
    interface GenerationSession {
        id: string;
        rowId: string;
        rowNumber: number;
        videoOutputId: string | null;  // Links to video_output record for log persistence
        logs: LogEntry[];
        status: 'generating' | 'success' | 'error';
        minimized: boolean;
        visible: boolean;
        position: { x: number; y: number };
        size: { width: number; height: number };
    }

    const [sessions, setSessions] = useState<GenerationSession[]>([]);
    const sessionLogIdRef = useRef(0);

    // Create a new generation session
    const createSession = useCallback((rowId: string, rowNumber: number): string => {
        const sessionId = `session-${Date.now()}-${rowId}`;
        const existingCount = sessions.length;
        // Stack windows with offset
        const position = {
            x: 16 + (existingCount % 3) * 30,
            y: 16 + (existingCount % 3) * 30,
        };
        setSessions(prev => [...prev, {
            id: sessionId,
            rowId,
            rowNumber,
            videoOutputId: null,
            logs: [],
            status: 'generating',
            minimized: false,
            visible: true,
            position,
            size: { width: 450, height: 300 },
        }]);
        return sessionId;
    }, [sessions.length]);

    // Set video output ID for a session (called after video_output record is created)
    const setSessionVideoOutputId = useCallback((sessionId: string, videoOutputId: string) => {
        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, videoOutputId } : s
        ));
    }, []);

    // Add log to a specific session (in-memory only, call saveSessionLogs to persist)
    const addLogToSession = useCallback((sessionId: string, type: LogEntry['type'], message: string) => {
        const entry: LogEntry = {
            id: sessionLogIdRef.current++,
            timestamp: new Date(),
            type,
            message,
        };
        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, logs: [...s.logs, entry] } : s
        ));
    }, []);


    // Update session status
    const updateSessionStatus = useCallback((sessionId: string, status: GenerationSession['status']) => {
        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, status } : s
        ));
    }, []);

    // Toggle session minimized
    const toggleSessionMinimized = useCallback((sessionId: string) => {
        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, minimized: !s.minimized } : s
        ));
    }, []);

    // Close session (hide it, don't delete - can be restored via row button)
    const closeSession = useCallback((sessionId: string) => {
        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, visible: false } : s
        ));
    }, []);

    // Clear logs in a session
    const clearSessionLogs = useCallback((sessionId: string) => {
        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, logs: [] } : s
        ));
    }, []);

    // Resize session
    const resizeSession = useCallback((sessionId: string, size: { width: number; height: number }) => {
        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, size } : s
        ));
    }, []);

    // Refresh logs for a session from database
    const refreshSessionLogs = useCallback(async (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (!session?.videoOutputId) return;

        const videoOutput = await getVideoOutput(session.videoOutputId);
        if (!videoOutput) return;

        const logs: LogEntry[] = (videoOutput.logs || []).map(l => ({
            id: l.id,
            timestamp: new Date(l.timestamp),
            type: l.type,
            message: l.message,
        }));

        const maxId = logs.reduce((max, l) => Math.max(max, l.id), 0);
        if (maxId >= sessionLogIdRef.current) {
            sessionLogIdRef.current = maxId + 1;
        }

        const status: GenerationSession['status'] =
            videoOutput.task_status === 'completed' ? 'success' :
            videoOutput.task_status === 'failed' ? 'error' : 'generating';

        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, logs, status } : s
        ));
    }, [sessions]);

    // Show/focus session for a row - loads logs from database
    const showSessionForRow = useCallback(async (rowId: string) => {
        // First check if we already have a session for this row
        const existingSession = sessions.find(s => s.rowId === rowId);

        if (existingSession) {
            // Make visible and refresh logs from database
            setSessions(prev => prev.map(s =>
                s.rowId === rowId ? { ...s, visible: true, minimized: false } : s
            ));
            // Refresh logs to get server-side updates
            await refreshSessionLogs(existingSession.id);
            return;
        }

        // No existing session - create one and load logs from database
        // Find the latest video_output for this row
        const row = generators.find(g => g.id === rowId);
        if (!row?.video_outputs?.length) return;

        // Get the latest video output (they have logs)
        const latestOutput = row.video_outputs.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        // Load logs from database
        const videoOutput = await getVideoOutput(latestOutput.id);
        if (!videoOutput) return;

        const existingCount = sessions.length;
        const position = {
            x: 16 + (existingCount % 3) * 30,
            y: 16 + (existingCount % 3) * 30,
        };

        // Convert database logs to local format
        const logs: LogEntry[] = (videoOutput.logs || []).map(l => ({
            id: l.id,
            timestamp: new Date(l.timestamp),
            type: l.type,
            message: l.message,
        }));

        // Update sessionLogIdRef to avoid ID conflicts
        const maxId = logs.reduce((max, l) => Math.max(max, l.id), 0);
        if (maxId >= sessionLogIdRef.current) {
            sessionLogIdRef.current = maxId + 1;
        }

        // Determine status from task_status
        const status: GenerationSession['status'] =
            videoOutput.task_status === 'completed' ? 'success' :
            videoOutput.task_status === 'failed' ? 'error' : 'generating';

        setSessions(prev => [...prev, {
            id: `session-restored-${Date.now()}-${rowId}`,
            rowId,
            rowNumber: row.row_number,
            videoOutputId: videoOutput.id,
            logs,
            status,
            minimized: false,
            visible: true,
            position,
            size: { width: 450, height: 300 },
        }]);
    }, [sessions, generators, refreshSessionLogs]);

    // Get session for a specific row (check both in-memory and database)
    const getSessionForRow = useCallback((rowId: string) => {
        // First check in-memory sessions
        const memorySession = sessions.find(s => s.rowId === rowId);
        if (memorySession) return memorySession;

        // Check if there's a video_output with logs for this row
        const row = generators.find(g => g.id === rowId);
        if (row?.video_outputs?.length) {
            // Return a placeholder to indicate logs exist in database
            return { hasDbLogs: true } as unknown as GenerationSession;
        }
        return undefined;
    }, [sessions, generators]);

    // Generate colorMaps for projects and subprojects
    const projectColorMap = useMemo(() =>
        projects.reduce((map, p, i) => {
            map[p.id] = COLOR_PALETTE[i % COLOR_PALETTE.length];
            return map;
        }, {} as Record<string, string>),
        [projects]
    );

    const subprojectColorMap = useMemo(() =>
        subprojects.reduce((map, s, i) => {
            map[s.id] = COLOR_PALETTE[i % COLOR_PALETTE.length];
            return map;
        }, {} as Record<string, string>),
        [subprojects]
    );

    // Status color map
    const statusColorMap: Record<string, string> = {
        'pending': 'bg-gray-100 text-gray-600',
        'generating': 'bg-blue-100 text-blue-600',
        'completed': 'bg-green-100 text-green-600',
        'failed': 'bg-red-100 text-red-600',
    };

    // Load data
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            try {
                const [generatorsData, projectsData, subprojectsData, usersData, userPrefs, sharedPrefs] = await Promise.all([
                    getVideoGenerators(),
                    getProjects(),
                    getSubprojects(),
                    getUsers(),
                    currentUserId ? getUserViewPreferences(currentUserId, 'video-generator') : null,
                    getSharedViewPreferences('video-generator'),
                ]);

                // Store shared preferences
                if (sharedPrefs) {
                    setSharedPreferences({
                        sort_config: sharedPrefs.sort_config,
                        filter_config: sharedPrefs.filter_config,
                        group_config: sharedPrefs.group_config,
                        wrap_config: sharedPrefs.wrap_config,
                        row_order: sharedPrefs.row_order,
                        column_widths: sharedPrefs.column_widths,
                        column_order: sharedPrefs.column_order
                    });
                }

                // Store user view preferences
                if (userPrefs) {
                    setUserPreferences({
                        sort_config: userPrefs.sort_config,
                        filter_config: userPrefs.filter_config,
                        group_config: userPrefs.group_config,
                        wrap_config: userPrefs.wrap_config,
                        row_order: userPrefs.row_order,
                        column_widths: userPrefs.column_widths,
                        column_order: userPrefs.column_order
                    });
                }

                // Apply row order (user's or shared)
                const rowOrder = userPrefs?.row_order || sharedPrefs?.row_order;
                let finalGenerators = generatorsData as VideoGeneratorRow[];
                if (rowOrder && rowOrder.length > 0) {
                    const orderMap = new Map(rowOrder.map((id, index) => [id, index]));
                    finalGenerators = [...finalGenerators].sort((a, b) => {
                        const aIndex = orderMap.get(a.id) ?? Infinity;
                        const bIndex = orderMap.get(b.id) ?? Infinity;
                        return aIndex - bIndex;
                    });
                }

                setGenerators(finalGenerators);
                setProjects(projectsData);
                setSubprojects(subprojectsData);
                setUsers(usersData);
            } catch (error) {
                console.error('[VideoGenerator] Failed to load:', error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [currentUserId]);

    // Auto-refresh from database when there are generating tasks
    // Also triggers sync-tasks to poll Sora API (for local dev where cron doesn't run)
    useEffect(() => {
        const hasGeneratingTasks = generators.some(g => g.status === 'generating') ||
            generators.some(g => g.video_outputs?.some(vo => vo.task_status === 'processing'));

        if (!hasGeneratingTasks) return;

        const refreshInterval = setInterval(async () => {
            try {
                // Note: sync-tasks is called by the log refresh interval when log panel is visible
                // This interval just refreshes data from database

                const freshData = await getVideoGenerators();
                setGenerators(prev => {
                    // Preserve row order while updating data
                    const prevOrder = prev.map(g => g.id);
                    const freshMap = new Map(freshData.map(g => [g.id, g]));
                    return prevOrder
                        .map(id => freshMap.get(id))
                        .filter((g): g is VideoGeneratorRow => g !== undefined);
                });

                // Update session status if task completed/failed
                for (const g of freshData) {
                    const session = sessions.find(s => s.rowId === g.id);
                    if (session && session.status === 'generating') {
                        if (g.status === 'completed') {
                            updateSessionStatus(session.id, 'success');
                            // Refresh logs one final time to get server completion logs
                            await refreshSessionLogs(session.id);
                        } else if (g.status === 'failed') {
                            updateSessionStatus(session.id, 'error');
                            // Refresh logs one final time to get server error logs
                            await refreshSessionLogs(session.id);
                        }
                    }
                }

                // Also refresh logs for any visible generating sessions
                for (const session of sessions.filter(s => s.visible && s.status === 'generating' && s.videoOutputId)) {
                    await refreshSessionLogs(session.id);
                }
            } catch (err) {
                console.error('[VideoGenerator] Auto-refresh failed:', err);
            }
        }, 15000); // Refresh every 15 seconds

        return () => clearInterval(refreshInterval);
    }, [generators, sessions, updateSessionStatus, refreshSessionLogs]);

    // Track last sync time to prevent rate limiting
    const lastSyncTimeRef = useRef<number>(0);
    const syncInProgressRef = useRef<boolean>(false);

    // Auto-refresh logs for visible sessions (generating or recently completed)
    // This shows server-side log updates in real-time
    useEffect(() => {
        // Include both generating sessions and visible sessions that might have new logs
        const visibleActiveSessions = sessions.filter(s =>
            s.visible && s.videoOutputId && (s.status === 'generating' || s.status === 'success' || s.status === 'error')
        );

        // Only poll for generating sessions
        const hasGeneratingSession = visibleActiveSessions.some(s => s.status === 'generating');

        if (visibleActiveSessions.length === 0) return;

        const refreshLogs = async () => {
            // Rate limiting: don't call API more than once per 15 seconds
            const now = Date.now();
            const timeSinceLastSync = now - lastSyncTimeRef.current;

            // If there are generating sessions, call sync-tasks first to update logs in DB
            if (hasGeneratingSession && timeSinceLastSync >= 15000 && !syncInProgressRef.current) {
                syncInProgressRef.current = true;
                lastSyncTimeRef.current = now;
                console.log('[VideoGenerator] Polling sync-tasks for log updates...');
                await fetch('/api/video/sync-tasks', { method: 'POST' }).catch(() => {});
                syncInProgressRef.current = false;
            }

            // Then refresh logs from database
            for (const session of visibleActiveSessions) {
                try {
                    await refreshSessionLogs(session.id);
                } catch (err) {
                    console.error('[VideoGenerator] Log refresh failed:', err);
                }
            }
        };

        // Refresh immediately (but sync-tasks will be rate-limited)
        refreshLogs();
        // Poll every 15 seconds
        const interval = setInterval(refreshLogs, 15000);

        return () => clearInterval(interval);
    }, [sessions, refreshSessionLogs]);

    // View persistence handlers
    const handlePreferencesChange = async (preferences: ViewPreferencesConfig) => {
        if (!currentUserId) return;
        try {
            await saveUserViewPreferences(currentUserId, 'video-generator', preferences);
        } catch (error) {
            console.error('Failed to save view preferences:', error);
        }
    };

    const handleSaveForEveryone = async (preferences: ViewPreferencesConfig) => {
        try {
            const rowOrder = generators.map(g => g.id);
            await saveSharedViewPreferences('video-generator', {
                ...preferences,
                row_order: rowOrder
            });
            setSharedPreferences({
                ...preferences,
                row_order: rowOrder
            });
        } catch (error) {
            console.error('Failed to save shared preferences:', error);
        }
    };

    const handleResetPreferences = async () => {
        if (!currentUserId) return;
        try {
            await deleteUserViewPreferences(currentUserId, 'video-generator');
            setUserPreferences(null);
        } catch (error) {
            console.error('Failed to reset preferences:', error);
        }
    };

    // Create new row
    const handleCreateRow = useCallback(async () => {
        try {
            const newGenerator = await createVideoGenerator({
                owner_id: currentUserId || null,
            });
            setGenerators(prev => [{ ...newGenerator, video_outputs: [] } as VideoGeneratorRow, ...prev]);
            return newGenerator;
        } catch (error) {
            console.error('[VideoGenerator] Failed to create:', error);
            throw error;
        }
    }, [currentUserId]);

    // Delete row
    const handleDelete = useCallback(async (id: string) => {
        setGenerators(prev => prev.filter(g => g.id !== id));
        try {
            await deleteVideoGenerator(id);
        } catch (err) {
            console.error('[VideoGenerator] Failed to delete:', err);
        }
    }, []);

    // Update row
    const handleUpdate = useCallback(async (id: string, field: string, value: unknown) => {
        const item = generators.find(g => g.id === id);
        if (!item) return;

        const updates: Record<string, unknown> = { [field]: value };

        // Handle subproject -> project dependency
        if (field === 'subproject_id' && value) {
            const sub = subprojects.find(s => s.id === value);
            if (sub && sub.project_id !== item.project_id) {
                updates.project_id = sub.project_id;
            }
        }
        // Handle project change -> clear invalid subproject
        else if (field === 'project_id') {
            const currentSubprojectId = item.subproject_id;
            if (currentSubprojectId && value) {
                const subBelongsToNewProject = subprojects.some(
                    s => s.id === currentSubprojectId && s.project_id === value
                );
                if (!subBelongsToNewProject) {
                    updates.subproject_id = null;
                }
            } else if (!value) {
                updates.subproject_id = null;
            }
        }

        // Update local state
        setGenerators(prev =>
            prev.map(g => (g.id === id ? { ...g, ...updates } : g))
        );

        // Update in database
        try {
            await updateVideoGenerator(id, updates as Record<string, string | null>);
        } catch (err) {
            console.error('[VideoGenerator] Failed to update:', err);
        }
    }, [generators, subprojects]);

    // Reorder handler
    const handleReorder = async (newOrder: string[]) => {
        const reordered = newOrder.map(id => generators.find(g => g.id === id)!).filter(Boolean);
        setGenerators(reordered);

        if (currentUserId) {
            try {
                await saveRowOrder(currentUserId, 'video-generator', newOrder);
            } catch (error) {
                console.error('Failed to save row order:', error);
            }
        }
    };

    // Handle video generation for a single row - each gets its own log window
    const handleGenerate = useCallback(async (row: VideoGeneratorRow) => {
        // Create a new session for this generation
        const sessionId = createSession(row.id, row.row_number);

        // Keep local array of logs for reliable saving to database
        const localLogs: LogEntry[] = [];
        let videoOutputId: string | null = null;

        const log = (type: 'info' | 'success' | 'error' | 'warning', message: string) => {
            const entry: LogEntry = {
                id: sessionLogIdRef.current++,
                timestamp: new Date(),
                type,
                message,
            };
            localLogs.push(entry);
            addLogToSession(sessionId, type, message);
        };

        // Helper to save all logs to database
        const saveLogs = async () => {
            if (!videoOutputId || localLogs.length === 0) return;
            const dbLogs: VideoOutputLogEntry[] = localLogs.map(l => ({
                id: l.id,
                timestamp: l.timestamp.toISOString(),
                type: l.type,
                message: l.message,
            }));
            try {
                await saveVideoOutputLogs(videoOutputId, dbLogs);
            } catch (err) {
                console.error('Failed to save logs:', err);
            }
        };

        if (!row.video_prompt) {
            log('error', '✗ No video prompt provided');
            updateSessionStatus(sessionId, 'error');
            return;
        }

        const isWebModel = row.model === 'sora-2-web-t2v';
        const modelLabel = isWebModel ? 'Sora2 Web' : 'Sora2 API';

        // Initial logs with all generation parameters
        log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('info', '🎬 VIDEO GENERATION REQUEST');
        log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('info', `📋 Model: ${modelLabel}`);
        log('info', `⏱️ Duration: ${row.duration || 10}s`);
        log('info', `📐 Aspect: ${row.aspect_ratio || 'portrait'}`);
        log('info', `📝 Prompt: "${row.video_prompt.substring(0, 80)}${row.video_prompt.length > 80 ? '...' : ''}"`);
        log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Mark row as generating (prevents double-click)
        setGeneratingRows(prev => new Set(prev).add(row.id));

        // Update status to pending (for web) or generating (for API)
        const initialStatus = isWebModel ? 'pending' as const : 'generating' as const;
        setGenerators(prev =>
            prev.map(g => g.id === row.id ? { ...g, status: initialStatus } : g)
        );

        try {
            // Update database status
            await updateVideoGenerator(row.id, { status: initialStatus });

            if (isWebModel) {
                // Web model: Create pending task for local Playwright script
                log('info', '→ Creating task for local browser automation...');

                const videoOutput = await createVideoOutput({
                    video_generator_id: row.id,
                    task_id: `web-${Date.now()}`, // Placeholder task ID for web generation
                    task_status: 'pending',
                    metadata: {
                        model: 'sora-2-web-t2v',
                        prompt: row.video_prompt,
                        duration: row.duration || 10,
                        aspect_ratio: row.aspect_ratio || 'portrait',
                    },
                });
                videoOutputId = videoOutput.id;
                setSessionVideoOutputId(sessionId, videoOutput.id);

                log('success', '✓ Task created successfully');
                log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                log('info', '🖥️  RUN IN TERMINAL:');
                log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                log('warning', 'npm run sora:generate');
                log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                log('info', 'The script will open a browser and');
                log('info', 'automate sora.chatgpt.com for you.');
                log('info', 'First run: Log in to your OpenAI account.');

                await saveLogs();

                setGenerators(prev =>
                    prev.map(g => g.id === row.id
                        ? { ...g, video_outputs: [...(g.video_outputs || []), videoOutput] }
                        : g
                    )
                );

                updateSessionStatus(sessionId, 'generating');
            } else {
                // API model: Call kie.ai API
                log('info', '→ Sending request to kie.ai API...');

                const result = await generateVideo({
                    prompt: row.video_prompt,
                    model: row.model || 'sora-2-text-to-video',
                    duration: row.duration || 10,
                    aspectRatio: row.aspect_ratio || 'portrait',
                });

                if (!result.success || !result.taskId) {
                    log('error', `✗ API Error: ${result.error || 'Unknown error'}`);
                    updateSessionStatus(sessionId, 'error');
                    throw new Error(result.error || 'Failed to start video generation');
                }

                log('success', `✓ Request accepted by kie.ai`);
                log('info', `📌 Task ID: ${result.taskId}`);

                // Save taskId to database immediately (for cron job to pick up if browser closes)
                const videoOutput = await createVideoOutput({
                    video_generator_id: row.id,
                    task_id: result.taskId,
                    task_status: 'processing',
                });
                videoOutputId = videoOutput.id;

                // Link session to video output for log persistence
                setSessionVideoOutputId(sessionId, videoOutput.id);

                log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                log('info', '⏳ PROCESSING (~5 mins)');
                log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                log('info', 'Server polling every 15 seconds...');

                // Save all logs so far to database
                await saveLogs();

                // Update local state with the new video output
                setGenerators(prev =>
                    prev.map(g => g.id === row.id
                        ? { ...g, video_outputs: [...(g.video_outputs || []), videoOutput] }
                        : g
                    )
                );

                // Task is now in database - server will poll kie.ai and update status
                // Frontend will refresh from database to show progress
                updateSessionStatus(sessionId, 'generating');
            }
        } catch (error) {
            log('error', `✗ Error: ${error}`);
            await saveLogs();
            updateSessionStatus(sessionId, 'error');

            setGenerators(prev =>
                prev.map(g => g.id === row.id ? { ...g, status: 'failed' as const } : g)
            );

            try {
                await updateVideoGenerator(row.id, { status: 'failed' });
            } catch (e) {
                console.error('[VideoGenerator] Failed to update status:', e);
            }
        } finally {
            // Remove from generating set
            setGeneratingRows(prev => {
                const next = new Set(prev);
                next.delete(row.id);
                return next;
            });
        }
    }, [createSession, addLogToSession, updateSessionStatus, setSessionVideoOutputId]);

    // Handle batch generation for selected rows
    const handleBatchGenerate = useCallback(async () => {
        const selectedRows = generators.filter(g =>
            selectedIds.has(g.id) &&
            g.video_prompt &&
            g.status !== 'generating' &&
            !generatingRows.has(g.id)
        );

        if (selectedRows.length === 0) {
            console.log('[VideoGenerator] No valid rows to generate');
            return;
        }

        console.log(`[VideoGenerator] Starting batch generation for ${selectedRows.length} rows`);

        // Process rows with limited concurrency (2 at a time to avoid rate limits)
        const concurrencyLimit = 2;
        const queue = [...selectedRows];

        const processNext = async () => {
            const row = queue.shift();
            if (!row) return;

            await handleGenerate(row);

            // Process next in queue
            if (queue.length > 0) {
                await processNext();
            }
        };

        // Start processing with concurrency limit
        const workers = [];
        for (let i = 0; i < Math.min(concurrencyLimit, queue.length); i++) {
            workers.push(processNext());
        }

        await Promise.all(workers);
        console.log('[VideoGenerator] Batch generation complete');
    }, [generators, selectedIds, generatingRows, handleGenerate]);

    // Get count of rows that can be generated (must have all required fields)
    const generatableSelectedCount = useMemo(() => {
        return generators.filter(g =>
            selectedIds.has(g.id) &&
            g.video_prompt &&
            g.project_id &&
            g.aspect_ratio &&
            g.duration &&
            g.status !== 'generating' &&
            !generatingRows.has(g.id)
        ).length;
    }, [generators, selectedIds, generatingRows]);

    // Handle manual sync - calls the server sync endpoint
    const handleSync = useCallback(async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/video/sync-tasks', { method: 'POST' });
            const result = await response.json();
            console.log('[VideoGenerator] Sync result:', result);

            // Refresh data from database after sync
            const freshData = await getVideoGenerators();
            setGenerators(prev => {
                const prevOrder = prev.map(g => g.id);
                const freshMap = new Map(freshData.map(g => [g.id, g]));
                return prevOrder
                    .map(id => freshMap.get(id))
                    .filter((g): g is VideoGeneratorRow => g !== undefined);
            });

            // Refresh logs for any visible sessions
            for (const session of sessions.filter(s => s.visible && s.videoOutputId)) {
                await refreshSessionLogs(session.id);
            }
        } catch (error) {
            console.error('[VideoGenerator] Sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [sessions, refreshSessionLogs]);

    // Column definitions
    const columns: ColumnDef<VideoGeneratorRow>[] = [
        {
            key: 'row_number',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            type: 'id',
        },
        {
            key: 'project_id',
            header: 'Project',
            width: 140,
            minWidth: 100,
            editable: true,
            type: 'select',
            options: projects.map(p => ({ label: p.name, value: p.id })),
            colorMap: projectColorMap,
        },
        {
            key: 'subproject_id',
            header: 'Subproject',
            width: 140,
            minWidth: 100,
            editable: true,
            type: 'select',
            options: (row) => {
                if (!row.project_id) {
                    return subprojects.map(s => ({ label: s.name, value: s.id }));
                }
                return subprojects
                    .filter(s => s.project_id === row.project_id)
                    .map(s => ({ label: s.name, value: s.id }));
            },
            filterOptions: subprojects.map(s => ({ label: s.name, value: s.id })),
            colorMap: subprojectColorMap,
            dependsOn: {
                parentKey: 'project_id',
                getParentValue: (subprojectId) => {
                    const sub = subprojects.find(s => s.id === subprojectId);
                    return sub?.project_id ?? null;
                },
            },
        },
        {
            key: 'owner_id',
            header: 'Owner',
            width: 130,
            minWidth: 100,
            editable: user?.role === 'admin',
            type: 'people',
            users: users,
        },
        {
            key: 'model',
            header: 'Model',
            width: 140,
            minWidth: 120,
            editable: true,
            type: 'select',
            options: [
                { label: 'Sora2 API', value: 'sora-2-text-to-video' },
                { label: 'Sora2 Web', value: 'sora-2-web-t2v' },
            ],
            colorMap: {
                'sora-2-text-to-video': 'bg-violet-100 text-violet-700',
                'sora-2-web-t2v': 'bg-emerald-100 text-emerald-700',
            },
        },
        {
            key: 'video_prompt',
            header: 'Video Prompt',
            width: 300,
            minWidth: 200,
            editable: true,
            type: 'longtext',
        },
        {
            key: 'duration',
            header: 'Duration',
            width: 90,
            minWidth: 70,
            editable: true,
            type: 'select',
            options: [
                { label: '10s', value: 10 },
                { label: '15s', value: 15 },
            ],
            colorMap: {
                10: 'bg-blue-100 text-blue-700',
                15: 'bg-purple-100 text-purple-700',
            },
        },
        {
            key: 'aspect_ratio',
            header: 'Aspect',
            width: 110,
            minWidth: 90,
            editable: true,
            type: 'select',
            options: [
                { label: 'Landscape', value: 'landscape' },
                { label: 'Portrait', value: 'portrait' },
            ],
            colorMap: {
                'landscape': 'bg-green-100 text-green-700',
                'portrait': 'bg-orange-100 text-orange-700',
            },
        },
        {
            key: 'generate',
            header: 'Generate',
            width: 100,
            minWidth: 80,
            editable: false,
            type: 'custom',
            render: (_value, row) => {
                const isSubmitting = generatingRows.has(row.id); // Currently submitting this request
                const hasPrompt = !!row.video_prompt;
                const hasProject = !!row.project_id;
                const hasAspect = !!row.aspect_ratio;
                const hasDuration = !!row.duration;
                const isReady = hasPrompt && hasProject && hasAspect && hasDuration;

                // Build tooltip message for missing fields
                const missingFields: string[] = [];
                if (!hasPrompt) missingFields.push('video prompt');
                if (!hasProject) missingFields.push('project');
                if (!hasAspect) missingFields.push('aspect ratio');
                if (!hasDuration) missingFields.push('duration');
                const tooltip = missingFields.length > 0
                    ? `Missing: ${missingFields.join(', ')}`
                    : 'Generate video';

                return (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isReady) return;
                            // Show confirmation dialog
                            setConfirmGenerate(row);
                        }}
                        disabled={!isReady || isSubmitting}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                            transition-colors
                            ${!isReady || isSubmitting
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }
                        `}
                        title={tooltip}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>...</span>
                            </>
                        ) : (
                            <>
                                <Play className="h-3.5 w-3.5" />
                                <span>Generate</span>
                            </>
                        )}
                    </button>
                );
            },
        },
        {
            key: 'console',
            header: '',
            width: 40,
            minWidth: 40,
            editable: false,
            type: 'custom',
            render: (_value, row) => {
                const session = getSessionForRow(row.id);
                const hasSession = !!session;

                return (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (hasSession) {
                                showSessionForRow(row.id);
                            }
                        }}
                        disabled={!hasSession}
                        className={`
                            p-1.5 rounded transition-colors
                            ${hasSession
                                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                : 'text-gray-300 cursor-not-allowed'
                            }
                        `}
                        title={hasSession ? 'Show console' : 'No active console'}
                    >
                        <Terminal className="h-4 w-4" />
                    </button>
                );
            },
        },
        {
            key: 'status',
            header: 'Status',
            width: 110,
            minWidth: 90,
            editable: false,
            type: 'select',
            options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Generating', value: 'generating' },
                { label: 'Completed', value: 'completed' },
                { label: 'Failed', value: 'failed' },
            ],
            colorMap: statusColorMap,
        },
        {
            key: 'video_outputs',
            header: 'Videos',
            width: 80,
            minWidth: 60,
            editable: false,
            type: 'custom',
            render: (value) => {
                const outputs = value as VideoOutput[] | undefined;
                const count = outputs?.length || 0;
                return (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${count > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                        {count}
                    </span>
                );
            },
        },
        {
            key: 'transcript',
            header: 'Transcript',
            width: 200,
            minWidth: 150,
            editable: false,
            type: 'text',
        },
        {
            key: 'created_at',
            header: 'Created',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'date',
        },
    ];

    return (
        <DataTablePageLayout>
            {/* Action bar - Sync button + Batch Generate */}
            <div className="mb-3 flex items-center justify-between px-1">
                {/* Left side - Selection actions */}
                {selectedIds.size > 0 ? (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                            {selectedIds.size} row{selectedIds.size !== 1 ? 's' : ''} selected
                        </span>
                        <button
                            onClick={handleBatchGenerate}
                            disabled={generatableSelectedCount === 0}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
                                transition-colors
                                ${generatableSelectedCount > 0
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }
                            `}
                        >
                            <Play className="h-4 w-4" />
                            Generate Selected ({generatableSelectedCount})
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                            Clear Selection
                        </button>
                    </div>
                ) : (
                    <div />
                )}

                {/* Right side - Sync button */}
                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
                        transition-colors border
                        ${isSyncing
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }
                    `}
                    title="Manually sync task status from kie.ai"
                >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync'}
                </button>
            </div>
            <DataTable
                columns={columns}
                data={generators}
                isLoading={isLoading}
                emptyMessage="No video generators found. Create your first video generation request!"
                title="Video Generator"
                newButtonLabel="New"
                getRowId={(row) => row.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateRow={handleCreateRow}
                sortable={true}
                onReorder={handleReorder}
                resizable={true}
                fullscreen={true}
                quickFilters={['project_id', 'subproject_id', 'status']}
                showRowActions={true}
                // View persistence
                viewId="video-generator"
                userId={currentUserId || undefined}
                initialPreferences={userPreferences || undefined}
                sharedPreferences={sharedPreferences || undefined}
                onPreferencesChange={handlePreferencesChange}
                onSaveForEveryone={handleSaveForEveryone}
                onResetPreferences={handleResetPreferences}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
            />

            {/* Multi-Session Log Panels - each generation gets its own window */}
            {sessions.filter(s => s.visible).map((session, index) => (
                <div
                    key={session.id}
                    className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
                    style={{
                        bottom: `${session.position.y}px`,
                        right: `${session.position.x + index * 20}px`,
                        width: `${session.size?.width || 450}px`,
                        maxWidth: 'calc(100vw - 2rem)',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                                session.status === 'generating' ? 'bg-blue-500 animate-pulse' :
                                session.status === 'success' ? 'bg-green-500' :
                                'bg-red-500'
                            }`} />
                            <span className="font-medium text-gray-900 text-sm">Row #{session.rowNumber}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                session.status === 'generating' ? 'bg-blue-100 text-blue-700' :
                                session.status === 'success' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                                {session.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => toggleSessionMinimized(session.id)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                            >
                                {session.minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                            </button>
                            <button
                                onClick={() => closeSession(session.id)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {!session.minimized && (
                        <>
                            {/* Progress indicator when generating */}
                            {session.status === 'generating' && (
                                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                                    </div>
                                </div>
                            )}

                            {/* Log content */}
                            <div
                                className="bg-gray-900 text-gray-100 font-mono text-xs overflow-y-auto"
                                style={{ height: `${(session.size?.height || 300) - 90}px` }}
                            >
                                <div className="p-3 space-y-1">
                                    {session.logs.length === 0 ? (
                                        <p className="text-gray-500">Starting...</p>
                                    ) : (
                                        session.logs.map((log) => (
                                            <div key={log.id} className="flex gap-2">
                                                <span className="text-gray-500 flex-shrink-0">
                                                    {log.timestamp.toLocaleTimeString('en-US', { hour12: false })}
                                                </span>
                                                <span className={`flex-shrink-0 ${
                                                    log.type === 'success' ? 'text-green-400' :
                                                    log.type === 'error' ? 'text-red-400' :
                                                    log.type === 'warning' ? 'text-yellow-400' :
                                                    'text-blue-400'
                                                }`}>
                                                    {log.type === 'success' ? '✓' :
                                                     log.type === 'error' ? '✗' :
                                                     log.type === 'warning' ? '!' :
                                                     '→'}
                                                </span>
                                                <span className={`${
                                                    log.type === 'success' ? 'text-green-300' :
                                                    log.type === 'error' ? 'text-red-300' :
                                                    log.type === 'warning' ? 'text-yellow-300' :
                                                    'text-gray-300'
                                                }`}>
                                                    {log.message}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    {session.logs.length} log{session.logs.length !== 1 ? 's' : ''}
                                </span>
                                <button
                                    onClick={() => clearSessionLogs(session.id)}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                    Clear
                                </button>
                            </div>
                        </>
                    )}

                    {/* Resize handle - top-left corner (panel anchored to bottom-right) */}
                    <div
                        className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize group"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startWidth = session.size?.width || 450;
                            const startHeight = session.size?.height || 300;

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                                // Since we're dragging top-left corner with panel anchored bottom-right:
                                // Moving left (negative deltaX) should increase width
                                // Moving up (negative deltaY) should increase height
                                const deltaX = startX - moveEvent.clientX;
                                const deltaY = startY - moveEvent.clientY;
                                const newWidth = Math.max(300, Math.min(800, startWidth + deltaX));
                                const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
                                resizeSession(session.id, { width: newWidth, height: newHeight });
                            };

                            const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                            };

                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                        }}
                    >
                        <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-gray-300 group-hover:border-gray-500 rounded-tl transition-colors" />
                    </div>
                </div>
            ))}

            {/* Generate Confirmation Dialog */}
            {confirmGenerate && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">Generate Video?</h3>
                        </div>
                        <div className="px-6 py-4 space-y-3">
                            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <span className="text-amber-500 text-lg">💰</span>
                                <p className="text-sm text-amber-800">
                                    It will cost you money <strong>$0.20</strong> per Sora2 video.
                                </p>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <span className="text-blue-500 text-lg">⏱️</span>
                                <p className="text-sm text-blue-800">
                                    Results take <strong>~5 mins</strong>. Do not run multiple times before waiting.
                                </p>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmGenerate(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    handleGenerate(confirmGenerate);
                                    setConfirmGenerate(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DataTablePageLayout>
    );
}
