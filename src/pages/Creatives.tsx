import { useState, useCallback, useEffect } from "react";
import { X, Film, Check, Play, Image as ImageIcon } from "lucide-react";
import { CreativeUploader } from "../components/CreativeUploader";
import { DataTable } from "../components/DataTable";
import type { ColumnDef } from "../components/DataTable";
import { DataTablePageLayout } from "../components/DataTablePageLayout";
import {
    getCreatives,
    deleteCreative as deleteCreativeFromDb,
    updateCreative as updateCreativeInDb,
    getCreativeUrl,
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
import type { ViewPreferencesConfig, Project, Subproject, User } from "../lib/supabase-service";
import { useAuth } from "../contexts/AuthContext";

interface Creative {
    id: string;
    name: string;
    type: "image" | "video";
    preview: string;
    url?: string;
    size: number;
    sizeFormatted: string;
    uploadedAt: string;
    uploadedBy: string;
    user_id?: string; // User ID for people column
    hash?: string;
    videoId?: string;
    dimensions?: string;
    duration?: number;
    dbId?: string;
    project_id?: string | null;
    subproject_id?: string | null;
    row_number?: number; // Serial number for display ID
}

interface UploadedFile {
    id: string;
    file: File;
    preview: string;
    type: "image" | "video";
    status: "uploading" | "success" | "error";
    progress: number;
    hash?: string;
    url?: string;
    error?: string;
}

// Storage key for sharing with Launch page (session cache)
const STORAGE_KEY = "admachin_creative_library";

// Format file size
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Save media to localStorage for quick access on Launch page
function saveMediaToCache(items: Creative[]): void {
    try {
        const simplified = items.map(m => ({
            id: m.id,
            name: m.name,
            type: m.type,
            preview: m.preview,
            url: m.url,
            hash: m.hash,
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(simplified));
    } catch {
        // Ignore storage errors
    }
}

// Load media from Supabase
async function loadMediaFromDb(): Promise<Creative[]> {
    try {
        const creatives = await getCreatives();
        return creatives.map(c => {
            const dims = c.dimensions as { width?: number; height?: number; thumbnail?: string } | null;
            const videoUrl = getCreativeUrl(c.storage_path);
            const previewUrl = (c.type === 'video' && dims?.thumbnail)
                ? getCreativeUrl(dims.thumbnail)
                : getCreativeUrl(c.storage_path);

            return {
                id: c.id,
                dbId: c.id,
                name: c.name,
                type: c.type as "image" | "video",
                preview: previewUrl,
                url: videoUrl,
                size: c.file_size,
                sizeFormatted: formatFileSize(c.file_size),
                uploadedAt: c.created_at,
                uploadedBy: c.uploaded_by || 'Unknown',
                hash: c.fb_hash || undefined,
                videoId: (c as unknown as { fb_video_id: string | null }).fb_video_id || undefined,
                dimensions: dims?.width ? `${dims.width} × ${dims.height}` : undefined,
                duration: c.duration || undefined,
                project_id: c.project_id,
                subproject_id: c.subproject_id,
                row_number: (c as unknown as { row_number?: number }).row_number,
            };
        });
    } catch (error) {
        console.error('[Creatives] Failed to load from Supabase:', error);
        return [];
    }
}

export function Creatives() {
    const { user } = useAuth();
    const currentUserId = user?.id;

    const [creatives, setCreatives] = useState<Creative[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showUploader, setShowUploader] = useState(false);
    const [previewItem, setPreviewItem] = useState<Creative | null>(null);

    // Projects, subprojects, and users
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // View preferences
    const [userPreferences, setUserPreferences] = useState<ViewPreferencesConfig | null>(null);
    const [sharedPreferences, setSharedPreferences] = useState<ViewPreferencesConfig | null>(null);

    // Load data and preferences
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            try {
                const [items, projectsData, subprojectsData, usersData, userPrefs, sharedPrefs] = await Promise.all([
                    loadMediaFromDb(),
                    getProjects(),
                    getSubprojects(),
                    getUsers(),
                    currentUserId ? getUserViewPreferences(currentUserId, 'creatives') : null,
                    getSharedViewPreferences('creatives'),
                ]);

                // Map user_id to creatives by matching uploaded_by name
                const creativesWithUserId = items.map(item => {
                    const matchedUser = usersData.find(u => {
                        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                        return fullName === item.uploadedBy || u.email === item.uploadedBy;
                    });
                    return { ...item, user_id: matchedUser?.id };
                });

                // Store shared preferences (including column_widths and column_order)
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

                // Store user view preferences (including column_widths and column_order)
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
                let finalCreatives = creativesWithUserId;
                if (rowOrder && rowOrder.length > 0) {
                    const orderMap = new Map(rowOrder.map((id, index) => [id, index]));
                    finalCreatives = [...creativesWithUserId].sort((a, b) => {
                        const aIndex = orderMap.get(a.id) ?? Infinity;
                        const bIndex = orderMap.get(b.id) ?? Infinity;
                        return aIndex - bIndex;
                    });
                }

                setCreatives(finalCreatives);
                setProjects(projectsData);
                setSubprojects(subprojectsData);
                setUsers(usersData);
                saveMediaToCache(finalCreatives);
            } catch (error) {
                console.error('[Creatives] Failed to load:', error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [currentUserId]);

    // View persistence handlers
    const handlePreferencesChange = async (preferences: ViewPreferencesConfig) => {
        if (!currentUserId) return;
        try {
            await saveUserViewPreferences(currentUserId, 'creatives', preferences);
        } catch (error) {
            console.error('Failed to save view preferences:', error);
        }
    };

    const handleSaveForEveryone = async (preferences: ViewPreferencesConfig) => {
        try {
            const rowOrder = creatives.map(c => c.id);
            await saveSharedViewPreferences('creatives', {
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
            await deleteUserViewPreferences(currentUserId, 'creatives');
            setUserPreferences(null);
        } catch (error) {
            console.error('Failed to reset preferences:', error);
        }
    };

    // Reload creatives from database
    const reloadCreatives = useCallback(async () => {
        try {
            const items = await loadMediaFromDb();
            // Map user_id to creatives by matching uploaded_by name
            const creativesWithUserId = items.map(item => {
                const matchedUser = users.find(u => {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                    return fullName === item.uploadedBy || u.email === item.uploadedBy;
                });
                return { ...item, user_id: matchedUser?.id };
            });
            setCreatives(creativesWithUserId);
            saveMediaToCache(creativesWithUserId);
        } catch (error) {
            console.error('[Creatives] Failed to reload:', error);
        }
    }, [users]);

    const handleUploadComplete = useCallback(async (files: UploadedFile[]) => {
        // Only reload when all uploads are successful
        if (files.every(f => f.status === 'success')) {
            // Reload from database to get the actual records (avoids duplicates)
            await reloadCreatives();
        }
    }, [reloadCreatives]);

    const handleDelete = useCallback(async (id: string) => {
        const item = creatives.find(c => c.id === id);
        setCreatives((prev) => prev.filter((c) => c.id !== id));

        if (item?.dbId) {
            try {
                await deleteCreativeFromDb(item.dbId);
            } catch (err) {
                console.error('[Creatives] Failed to delete from DB:', err);
            }
        }
    }, [creatives]);

    const handleUpdate = useCallback(async (id: string, field: string, value: unknown) => {
        const item = creatives.find(c => c.id === id);
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
        setCreatives((prev) =>
            prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
        );

        // Update in database
        if (item.dbId) {
            const dbUpdates: Record<string, string | null> = {};
            for (const [key, val] of Object.entries(updates)) {
                if (key === 'project_id' || key === 'subproject_id' || key === 'name' || key === 'user_id') {
                    dbUpdates[key] = val as string | null;
                }
            }
            if (Object.keys(dbUpdates).length > 0) {
                try {
                    await updateCreativeInDb(item.dbId, dbUpdates);
                } catch (err) {
                    console.error('[Creatives] Failed to update in DB:', err);
                }
            }
        }
    }, [creatives, subprojects]);

    // Reorder Handler (for drag & drop) - persists to database
    const handleReorder = async (newOrder: string[]) => {
        const reordered = newOrder.map(id => creatives.find(c => c.id === id)!).filter(Boolean);
        setCreatives(reordered);

        // Save order to database
        if (currentUserId) {
            try {
                await saveRowOrder(currentUserId, 'creatives', newOrder);
            } catch (error) {
                console.error('Failed to save row order:', error);
            }
        }
    };

    // Color palette for dynamic colorMaps
    const colorPalette = [
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

    // Generate colorMaps for projects and subprojects
    const projectColorMap = projects.reduce((map, project, index) => {
        map[project.id] = colorPalette[index % colorPalette.length];
        return map;
    }, {} as Record<string, string>);

    const subprojectColorMap = subprojects.reduce((map, subproject, index) => {
        map[subproject.id] = colorPalette[index % colorPalette.length];
        return map;
    }, {} as Record<string, string>);

    // Column definitions
    const columns: ColumnDef<Creative>[] = [
        {
            key: 'preview',
            header: 'Preview',
            width: 80,
            minWidth: 60,
            editable: false,
            render: (_, row) => (
                <div
                    className="h-12 w-12 rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setPreviewItem(row)}
                >
                    {row.type === "video" && row.preview === row.url ? (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <Film className="h-5 w-5 text-gray-400" />
                        </div>
                    ) : (
                        <img
                            src={row.preview}
                            alt={row.name}
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>
            ),
        },
        {
            key: 'name',
            header: 'Name',
            width: 250,
            minWidth: 150,
            editable: false,
            type: 'text',
        },
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
                // Show all subprojects if no project selected, otherwise filter by project
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
            key: 'type',
            header: 'Type',
            width: 100,
            minWidth: 80,
            editable: false,
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
            key: 'sizeFormatted',
            header: 'Size',
            width: 100,
            minWidth: 80,
            editable: false,
            type: 'text',
        },
        {
            key: 'dimensions',
            header: 'Dimensions',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'text',
        },
        {
            key: 'user_id',
            header: 'Owner',
            width: 130,
            minWidth: 100,
            editable: user?.role === 'admin',
            type: 'people',
            users: users,
        },
        {
            key: 'uploadedAt',
            header: 'Date',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'date',
        },
    ];

    return (
        <DataTablePageLayout
            title="Creatives"
            onNewClick={() => setShowUploader(true)}
            newButtonLabel="Upload"
        >
            {/* Data Table */}
            <DataTable
                columns={columns}
                data={creatives}
                isLoading={isLoading}
                emptyMessage="No creatives found. Upload your first media to get started!"
                getRowId={(creative) => creative.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                sortable={true}
                onReorder={handleReorder}
                resizable={true}
                fullscreen={true}
                quickFilters={['project_id', 'subproject_id', 'type']}
                showRowActions={true}
                // View persistence
                viewId="creatives"
                userId={currentUserId || undefined}
                initialPreferences={userPreferences || undefined}
                sharedPreferences={sharedPreferences || undefined}
                onPreferencesChange={handlePreferencesChange}
                onSaveForEveryone={handleSaveForEveryone}
                onResetPreferences={handleResetPreferences}
                // Gallery view support
                cardColumns={4}
                renderCard={(creative, isSelected, onToggle) => {
                    const project = projects.find(p => p.id === creative.project_id);
                    const subproject = subprojects.find(s => s.id === creative.subproject_id);
                    const owner = users.find(u => u.id === creative.user_id);
                    const isVideo = creative.type === 'video';

                    return (
                        <div
                            onClick={onToggle}
                            className={`
                                relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all
                                ${isSelected
                                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                                    : 'border-gray-200 hover:border-gray-300'
                                }
                            `}
                        >
                            {/* Selection checkbox */}
                            <div className="absolute top-2 left-2 z-10">
                                <div
                                    className={`
                                        w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                                        ${isSelected
                                            ? 'bg-blue-500 border-blue-500 text-white'
                                            : 'bg-white/80 border-gray-300 backdrop-blur-sm'
                                        }
                                    `}
                                >
                                    {isSelected && <Check className="w-3 h-3" />}
                                </div>
                            </div>

                            {/* Media type badge */}
                            {isVideo && (
                                <div className="absolute top-2 right-2 z-10 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Play className="w-3 h-3" />
                                    Video
                                </div>
                            )}

                            {/* Preview Image */}
                            <div
                                className="aspect-square bg-gray-100 relative"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewItem(creative);
                                }}
                            >
                                {creative.preview && creative.preview !== creative.url ? (
                                    <img
                                        src={creative.preview}
                                        alt={creative.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : isVideo ? (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <Film className="w-12 h-12" />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <ImageIcon className="w-12 h-12" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-3 bg-white">
                                <div className="font-medium text-sm text-gray-900 truncate">
                                    {creative.name}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                    {creative.dimensions && (
                                        <span>{creative.dimensions}</span>
                                    )}
                                    {creative.sizeFormatted && (
                                        <>
                                            {creative.dimensions && <span>·</span>}
                                            <span>{creative.sizeFormatted}</span>
                                        </>
                                    )}
                                </div>
                                {(project || creative.uploadedAt) && (
                                    <div className="mt-2 flex items-center justify-between text-xs">
                                        {project && (
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded truncate max-w-[120px]">
                                                {project.name}
                                            </span>
                                        )}
                                        {creative.uploadedAt && (
                                            <span className="text-gray-400">
                                                {new Date(creative.uploadedAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {owner && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                        {owner.avatar_url ? (
                                            <img
                                                src={owner.avatar_url}
                                                alt=""
                                                className="w-4 h-4 rounded-full"
                                            />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full bg-gray-300" />
                                        )}
                                        <span className="truncate">
                                            {owner.first_name} {owner.last_name}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }}
            />

            {/* Upload Modal */}
            {showUploader && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto border border-border shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Upload Creative</h2>
                            <button
                                onClick={() => setShowUploader(false)}
                                className="p-1 hover:bg-muted rounded-md transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <CreativeUploader
                            onUploadComplete={(files) => {
                                handleUploadComplete(files);
                                if (files.every((f) => f.status === "success")) {
                                    setTimeout(() => setShowUploader(false), 500);
                                }
                            }}
                            maxFiles={10}
                            acceptedTypes="both"
                            userId={user?.id}
                            userName={user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Unknown'}
                        />
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewItem && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setPreviewItem(null)}
                >
                    <div
                        className="relative max-w-4xl w-full max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setPreviewItem(null)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <div className="bg-card rounded-xl overflow-hidden border border-border">
                            {previewItem.type === "image" ? (
                                <img
                                    src={previewItem.preview}
                                    alt={previewItem.name}
                                    className="w-full max-h-[70vh] object-contain"
                                />
                            ) : (
                                <div className="aspect-video bg-black flex items-center justify-center">
                                    <video
                                        src={previewItem.url}
                                        poster={previewItem.preview}
                                        className="w-full h-full max-h-[70vh]"
                                        controls
                                        playsInline
                                    />
                                </div>
                            )}
                            <div className="p-4 border-t border-border">
                                <h3 className="font-medium truncate">{previewItem.name}</h3>
                                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                                    <span>{previewItem.sizeFormatted}</span>
                                    {previewItem.dimensions && (
                                        <span>{previewItem.dimensions}</span>
                                    )}
                                    {previewItem.duration && (
                                        <span>{Math.floor(previewItem.duration / 60)}:{(previewItem.duration % 60).toString().padStart(2, "0")}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DataTablePageLayout>
    );
}
