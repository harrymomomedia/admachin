import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Play, Image as ImageIcon, X, Maximize2 } from 'lucide-react';
import { getCreativeUrl } from '../lib/supabase-service';

interface CardViewProps<T> {
    data: T[];
    getRowId: (row: T) => string;
    selectedIds?: Set<string>;
    onSelectionChange?: (selectedIds: Set<string>) => void;
    selectable?: boolean;
    renderCard: (item: T, isSelected: boolean, onToggle: () => void) => React.ReactNode;
    emptyMessage?: string;
    columns?: number;
}

export function CardView<T>({
    data,
    getRowId,
    selectedIds = new Set(),
    onSelectionChange,
    selectable = false,
    renderCard,
    emptyMessage = 'No items found',
    columns = 4,
}: CardViewProps<T>) {
    const handleToggle = (id: string) => {
        if (!onSelectionChange) return;
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        onSelectionChange(newSet);
    };

    const handleSelectAll = () => {
        if (!onSelectionChange) return;
        if (selectedIds.size === data.length) {
            onSelectionChange(new Set());
        } else {
            onSelectionChange(new Set(data.map(getRowId)));
        }
    };

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm py-12">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header with select all */}
            {selectable && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <span className="text-sm text-gray-600">
                        {selectedIds.size} of {data.length} selected
                    </span>
                    <button
                        onClick={handleSelectAll}
                        className="text-sm text-blue-600 hover:text-blue-700"
                    >
                        {selectedIds.size === data.length ? 'Deselect All' : 'Select All'}
                    </button>
                </div>
            )}

            {/* Card Grid */}
            <div className="flex-1 overflow-auto p-4">
                <div
                    className="grid gap-4"
                    style={{
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
                    }}
                >
                    {data.map((item) => {
                        const id = getRowId(item);
                        const isSelected = selectedIds.has(id);
                        return (
                            <div key={id}>
                                {renderCard(item, isSelected, () => handleToggle(id))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Pre-built Creative Card component
interface CreativeCardProps {
    creative: {
        id: string;
        name?: string | null;
        file_name?: string | null;
        file_url?: string | null;
        thumbnail_url?: string | null;
        // Database fields
        storage_path?: string | null;
        type?: 'image' | 'video' | string | null;
        media_type?: string | null;
        dimensions?: { width?: number; height?: number } | null;
        width?: number | null;
        height?: number | null;
        file_size?: number | null;
        project?: { name: string } | null;
        project_id?: string | null;
        subproject?: { name: string } | null;
        subproject_id?: string | null;
        user?: { first_name?: string; last_name?: string; avatar_url?: string | null } | null;
        user_id?: string | null;
        created_at?: string | null;
    };
    isSelected: boolean;
    onToggle: () => void;
    selectable?: boolean;
    /** Optional row number to display */
    rowNumber?: number;
    /** Show filename and filesize (default: true) */
    showFileInfo?: boolean;
    /** Project name override (for when project object is not loaded) */
    projectName?: string | null;
    /** Subproject name override (for when subproject object is not loaded) */
    subprojectName?: string | null;
    /** User name override (for when user object is not loaded) */
    userName?: string | null;
    /** Project color class */
    projectColor?: string;
    /** Subproject color class */
    subprojectColor?: string;
}

export function CreativeCard({
    creative,
    isSelected,
    onToggle,
    selectable = true,
    rowNumber,
    showFileInfo = true,
    projectName,
    subprojectName,
    userName,
    projectColor,
    subprojectColor,
}: CreativeCardProps) {
    const [imageError, setImageError] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Handle both field naming conventions
    const isVideo = creative.media_type === 'video' || creative.type === 'video';
    const imageUrl = creative.file_url || creative.thumbnail_url || (creative.storage_path ? getCreativeUrl(creative.storage_path) : null);
    const width = creative.width || creative.dimensions?.width;
    const height = creative.height || creative.dimensions?.height;

    // Resolved names (prefer overrides, then loaded objects)
    const displayProjectName = projectName || creative.project?.name;
    const displaySubprojectName = subprojectName || creative.subproject?.name;
    const displayUserName = userName || (creative.user ? `${creative.user.first_name || ''} ${creative.user.last_name || ''}`.trim() : null);

    const formatFileSize = (bytes: number | null | undefined) => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDateTime = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const handlePreviewClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowPreview(true);
    };

    return (
        <>
            <div
                onClick={selectable ? onToggle : undefined}
                className={`
                    relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all
                    ${isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                    ${selectable ? 'cursor-pointer' : 'cursor-default'}
                `}
            >
                {/* Selection checkbox */}
                {selectable && (
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
                )}

                {/* Media type badge */}
                {isVideo && (
                    <div className="absolute top-2 right-2 z-10 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        Video
                    </div>
                )}

                {/* Preview Image */}
                <div className="aspect-square bg-gray-100 relative group">
                    {imageUrl && !imageError ? (
                        isVideo ? (
                            <video
                                src={imageUrl}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                            />
                        ) : (
                            <img
                                src={imageUrl}
                                alt={creative.name || creative.file_name || 'Creative'}
                                className="w-full h-full object-cover"
                                onError={() => setImageError(true)}
                            />
                        )
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <ImageIcon className="w-12 h-12" />
                        </div>
                    )}

                    {/* Preview button overlay */}
                    {imageUrl && !imageError && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            <button
                                onClick={handlePreviewClick}
                                className="p-3 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors"
                                title={isVideo ? "Play video" : "Preview image"}
                            >
                                {isVideo ? (
                                    <Play className="w-6 h-6 text-gray-800" />
                                ) : (
                                    <Maximize2 className="w-5 h-5 text-gray-800" />
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="p-3 bg-white">
                    {/* Row number and name */}
                    <div className="flex items-center gap-2">
                        {rowNumber !== undefined && (
                            <span className="text-xs text-gray-400 font-medium">#{rowNumber}</span>
                        )}
                        {showFileInfo && (
                            <div className="font-medium text-sm text-gray-900 truncate flex-1">
                                {creative.name || creative.file_name || 'Untitled'}
                            </div>
                        )}
                    </div>

                    {/* Dimensions and file size (optional) */}
                    {showFileInfo && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                            {width && height && (
                                <span>{width}×{height}</span>
                            )}
                            {creative.file_size && (
                                <>
                                    <span>·</span>
                                    <span>{formatFileSize(creative.file_size)}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Project and Subproject pills */}
                    {(displayProjectName || displaySubprojectName) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                            {displayProjectName && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium truncate max-w-[100px] ${
                                    projectColor || 'bg-gray-100 text-gray-600'
                                }`}>
                                    {displayProjectName}
                                </span>
                            )}
                            {displaySubprojectName && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium truncate max-w-[100px] ${
                                    subprojectColor || 'bg-gray-100 text-gray-600'
                                }`}>
                                    {displaySubprojectName}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Created by */}
                    {displayUserName && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            {creative.user?.avatar_url ? (
                                <img
                                    src={creative.user.avatar_url}
                                    alt=""
                                    className="w-4 h-4 rounded-full"
                                />
                            ) : (
                                <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[8px] text-gray-500">
                                    {displayUserName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="truncate">{displayUserName}</span>
                        </div>
                    )}

                    {/* Date/time */}
                    {creative.created_at && (
                        <div className="mt-1 text-[10px] text-gray-400">
                            {formatDateTime(creative.created_at)}
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && imageUrl && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
                    onClick={() => setShowPreview(false)}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setShowPreview(false)}
                        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-8 h-8" />
                    </button>

                    {/* Title */}
                    <div className="absolute top-4 left-4 text-white">
                        <div className="font-medium">{creative.name || creative.file_name || 'Untitled'}</div>
                        {width && height && (
                            <div className="text-sm text-white/60">{width}×{height}</div>
                        )}
                    </div>

                    {/* Media */}
                    <div
                        className="max-w-[90vw] max-h-[85vh] relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isVideo ? (
                            <video
                                src={imageUrl}
                                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
                                controls
                                autoPlay
                            />
                        ) : (
                            <img
                                src={imageUrl}
                                alt={creative.name || creative.file_name || 'Creative'}
                                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
                            />
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
