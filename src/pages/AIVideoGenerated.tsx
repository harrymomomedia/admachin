import { useState, useCallback, useEffect, useMemo } from "react";
import { DataTable } from "../components/datatable";
import type { ColumnDef } from "../components/datatable";
import { DataTablePageLayout } from "../components/DataTablePageLayout";
import {
    getVideoOutputs,
    updateVideoOutput,
    deleteVideoOutput,
    getProjects,
    getSubprojects,
    getUsers,
    saveRowOrder,
    createSoraCharacter,
} from "../lib/supabase-service";
import type { Project, Subproject, User, VideoOutputWithDetails, VideoGenerator } from "../lib/supabase-service";
import { useAuth } from "../contexts/AuthContext";
import { RefreshCw, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { VIDEO_MODEL_OPTIONS, VIDEO_MODEL_COLOR_MAP } from "../constants/video";
import {
    generateColorMap,
    createProjectColumn,
    createSubprojectColumn,
} from "../lib/datatable-defaults";

interface VideoOutputRow {
    id: string;
    row_number: number;
    video_generator_id: string | null;
    output_storage_path: string | null;
    final_video_url: string | null;
    sora_url: string | null;
    new_url: string | null;
    transcript: string | null;
    task_id: string | null;
    task_status: 'pending' | 'processing' | 'completed' | 'failed';
    task_error: string | null;
    duration_seconds: number | null;
    file_size: number | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    // Joined data from video_generator
    video_generator?: VideoGenerator & {
        project?: Project;
        subproject?: Subproject;
        owner?: User;
    };
    // Derived fields for display
    project_id?: string | null;
    subproject_id?: string | null;
    owner_id?: string | null;
    video_prompt?: string | null;
    // Computed fields for gallery view
    video_url?: string | null;
    media_type?: 'video';
    // Model used for generation
    model?: string | null;
}

export function AIVideoGenerated() {
    const { user } = useAuth();
    const currentUserId = user?.id;
    const navigate = useNavigate();

    const [outputs, setOutputs] = useState<VideoOutputRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Projects, subprojects, and users
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);

    // Character creation state
    const [creatingCharacter, setCreatingCharacter] = useState<string | null>(null);

    // Generate colorMaps using shared utility
    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(subprojects), [subprojects]);

    // Status color map
    const statusColorMap: Record<string, string> = {
        'pending': 'bg-gray-100 text-gray-600',
        'processing': 'bg-blue-100 text-blue-600',
        'completed': 'bg-green-100 text-green-600',
        'failed': 'bg-red-100 text-red-600',
    };


    // Load data
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            try {
                const [outputsData, projectsData, subprojectsData, usersData] = await Promise.all([
                    getVideoOutputs(),
                    getProjects(),
                    getSubprojects(),
                    getUsers(),
                ]);

                // Map outputs with derived fields from video_generator
                const mappedOutputs: VideoOutputRow[] = outputsData.map(output => ({
                    ...output,
                    project_id: output.video_generator?.project_id,
                    subproject_id: output.video_generator?.subproject_id,
                    owner_id: output.video_generator?.owner_id,
                    video_prompt: output.video_generator?.video_prompt,
                    model: output.video_generator?.model,
                    // Computed fields for gallery view
                    video_url: output.new_url || output.sora_url || output.final_video_url,
                    media_type: 'video' as const,
                }));

                setOutputs(mappedOutputs);
                setProjects(projectsData);
                setSubprojects(subprojectsData);
                setUsers(usersData);
            } catch (error) {
                console.error('[AIVideoGenerated] Failed to load:', error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [currentUserId]);


    // Delete row
    const handleDelete = useCallback(async (id: string) => {
        setOutputs(prev => prev.filter(o => o.id !== id));
        try {
            await deleteVideoOutput(id);
        } catch (err) {
            console.error('[AIVideoGenerated] Failed to delete:', err);
        }
    }, []);

    // Update row
    const handleUpdate = useCallback(async (id: string, field: string, value: unknown) => {
        // Update local state
        setOutputs(prev =>
            prev.map(o => (o.id === id ? { ...o, [field]: value } : o))
        );

        // Update in database (only for fields on video_output table)
        const editableFields = ['transcript', 'final_video_url', 'new_url'];
        if (editableFields.includes(field)) {
            try {
                await updateVideoOutput(id, { [field]: value as string });
            } catch (err) {
                console.error('[AIVideoGenerated] Failed to update:', err);
            }
        }
    }, []);

    // Reorder handler
    const handleReorder = async (newOrder: string[]) => {
        const reordered = newOrder.map(id => outputs.find(o => o.id === id)!).filter(Boolean);
        setOutputs(reordered);

        if (currentUserId) {
            try {
                await saveRowOrder(currentUserId, 'ai-video-generated', newOrder);
            } catch (error) {
                console.error('Failed to save row order:', error);
            }
        }
    };

    // Format file size
    const formatFileSize = (bytes: number | null): string => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Format duration
    const formatDuration = (seconds: number | null): string => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
    };

    // Handle manual sync - calls the server sync endpoint
    const handleSync = useCallback(async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/video/sync-tasks', { method: 'POST' });
            const result = await response.json();
            console.log('[AIVideoGenerated] Sync result:', result);

            // Refresh data from database after sync
            const outputsData = await getVideoOutputs();
            const mappedOutputs: VideoOutputRow[] = outputsData.map(output => ({
                ...output,
                project_id: output.video_generator?.project_id,
                subproject_id: output.video_generator?.subproject_id,
                owner_id: output.video_generator?.owner_id,
                video_prompt: output.video_generator?.video_prompt,
                model: output.video_generator?.model,
                video_url: output.new_url || output.sora_url || output.final_video_url,
                media_type: 'video' as const,
            }));
            setOutputs(prev => {
                const prevOrder = prev.map(o => o.id);
                const freshMap = new Map(mappedOutputs.map(o => [o.id, o]));
                return prevOrder
                    .map(id => freshMap.get(id))
                    .filter((o): o is VideoOutputRow => o !== undefined);
            });
        } catch (error) {
            console.error('[AIVideoGenerated] Sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    }, []);

    // Create character from video
    const handleCreateCharacter = useCallback(async (row: VideoOutputRow) => {
        // Get the video URL (prefer sora_url, then final_video_url)
        const videoUrl = row.new_url || row.sora_url || row.final_video_url;
        if (!videoUrl) {
            alert('No video URL available for this row');
            return;
        }

        setCreatingCharacter(row.id);
        try {
            await createSoraCharacter({
                source_video_url: videoUrl,
                video_output_id: row.id,
                status: 'pending',
            });
            alert('Character creation task added! Run "npm run sora:character" to process it, or view in Sora Characters page.');
            navigate('/sora-characters');
        } catch (error) {
            console.error('[AIVideoGenerated] Failed to create character:', error);
            alert('Failed to create character task');
        } finally {
            setCreatingCharacter(null);
        }
    }, [navigate]);

    // Column definitions
    const columns: ColumnDef<VideoOutputRow>[] = [
        {
            key: 'row_number',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            type: 'id',
        },
        {
            key: 'video_preview',
            header: 'Preview',
            width: 80,
            minWidth: 70,
            editable: false,
            type: 'media',
            thumbnailSize: 'medium',
            getValue: (row) => row.new_url || row.sora_url || row.final_video_url,
        },
        {
            key: 'video_generator_id',
            header: 'Generator Link',
            width: 100,
            minWidth: 80,
            editable: false,
            type: 'custom',
            render: (value, row) => {
                const genId = row.video_generator?.row_number;
                return genId ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                        #{genId}
                    </span>
                ) : '-';
            },
        },
        createProjectColumn<VideoOutputRow>({ projects, subprojects, projectColorMap, editable: false }),
        createSubprojectColumn<VideoOutputRow>({ projects, subprojects, subprojectColorMap, editable: false }),
        {
            key: 'model',
            header: 'Model',
            width: 130,
            minWidth: 100,
            editable: false,
            type: 'select',
            options: [...VIDEO_MODEL_OPTIONS],
            colorMap: VIDEO_MODEL_COLOR_MAP,
        },
        {
            key: 'owner_id',
            header: 'Owner',
            width: 130,
            minWidth: 100,
            editable: false,
            type: 'people',
            users: users,
        },
        {
            key: 'video_prompt',
            header: 'Video Prompt',
            width: 250,
            minWidth: 180,
            editable: false,
            type: 'longtext',
        },
        {
            key: 'task_id',
            header: 'Task ID',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'text',
        },
        {
            key: 'task_status',
            header: 'Status',
            width: 110,
            minWidth: 90,
            editable: false,
            type: 'select',
            options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Processing', value: 'processing' },
                { label: 'Completed', value: 'completed' },
                { label: 'Failed', value: 'failed' },
            ],
            colorMap: statusColorMap,
        },
        {
            key: 'transcript',
            header: 'Transcript',
            width: 200,
            minWidth: 150,
            editable: true,
            type: 'longtext',
        },
        {
            key: 'final_video_url',
            header: 'Video URL',
            width: 150,
            minWidth: 120,
            editable: false,
            type: 'url',
        },
        {
            key: 'sora_url',
            header: 'Sora URL',
            width: 150,
            minWidth: 120,
            editable: true,
            type: 'url',
        },
        {
            key: 'new_url',
            header: 'New URL',
            width: 150,
            minWidth: 120,
            editable: true,
            type: 'url',
        },
        {
            key: 'duration_seconds',
            header: 'Duration',
            width: 80,
            minWidth: 60,
            editable: false,
            type: 'custom',
            render: (value) => formatDuration(value as number | null),
        },
        {
            key: 'file_size',
            header: 'Size',
            width: 80,
            minWidth: 60,
            editable: false,
            type: 'custom',
            render: (value) => formatFileSize(value as number | null),
        },
        {
            key: 'create_character',
            header: 'Character',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'custom',
            render: (_value, row) => {
                const hasVideo = row.new_url || row.sora_url || row.final_video_url;
                const isCompleted = row.task_status === 'completed';
                const isCreating = creatingCharacter === row.id;
                const isSoraWeb = row.model === 'sora-2-web-t2v';

                if (!hasVideo || !isCompleted) {
                    return (
                        <span className="text-gray-400 text-xs">-</span>
                    );
                }

                const isDisabled = isCreating || !isSoraWeb;

                return (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isDisabled) {
                                handleCreateCharacter(row);
                            }
                        }}
                        disabled={isDisabled}
                        className={`
                            flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                            transition-colors
                            ${isDisabled
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            }
                        `}
                        title={!isSoraWeb ? 'Character creation only available for Sora Web videos' : 'Create Sora character from this video'}
                    >
                        <UserPlus className="w-3 h-3" />
                        {isCreating ? 'Creating...' : 'Create'}
                    </button>
                );
            },
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
            {/* Sync button */}
            <div className="mb-3 flex items-center justify-end px-1">
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
                data={outputs}
                isLoading={isLoading}
                emptyMessage="No AI-generated videos found."
                title="AI Video Generated"
                getRowId={(row) => row.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                sortable={true}
                onReorder={handleReorder}
                resizable={true}
                fullscreen={true}
                layout="fullPage"
                quickFilters={['project_id', 'subproject_id', 'task_status']}
                showRowActions={true}
                viewId="ai-video-generated"
                selectable={true}
                // Gallery view configuration
                galleryConfig={{
                    mediaUrlKey: 'video_url',
                    mediaTypeKey: 'media_type',
                    nameKey: 'video_prompt',
                    projectKey: 'project_id',
                    subprojectKey: 'subproject_id',
                    userKey: 'owner_id',
                    dateKey: 'created_at',
                    fileSizeKey: 'file_size',
                    rowNumberKey: 'row_number',
                    showFileInfo: true,
                }}
                galleryLookups={{
                    projects: new Map(projects.map(p => [p.id, p.name])),
                    subprojects: new Map(subprojects.map(s => [s.id, s.name])),
                    users: new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim() || u.email || 'Unknown'])),
                    projectColors: projectColorMap,
                    subprojectColors: subprojectColorMap,
                }}
            />
        </DataTablePageLayout>
    );
}
