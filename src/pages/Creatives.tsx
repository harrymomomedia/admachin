import { useState, useCallback, useEffect } from "react";
import { X, Film } from "lucide-react";
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
    getUserViewPreferences,
    saveUserViewPreferences,
    getSharedViewPreferences,
    saveSharedViewPreferences,
    deleteUserViewPreferences,
} from "../lib/supabase-service";
import type { ViewPreferencesConfig, Project, Subproject } from "../lib/supabase-service";
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
    hash?: string;
    videoId?: string;
    dimensions?: string;
    duration?: number;
    dbId?: string;
    project_id?: string | null;
    subproject_id?: string | null;
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

    // Projects and subprojects
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);

    // View preferences
    const [userPreferences, setUserPreferences] = useState<ViewPreferencesConfig | null>(null);
    const [sharedPreferences, setSharedPreferences] = useState<ViewPreferencesConfig | null>(null);

    // Load data and preferences
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            try {
                const [items, projectsData, subprojectsData, userPrefs, sharedPrefs] = await Promise.all([
                    loadMediaFromDb(),
                    getProjects(),
                    getSubprojects(),
                    currentUserId ? getUserViewPreferences(currentUserId, 'creatives') : null,
                    getSharedViewPreferences('creatives'),
                ]);
                setCreatives(items);
                setProjects(projectsData);
                setSubprojects(subprojectsData);
                saveMediaToCache(items);
                setUserPreferences(userPrefs);
                setSharedPreferences(sharedPrefs);
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
            await saveSharedViewPreferences('creatives', preferences);
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

    const handleUploadComplete = useCallback((files: UploadedFile[]) => {
        const newCreatives: Creative[] = files.map((f, i) => ({
            id: `new-${Date.now()}-${i}`,
            name: f.file.name,
            type: f.type,
            preview: f.preview || f.url || "",
            url: f.type === 'video' ? URL.createObjectURL(f.file) : (f.url || f.preview),
            size: f.file.size,
            sizeFormatted: formatFileSize(f.file.size),
            uploadedAt: new Date().toISOString(),
            uploadedBy: user?.first_name || "You",
            hash: f.hash,
        }));
        setCreatives((prev) => [...newCreatives, ...prev]);
    }, [user]);

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
                if (key === 'project_id' || key === 'subproject_id' || key === 'name') {
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
                if (!row.project_id) return [];
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
            key: 'uploadedBy',
            header: 'Uploaded By',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'text',
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
