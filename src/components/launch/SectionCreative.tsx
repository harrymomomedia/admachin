import { useState, useMemo } from "react";
import { Sparkles, ChevronDown, Image as ImageIcon, Film, X, Plus, Upload } from "lucide-react";
import type { LaunchAdFormData, CreativeData } from "../../types/launch";
import type { FacebookPage, CallToActionType } from "../../types/facebook";

interface MediaItem {
    id: string;
    name: string;
    type: "image" | "video";
    preview: string;
    url?: string;
    hash?: string;
    videoId?: string; // Facebook video ID for video creatives
}

interface SectionCreativeProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
    pages: FacebookPage[];
}

const CTA_OPTIONS: { value: CallToActionType; label: string }[] = [
    { value: "LEARN_MORE", label: "Learn More" },
    { value: "SHOP_NOW", label: "Shop Now" },
    { value: "SIGN_UP", label: "Sign Up" },
    { value: "BOOK_TRAVEL", label: "Book Now" },
    { value: "CONTACT_US", label: "Contact Us" },
    { value: "DOWNLOAD", label: "Download" },
    { value: "GET_OFFER", label: "Get Offer" },
    { value: "GET_QUOTE", label: "Get Quote" },
    { value: "ORDER_NOW", label: "Order Now" },
    { value: "SUBSCRIBE", label: "Subscribe" },
    { value: "WATCH_MORE", label: "Watch More" },
    { value: "MESSAGE_PAGE", label: "Send Message" },
    { value: "WHATSAPP_MESSAGE", label: "WhatsApp" },
];

// Load media from localStorage (simulating shared state with Creatives page)
const STORAGE_KEY = "admachin_creative_library";

function loadMediaLibrary(): MediaItem[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // Ignore parse errors
    }
    // Return sample data if nothing stored
    return [
        {
            id: "1",
            name: "summer-sale-banner.jpg",
            type: "image",
            preview: "https://picsum.photos/seed/1/400/400",
        },
        {
            id: "2",
            name: "product-demo.mp4",
            type: "video",
            preview: "https://picsum.photos/seed/2/400/400",
            url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        },
        {
            id: "3",
            name: "brand-story.jpg",
            type: "image",
            preview: "https://picsum.photos/seed/3/400/400",
        },
    ];
}

export function SectionCreative({ data, updateData, pages }: SectionCreativeProps) {
    const creative = data.creative || {};
    const [showCTADropdown, setShowCTADropdown] = useState(false);
    const [showMediaPicker, setShowMediaPicker] = useState(false);

    // Use lazy initializer to load media library once
    const [mediaLibrary] = useState<MediaItem[]>(() => loadMediaLibrary());

    // Derive selected media from creative state using useMemo
    const selectedMedia = useMemo(() => {
        if (creative.imageUrl || creative.mediaPreview) {
            const url = creative.imageUrl || creative.mediaPreview;
            return mediaLibrary.find(m => m.preview === url || m.url === url) || null;
        }
        return null;
    }, [mediaLibrary, creative.imageUrl, creative.mediaPreview]);

    const updateCreative = (updates: Partial<CreativeData>) => {
        updateData({
            ...data,
            creative: { ...creative, ...updates },
        });
    };

    const handleSelectMedia = (media: MediaItem) => {
        updateCreative({
            mediaPreview: media.preview,
            mediaType: media.type,
            imageUrl: media.type === "image" ? media.preview : undefined,
            imageHash: media.hash,
            videoId: media.type === "video" ? media.videoId : undefined,
            videoUrl: media.type === "video" ? media.url : undefined,
        });
        setShowMediaPicker(false);
    };

    const handleClearMedia = () => {
        updateCreative({
            mediaPreview: undefined,
            mediaType: undefined,
            imageUrl: undefined,
            imageHash: undefined,
        });
    };

    const selectedCTA = CTA_OPTIONS.find((opt) => opt.value === creative.cta);

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-5 w-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Creative</h3>
            </div>

            {/* Media Selection Section */}
            <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Ad Media <span className="text-gray-400 font-normal">(recommended)</span>
                </label>

                {selectedMedia ? (
                    <div className="relative inline-block">
                        <div className="relative w-48 h-48 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                            <img
                                src={selectedMedia.preview}
                                alt={selectedMedia.name}
                                className="w-full h-full object-cover"
                            />
                            {selectedMedia.type === "video" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <Film className="h-8 w-8 text-white" />
                                </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                <p className="text-white text-xs truncate">{selectedMedia.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClearMedia}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowMediaPicker(true)}
                        className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
                    >
                        <div className="p-3 bg-gray-100 rounded-full mb-2 group-hover:bg-blue-100">
                            <Plus className="h-6 w-6 text-gray-400 group-hover:text-blue-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600">
                            Select Media
                        </span>
                        <span className="text-xs text-gray-400 mt-1">From your library</span>
                    </button>
                )}
            </div>

            {/* Media Picker Modal */}
            {showMediaPicker && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Select Media</h3>
                            <button
                                onClick={() => setShowMediaPicker(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            {mediaLibrary.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="p-4 bg-gray-100 rounded-full mb-4">
                                        <Upload className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <h4 className="font-medium text-gray-900 mb-1">No media available</h4>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Upload media in the Creatives page first
                                    </p>
                                    <a
                                        href="/creatives"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        Go to Creatives
                                    </a>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {mediaLibrary.map((media) => (
                                        <button
                                            key={media.id}
                                            onClick={() => handleSelectMedia(media)}
                                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${selectedMedia?.id === media.id
                                                ? "border-blue-500 ring-2 ring-blue-500/30"
                                                : "border-transparent hover:border-gray-300"
                                                }`}
                                        >
                                            <img
                                                src={media.preview}
                                                alt={media.name}
                                                className="w-full h-full object-cover"
                                            />
                                            {media.type === "video" && (
                                                <div className="absolute top-2 right-2 p-1 bg-black/60 rounded-full">
                                                    <Film className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                            {media.type === "image" && (
                                                <div className="absolute top-2 right-2 p-1 bg-black/60 rounded-full">
                                                    <ImageIcon className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                                <p className="text-white text-xs truncate">{media.name}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                            <a
                                href="/creatives"
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Upload new media →
                            </a>
                            <button
                                onClick={() => setShowMediaPicker(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                    {/* Facebook Page */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Facebook Page <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={creative.pageId || ""}
                            onChange={(e) => updateCreative({ pageId: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            <option value="">Select a page</option>
                            {pages.map((page) => (
                                <option key={page.id} value={page.id}>
                                    {page.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Headline */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Headline <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={creative.headline || ""}
                            onChange={(e) => updateCreative({ headline: e.target.value })}
                            placeholder="e.g. Get 50% Off Today"
                            maxLength={40}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500">{creative.headline?.length || 0}/40</p>
                    </div>

                    {/* Primary Text */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Primary Text <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={creative.primaryText || ""}
                            onChange={(e) => updateCreative({ primaryText: e.target.value })}
                            placeholder="Write your ad copy here..."
                            rows={3}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                        />
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    {/* Call to Action */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Call to Action</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowCTADropdown(!showCTADropdown)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                <span className={selectedCTA ? "text-gray-900" : "text-gray-500"}>
                                    {selectedCTA?.label || "Learn More"}
                                </span>
                                <ChevronDown
                                    className={`h-4 w-4 text-gray-400 transition-transform ${showCTADropdown ? "rotate-180" : ""
                                        }`}
                                />
                            </button>
                            {showCTADropdown && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
                                    {CTA_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                updateCreative({ cta: option.value });
                                                setShowCTADropdown(false);
                                            }}
                                            className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${creative.cta === option.value ? "bg-blue-50 text-blue-600" : ""
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Link URL */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Link URL <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="url"
                            value={creative.url || ""}
                            onChange={(e) => updateCreative({ url: e.target.value })}
                            placeholder="https://yourwebsite.com/landing"
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>

                    {/* Description (optional) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Description <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={creative.description || ""}
                            onChange={(e) => updateCreative({ description: e.target.value })}
                            placeholder="Additional description text"
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
