import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Play, Image as ImageIcon, X, Maximize2 } from 'lucide-react';
import { getCreativeUrl } from '../lib/supabase-service';
import type { Ad, Creative, AdCopy, Project, Subproject } from '../lib/supabase-service';

interface AdPreviewCardProps {
    ad: Ad;
    creative?: Creative | null;
    headline?: AdCopy | null;
    primaryText?: AdCopy | null;
    description?: AdCopy | null;
    project?: Project | null;
    subproject?: Subproject | null;
    isSelected: boolean;
    onToggle: () => void;
    selectable?: boolean;
    projectColor?: string;
    subprojectColor?: string;
}

export function AdPreviewCard({
    ad,
    creative,
    headline,
    primaryText,
    description,
    project,
    subproject,
    isSelected,
    onToggle,
    selectable = true,
    projectColor,
    subprojectColor,
}: AdPreviewCardProps) {
    const [imageError, setImageError] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Get creative media URL
    const isVideo = creative?.type === 'video';
    const imageUrl = creative?.storage_path ? getCreativeUrl(creative.storage_path) : null;

    // Handle dimensions which can be Json type
    const dimensions = creative?.dimensions as { thumbnail?: string; width?: number; height?: number } | null;
    const thumbnailUrl = dimensions?.thumbnail
        ? getCreativeUrl(dimensions.thumbnail)
        : imageUrl;

    // Traffic and ad type color maps
    const trafficColors: Record<string, string> = {
        'FB': 'bg-teal-500 text-white',
        'IG': 'bg-rose-500 text-white',
        'All': 'bg-indigo-500 text-white',
    };

    const adTypeColors: Record<string, string> = {
        'Image': 'bg-blue-500 text-white',
        'Video': 'bg-purple-500 text-white',
        'Carousel': 'bg-amber-500 text-white',
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
                    relative rounded-lg border-2 overflow-hidden transition-all
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

                {/* Row number badge */}
                {ad.row_number && (
                    <div className="absolute top-2 right-2 z-10 bg-gray-800/80 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                        #{ad.row_number}
                    </div>
                )}

                {/* Preview Image */}
                <div className="aspect-[4/3] bg-gray-100 relative group">
                    {thumbnailUrl && !imageError ? (
                        isVideo ? (
                            <video
                                src={imageUrl || undefined}
                                poster={thumbnailUrl}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                            />
                        ) : (
                            <img
                                src={thumbnailUrl}
                                alt={creative?.name || 'Ad Creative'}
                                className="w-full h-full object-cover"
                                onError={() => setImageError(true)}
                            />
                        )
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <ImageIcon className="w-12 h-12" />
                        </div>
                    )}

                    {/* Video badge */}
                    {isVideo && (
                        <div className="absolute bottom-2 left-2 bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Play className="w-2.5 h-2.5" />
                            Video
                        </div>
                    )}

                    {/* Preview button overlay */}
                    {thumbnailUrl && !imageError && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            <button
                                onClick={handlePreviewClick}
                                className="p-2 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors"
                                title={isVideo ? "Play video" : "Preview image"}
                            >
                                {isVideo ? (
                                    <Play className="w-5 h-5 text-gray-800" />
                                ) : (
                                    <Maximize2 className="w-4 h-4 text-gray-800" />
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="p-3 bg-white space-y-2">
                    {/* Metadata pills */}
                    <div className="flex flex-wrap items-center gap-1">
                        {ad.traffic && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                trafficColors[ad.traffic] || 'bg-gray-100 text-gray-600'
                            }`}>
                                {ad.traffic}
                            </span>
                        )}
                        {ad.ad_type && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                adTypeColors[ad.ad_type] || 'bg-gray-100 text-gray-600'
                            }`}>
                                {ad.ad_type}
                            </span>
                        )}
                        {project && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium truncate max-w-[80px] ${
                                projectColor || 'bg-gray-100 text-gray-600'
                            }`}>
                                {project.name}
                            </span>
                        )}
                        {subproject && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium truncate max-w-[80px] ${
                                subprojectColor || 'bg-gray-100 text-gray-600'
                            }`}>
                                {subproject.name}
                            </span>
                        )}
                    </div>

                    {/* Headline */}
                    {headline?.text && (
                        <div>
                            <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Headline</div>
                            <p className="text-xs text-gray-700 line-clamp-1 font-medium">
                                {headline.text}
                            </p>
                        </div>
                    )}

                    {/* Primary Text */}
                    {primaryText?.text && (
                        <div>
                            <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Primary</div>
                            <p className="text-[11px] text-gray-600 line-clamp-2">
                                {primaryText.text}
                            </p>
                        </div>
                    )}

                    {/* Description */}
                    {description?.text && (
                        <div>
                            <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Description</div>
                            <p className="text-[11px] text-gray-500 line-clamp-1">
                                {description.text}
                            </p>
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
                        <div className="font-medium">Ad #{ad.row_number}</div>
                        {creative?.name && (
                            <div className="text-sm text-white/60">{creative.name}</div>
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
                                alt={creative?.name || 'Ad Creative'}
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
