import { useMemo } from "react";
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Globe, Play, Film } from "lucide-react";
import type { LaunchAdFormData } from "../types/launch";

interface AdPreviewProps {
    data: LaunchAdFormData;
}

const CTA_LABELS: Record<string, string> = {
    LEARN_MORE: "Learn More",
    SHOP_NOW: "Shop Now",
    SIGN_UP: "Sign Up",
    BOOK_TRAVEL: "Book Now",
    CONTACT_US: "Contact Us",
    DOWNLOAD: "Download",
    GET_OFFER: "Get Offer",
    GET_QUOTE: "Get Quote",
    ORDER_NOW: "Order Now",
    SUBSCRIBE: "Subscribe",
    WATCH_MORE: "Watch More",
    MESSAGE_PAGE: "Message",
    WHATSAPP_MESSAGE: "WhatsApp",
};

export function AdPreview({ data }: AdPreviewProps) {
    const creative = data.creative || {};
    const hasMedia = creative.mediaPreview || (creative.media?.length ?? 0) > 0;
    const mediaPreview = creative.mediaPreview || creative.media?.[0]?.preview;
    const isVideo = creative.mediaType === "video" || creative.media?.[0]?.type === "video";
    const ctaLabel = CTA_LABELS[creative.cta ?? ""] || "Learn More";

    const videoUrl = useMemo(() => {
        if (!isVideo) return null;
        const file = creative.media?.[0]?.file;
        if (file) return URL.createObjectURL(file);
        return null;
    }, [creative.media, isVideo]);

    // Extract domain from URL
    const getDomain = (url: string) => {
        try {
            return new URL(url).hostname.replace("www.", "");
        } catch {
            return "your-website.com";
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl max-w-[320px] mx-auto overflow-hidden shadow-lg font-sans text-black transform transition-all hover:scale-[1.02]">
            {/* Header */}
            <div className="p-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">
                        AD
                    </div>
                    <div>
                        <div className="font-semibold text-sm leading-tight">Your Page Name</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                            Sponsored <span aria-hidden="true">·</span> <Globe className="h-3 w-3" />
                        </div>
                    </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                    <MoreHorizontal className="h-5 w-5" />
                </button>
            </div>

            {/* Primary Text */}
            <div className="px-3 pb-3 text-sm leading-relaxed">
                {creative.primaryText || (
                    <span className="text-gray-400 italic">
                        Your primary text will appear here...
                    </span>
                )}
            </div>

            {/* Media */}
            <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
                {hasMedia && mediaPreview ? (
                    <>
                        {isVideo && videoUrl ? (
                            <video
                                src={videoUrl}
                                poster={mediaPreview}
                                className="w-full h-full object-cover"
                                controls
                                playsInline
                            />
                        ) : (
                            <>
                                <img
                                    src={mediaPreview}
                                    alt="Ad Creative"
                                    className="w-full h-full object-cover"
                                />
                                {isVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                        <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                            <Play className="h-7 w-7 text-gray-800 ml-1" fill="currentColor" />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Film className="h-12 w-12" />
                        <span className="text-sm">Media Preview</span>
                    </div>
                )}
            </div>

            {/* Headline & CTA */}
            <div className="bg-gray-50 p-3 flex items-center justify-between border-t border-gray-100">
                <div className="flex-1 min-w-0 mr-3">
                    <div className="text-xs text-gray-500 uppercase truncate font-medium">
                        {getDomain(creative.url ?? "")}
                    </div>
                    <div className="font-bold text-[15px] truncate leading-tight mt-0.5">
                        {creative.headline || (
                            <span className="text-gray-400 font-normal italic">Headline</span>
                        )}
                    </div>
                    {creative.description && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                            {creative.description}
                        </div>
                    )}
                </div>
                <button className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap shadow-sm">
                    {ctaLabel}
                </button>
            </div>

            {/* Engagement Stats */}
            <div className="px-3 py-2 flex items-center gap-3 text-xs text-gray-500 border-t border-gray-100">
                <div className="flex -space-x-1">
                    <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center text-white border border-white">
                        <ThumbsUp className="h-2.5 w-2.5" />
                    </div>
                    <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-white border border-white">
                        ❤️
                    </div>
                </div>
                <span>123</span>
                <span className="ml-auto">12 comments · 3 shares</span>
            </div>

            {/* Actions */}
            <div className="px-2 py-1 flex items-center justify-between text-gray-500 border-t border-gray-100">
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-gray-100 rounded-md transition-colors">
                    <ThumbsUp className="h-5 w-5" />
                    <span className="text-sm font-medium">Like</span>
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-gray-100 rounded-md transition-colors">
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Comment</span>
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-gray-100 rounded-md transition-colors">
                    <Share2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Share</span>
                </button>
            </div>
        </div>
    );
}
