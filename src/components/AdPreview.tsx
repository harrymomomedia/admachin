import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Globe } from "lucide-react";

interface AdPreviewProps {
    data: any;
}

export function AdPreview({ data }: AdPreviewProps) {
    const creative = data.creative || {};

    return (
        <div className="bg-white border border-gray-200 rounded-lg max-w-[500px] mx-auto overflow-hidden shadow-sm font-sans text-black">
            {/* Header */}
            <div className="p-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0"></div>
                    <div>
                        <div className="font-semibold text-sm leading-tight">Your Page Name</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                            Sponsored <span aria-hidden="true">·</span> <Globe className="h-3 w-3" />
                        </div>
                    </div>
                </div>
                <button className="text-gray-500">
                    <MoreHorizontal className="h-5 w-5" />
                </button>
            </div>

            {/* Primary Text */}
            <div className="px-3 pb-2 text-sm whitespace-pre-wrap">
                {creative.primaryText || "Your primary text will appear here. Describe your product or service to grab attention."}
            </div>

            {/* Media */}
            <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-400">
                {creative.image ? (
                    <img src={creative.image} alt="Ad Creative" className="w-full h-full object-cover" />
                ) : (
                    <span>Image/Video Preview</span>
                )}
            </div>

            {/* Headline & CTA */}
            <div className="bg-gray-50 p-3 flex items-center justify-between border-b border-gray-100">
                <div className="flex-1 min-w-0 mr-2">
                    <div className="text-xs text-gray-500 uppercase truncate">your-website.com</div>
                    <div className="font-bold text-base truncate leading-tight">
                        {creative.headline || "Headline goes here"}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                        {creative.description || "Link description"}
                    </div>
                </div>
                <button className="bg-gray-200 hover:bg-gray-300 text-black px-4 py-1.5 rounded text-sm font-semibold transition-colors whitespace-nowrap">
                    Learn More
                </button>
            </div>

            {/* Engagement */}
            <div className="p-2 flex items-center justify-between text-gray-500 border-t border-gray-100">
                <button className="flex-1 flex items-center justify-center gap-2 py-1 hover:bg-gray-50 rounded">
                    <ThumbsUp className="h-5 w-5" />
                    <span className="text-sm font-medium">Like</span>
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-1 hover:bg-gray-50 rounded">
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Comment</span>
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-1 hover:bg-gray-50 rounded">
                    <Share2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Share</span>
                </button>
            </div>
        </div>
    );
}
