import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import type { LaunchAdFormData, CreativeData } from "../../types/launch";
import type { FacebookPage, CallToActionType } from "../../types/facebook";

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

export function SectionCreative({ data, updateData, pages }: SectionCreativeProps) {
    const creative = data.creative || {};
    const [showCTADropdown, setShowCTADropdown] = useState(false);

    const updateCreative = (key: keyof CreativeData, value: string | undefined) => {
        updateData({
            ...data,
            creative: { ...creative, [key]: value },
        });
    };

    const selectedCTA = CTA_OPTIONS.find((opt) => opt.value === creative.cta);

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-5 w-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Creative</h3>
            </div>

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
                            onChange={(e) => updateCreative("pageId", e.target.value)}
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
                            onChange={(e) => updateCreative("headline", e.target.value)}
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
                            onChange={(e) => updateCreative("primaryText", e.target.value)}
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
                                                updateCreative("cta", option.value);
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
                            onChange={(e) => updateCreative("url", e.target.value)}
                            placeholder="https://yourwebsite.com/landing"
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>

                    {/* Image URL (optional) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Image URL <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <input
                            type="url"
                            value={creative.imageUrl || ""}
                            onChange={(e) => updateCreative("imageUrl", e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
