import { Globe, Play, Film, Check } from 'lucide-react';
import type { Creative, AdCopy } from '../../lib/supabase-service';
import { getCreativeUrl } from '../../lib/supabase-service';
import { cn } from '../../utils/cn';

interface AdPreviewCardProps {
    creative: Creative | undefined;
    headline: AdCopy | undefined;
    primaryText: AdCopy | undefined;
    description: AdCopy | undefined;
    isSelected: boolean;
    onToggleSelect: () => void;
}

export function AdPreviewCard({
    creative,
    headline,
    primaryText,
    description,
    isSelected,
    onToggleSelect,
}: AdPreviewCardProps) {
    const mediaUrl = creative?.storage_path ? getCreativeUrl(creative.storage_path) : null;
    const isVideo = creative?.type === 'video';

    return (
        <div
            onClick={onToggleSelect}
            className={cn(
                "relative bg-white border rounded-lg overflow-hidden cursor-pointer transition-all",
                isSelected
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-gray-200 hover:border-gray-300 opacity-60"
            )}
        >
            {/* Selection Checkbox */}
            <div className="absolute top-2 left-2 z-10">
                <div
                    className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        isSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-white border-gray-300"
                    )}
                >
                    {isSelected && <Check className="w-3 h-3" />}
                </div>
            </div>

            {/* Header */}
            <div className="p-2 flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-white text-[8px] font-bold">
                    AD
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium truncate">Your Page</div>
                    <div className="text-[8px] text-gray-500 flex items-center gap-0.5">
                        Sponsored · <Globe className="h-2 w-2" />
                    </div>
                </div>
            </div>

            {/* Primary Text */}
            <div className="px-2 pb-1 text-[10px] text-gray-700 line-clamp-2 min-h-[28px]">
                {primaryText?.text || (
                    <span className="text-gray-400 italic">Primary text...</span>
                )}
            </div>

            {/* Media */}
            <div className="relative aspect-square bg-gray-100 flex items-center justify-center">
                {mediaUrl ? (
                    <>
                        {isVideo ? (
                            <div className="w-full h-full relative">
                                <video
                                    src={mediaUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <div className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center shadow">
                                        <Play className="h-4 w-4 text-gray-800 ml-0.5" fill="currentColor" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <img
                                src={mediaUrl}
                                alt="Ad Creative"
                                className="w-full h-full object-cover"
                            />
                        )}
                    </>
                ) : (
                    <Film className="w-8 h-8 text-gray-300" />
                )}
            </div>

            {/* Headline & CTA */}
            <div className="bg-gray-50 p-2 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold truncate">
                        {headline?.text || (
                            <span className="text-gray-400 font-normal italic">Headline</span>
                        )}
                    </div>
                    {description?.text && (
                        <div className="text-[8px] text-gray-500 truncate">
                            {description.text}
                        </div>
                    )}
                </div>
                <div className="bg-blue-600 text-white px-2 py-1 rounded text-[8px] font-medium whitespace-nowrap">
                    Learn More
                </div>
            </div>
        </div>
    );
}
