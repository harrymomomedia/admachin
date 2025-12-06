import { useState, useCallback, useEffect } from "react";
import {
    Upload,
    Image as ImageIcon,
    Film,
    Trash2,
    Search,
    Grid,
    List,
    Download,
    Eye,
    MoreVertical,
    Plus,
    CheckCircle,
    X,
} from "lucide-react";
import { CreativeUploader } from "../components/CreativeUploader";

interface MediaItem {
    id: string;
    name: string;
    type: "image" | "video";
    preview: string;
    url?: string; // Actual media URL
    size: number;
    uploadedAt: Date;
    uploadedBy?: string; // Who uploaded this creative
    hash?: string;
    dimensions?: { width: number; height: number };
    duration?: number; // for videos
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

// Sample data for demonstration
const SAMPLE_MEDIA: MediaItem[] = [
    {
        id: "1",
        name: "summer-sale-banner.jpg",
        type: "image",
        preview: "https://picsum.photos/seed/1/400/400",
        size: 245000,
        uploadedAt: new Date("2024-01-15"),
        uploadedBy: "Harry Jung",
        dimensions: { width: 1080, height: 1080 },
    },
    {
        id: "2",
        name: "product-demo.mp4",
        type: "video",
        preview: "https://picsum.photos/seed/2/400/400",
        url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        size: 12500000,
        uploadedAt: new Date("2024-01-10"),
        uploadedBy: "Marketing Team",
        dimensions: { width: 1920, height: 1080 },
        duration: 30,
    },
    {
        id: "3",
        name: "brand-story.jpg",
        type: "image",
        preview: "https://picsum.photos/seed/3/400/400",
        size: 189000,
        uploadedAt: new Date("2024-01-08"),
        uploadedBy: "Creative Team",
        dimensions: { width: 1080, height: 1920 },
    },
];

// Storage key for sharing with Launch page
const STORAGE_KEY = "admachin_creative_library";

// Save media to localStorage for sharing with other pages
function saveMediaLibrary(items: MediaItem[]): void {
    try {
        // Store simplified version for the launcher
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

// Load media from localStorage or use sample data
function loadMediaLibrary(): MediaItem[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Need to convert date strings back to Date objects and add missing fields
            return parsed.map((m: MediaItem) => ({
                ...m,
                size: m.size || 0,
                uploadedAt: m.uploadedAt ? new Date(m.uploadedAt) : new Date(),
            }));
        }
    } catch {
        // Ignore parse errors
    }
    return SAMPLE_MEDIA;
}

export function Creatives() {
    const [media, setMedia] = useState<MediaItem[]>(() => loadMediaLibrary());
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [filterType, setFilterType] = useState<"all" | "image" | "video">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [showUploader, setShowUploader] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

    // Save to localStorage whenever media changes
    useEffect(() => {
        saveMediaLibrary(media);
    }, [media]);


    const filteredMedia = media.filter((item) => {
        const matchesType = filterType === "all" || item.type === filterType;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesType && matchesSearch;
    });

    const handleUploadComplete = useCallback((files: UploadedFile[]) => {
        const newMedia: MediaItem[] = files.map((f, i) => ({
            id: `new-${Date.now()}-${i}`,
            name: f.file.name,
            type: f.type,
            preview: f.preview || f.url || "",
            url: f.type === 'video' ? URL.createObjectURL(f.file) : (f.url || f.preview),
            size: f.file.size,
            uploadedAt: new Date(),
            uploadedBy: "You", // TODO: Get from active FB profile
            hash: f.hash,
        }));
        setMedia((prev) => [...newMedia, ...prev]);
    }, []);

    const toggleSelection = (id: string) => {
        setSelectedItems((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const deleteSelected = () => {
        setMedia((prev) => prev.filter((item) => !selectedItems.has(item.id)));
        setSelectedItems(new Set());
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Creative Library</h1>
                    <p className="text-muted-foreground">
                        Manage your images and videos for ad campaigns
                    </p>
                </div>
                <button
                    onClick={() => setShowUploader(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                    <Plus className="h-4 w-4" />
                    Upload Media
                </button>
            </div>

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
                                    <span>{formatFileSize(previewItem.size)}</span>
                                    {previewItem.dimensions && (
                                        <span>
                                            {previewItem.dimensions.width} × {previewItem.dimensions.height}
                                        </span>
                                    )}
                                    {previewItem.duration && (
                                        <span>{formatDuration(previewItem.duration)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-4 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search media..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                {/* Filter */}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <button
                        onClick={() => setFilterType("all")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === "all"
                            ? "bg-background shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterType("image")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${filterType === "image"
                            ? "bg-background shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <ImageIcon className="h-3.5 w-3.5" />
                        Images
                    </button>
                    <button
                        onClick={() => setFilterType("video")}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${filterType === "video"
                            ? "bg-background shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <Film className="h-3.5 w-3.5" />
                        Videos
                    </button>
                </div>

                {/* View Mode */}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === "grid"
                            ? "bg-background shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <Grid className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === "list"
                            ? "bg-background shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <List className="h-4 w-4" />
                    </button>
                </div>

                {/* Bulk Actions */}
                {selectedItems.size > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm text-muted-foreground">
                            {selectedItems.size} selected
                        </span>
                        <button
                            onClick={deleteSelected}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {/* Media Grid/List */}
            {filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-4 bg-muted/50 rounded-full mb-4">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium mb-1">No media found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        {searchQuery || filterType !== "all"
                            ? "Try adjusting your filters"
                            : "Upload your first creative to get started"}
                    </p>
                    {!searchQuery && filterType === "all" && (
                        <button
                            onClick={() => setShowUploader(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                        >
                            <Upload className="h-4 w-4" />
                            Upload Media
                        </button>
                    )}
                </div>
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredMedia.map((item) => (
                        <div
                            key={item.id}
                            className={`group relative bg-muted/30 rounded-xl overflow-hidden border transition-all cursor-pointer ${selectedItems.has(item.id)
                                ? "border-primary ring-2 ring-primary/50"
                                : "border-border hover:border-primary/50"
                                }`}
                        >
                            {/* Selection Checkbox */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelection(item.id);
                                }}
                                className={`absolute top-2 left-2 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${selectedItems.has(item.id)
                                    ? "bg-primary border-primary"
                                    : "bg-black/30 border-white/50 opacity-0 group-hover:opacity-100"
                                    }`}
                            >
                                {selectedItems.has(item.id) && (
                                    <CheckCircle className="h-3 w-3 text-white" />
                                )}
                            </button>

                            {/* Media Type Badge */}
                            <div className="absolute top-2 right-2 z-10">
                                <div className="px-2 py-0.5 bg-black/60 text-white text-xs rounded-full flex items-center gap-1">
                                    {item.type === "image" ? (
                                        <ImageIcon className="h-3 w-3" />
                                    ) : (
                                        <>
                                            <Film className="h-3 w-3" />
                                            {item.duration && formatDuration(item.duration)}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Preview */}
                            <div
                                className="aspect-square"
                                onClick={() => setPreviewItem(item)}
                            >
                                <img
                                    src={item.preview}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* Hover Actions */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setPreviewItem(item)}
                                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                                >
                                    <Eye className="h-5 w-5 text-white" />
                                </button>
                                <button
                                    onClick={() => { }}
                                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                                >
                                    <Download className="h-5 w-5 text-white" />
                                </button>
                            </div>

                            {/* Info */}
                            <div className="p-2">
                                <p className="text-xs font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatFileSize(item.size)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedItems(new Set(filteredMedia.map((m) => m.id)));
                                            } else {
                                                setSelectedItems(new Set());
                                            }
                                        }}
                                        checked={
                                            selectedItems.size === filteredMedia.length &&
                                            filteredMedia.length > 0
                                        }
                                        className="rounded border-border"
                                    />
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Media
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Size
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Dimensions
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Uploaded By
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="p-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredMedia.map((item) => (
                                <tr
                                    key={item.id}
                                    className={`hover:bg-muted/30 transition-colors ${selectedItems.has(item.id) ? "bg-primary/5" : ""
                                        }`}
                                >
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.has(item.id)}
                                            onChange={() => toggleSelection(item.id)}
                                            className="rounded border-border"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                                <img
                                                    src={item.preview}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <span className="font-medium text-sm truncate max-w-[200px]">
                                                {item.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted">
                                            {item.type === "image" ? (
                                                <>
                                                    <ImageIcon className="h-3 w-3" />
                                                    Image
                                                </>
                                            ) : (
                                                <>
                                                    <Film className="h-3 w-3" />
                                                    Video
                                                </>
                                            )}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm text-muted-foreground">
                                        {formatFileSize(item.size)}
                                    </td>
                                    <td className="p-3 text-sm text-muted-foreground">
                                        {item.dimensions
                                            ? `${item.dimensions.width} × ${item.dimensions.height}`
                                            : "-"}
                                    </td>
                                    <td className="p-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                <span className="text-xs font-medium text-primary">
                                                    {(item.uploadedBy || "U").charAt(0)}
                                                </span>
                                            </div>
                                            <span className="text-muted-foreground">{item.uploadedBy || "Unknown"}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-sm text-muted-foreground">
                                        {item.uploadedAt.toLocaleDateString()}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => setPreviewItem(item)}
                                                className="p-1.5 hover:bg-muted rounded-md transition-colors"
                                            >
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                            <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                                                <Download className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                            <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Stats Footer */}
            <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t border-border">
                <span>
                    {filteredMedia.length} item{filteredMedia.length !== 1 ? "s" : ""}
                </span>
                <span>
                    Total size:{" "}
                    {formatFileSize(filteredMedia.reduce((sum, m) => sum + m.size, 0))}
                </span>
            </div>
        </div>
    );
}
