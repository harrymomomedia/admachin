import { useState } from 'react';
import { Check, Play, Image as ImageIcon } from 'lucide-react';
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
        // Database fields
        storage_path?: string | null;
        type?: 'image' | 'video' | string | null;
        media_type?: string | null;
        dimensions?: { width?: number; height?: number } | null;
        width?: number | null;
        height?: number | null;
        file_size?: number | null;
        project?: { name: string } | null;
        subproject?: { name: string } | null;
        user?: { first_name?: string; last_name?: string; avatar_url?: string | null } | null;
        created_at?: string | null;
    };
    isSelected: boolean;
    onToggle: () => void;
    selectable?: boolean;
}

export function CreativeCard({ creative, isSelected, onToggle, selectable = true }: CreativeCardProps) {
    const [imageError, setImageError] = useState(false);

    // Handle both field naming conventions
    const isVideo = creative.media_type === 'video' || creative.type === 'video';
    const imageUrl = creative.file_url || (creative.storage_path ? getCreativeUrl(creative.storage_path) : null);
    const width = creative.width || creative.dimensions?.width;
    const height = creative.height || creative.dimensions?.height;

    const formatFileSize = (bytes: number | null | undefined) => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    return (
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
            <div className="aspect-square bg-gray-100 relative">
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
            </div>

            {/* Info */}
            <div className="p-3 bg-white">
                <div className="font-medium text-sm text-gray-900 truncate">
                    {creative.name || creative.file_name || 'Untitled'}
                </div>
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
                {(creative.project || creative.created_at) && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                        {creative.project && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded truncate max-w-[120px]">
                                {creative.project.name}
                            </span>
                        )}
                        {creative.created_at && (
                            <span className="text-gray-400">{formatDate(creative.created_at)}</span>
                        )}
                    </div>
                )}
                {creative.user && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        {creative.user.avatar_url ? (
                            <img
                                src={creative.user.avatar_url}
                                alt=""
                                className="w-4 h-4 rounded-full"
                            />
                        ) : (
                            <div className="w-4 h-4 rounded-full bg-gray-300" />
                        )}
                        <span className="truncate">
                            {creative.user.first_name} {creative.user.last_name}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
