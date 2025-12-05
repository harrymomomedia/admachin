import { useState } from "react";
import { Image as ImageIcon, Sparkles, Type, Link2, ChevronDown } from "lucide-react";
import { AdPreview } from "../AdPreview";
import { CreativeUploader } from "../CreativeUploader";
import type { CallToActionType } from "../../types/facebook";
import type { LaunchAdFormData, CreativeData, CreativeMedia } from "../../types/launch";

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

interface StepCreativeProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
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

export function StepCreative({ data, updateData }: StepCreativeProps) {
    const creative = data.creative || {};
    const [showCTADropdown, setShowCTADropdown] = useState(false);

    const updateCreative = (key: keyof CreativeData, value: CreativeMedia[] | string | undefined) => {
        updateData({
            ...data,
            creative: { ...creative, [key]: value },
        });
    };

    const handleUploadComplete = (files: UploadedFile[]) => {
        updateCreative("media", files);
        // Set the first file as the primary media
        if (files.length > 0) {
            const primary = files[0];
            updateCreative("mediaPreview", primary.preview);
            updateCreative("mediaType", primary.type);
            if (primary.hash) {
                updateCreative("imageHash", primary.hash);
            }
        }
    };

    const selectedCTA = CTA_OPTIONS.find((opt) => opt.value === creative.cta);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Ad Creative
                </h2>
                <p className="text-muted-foreground">
                    Upload your media and craft compelling ad copy.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Form */}
                <div className="space-y-6">
                    {/* Media Upload */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Media
                        </label>
                        <CreativeUploader
                            onUploadComplete={handleUploadComplete}
                            maxFiles={5}
                            acceptedTypes="both"
                        />
                    </div>

                    {/* Ad Copy */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Type className="h-4 w-4" />
                                Primary Text
                                <span className="text-xs text-muted-foreground font-normal">
                                    ({creative.primaryText?.length || 0}/125)
                                </span>
                            </label>
                            <textarea
                                placeholder="Tell people what your ad is about... Be clear, compelling, and action-oriented."
                                value={creative.primaryText || ""}
                                onChange={(e) =>
                                    updateCreative("primaryText", e.target.value)
                                }
                                maxLength={500}
                                className="w-full h-28 bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Headline
                                <span className="text-xs text-muted-foreground font-normal ml-2">
                                    ({creative.headline?.length || 0}/40)
                                </span>
                            </label>
                            <input
                                type="text"
                                placeholder="Write a catchy headline"
                                value={creative.headline || ""}
                                onChange={(e) =>
                                    updateCreative("headline", e.target.value)
                                }
                                maxLength={40}
                                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Description{" "}
                                <span className="text-muted-foreground font-normal">
                                    (Optional)
                                </span>
                            </label>
                            <input
                                type="text"
                                placeholder="Include additional details about your product or service"
                                value={creative.description || ""}
                                onChange={(e) =>
                                    updateCreative("description", e.target.value)
                                }
                                maxLength={125}
                                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Link2 className="h-4 w-4" />
                                    Website URL
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://example.com"
                                    value={creative.url || ""}
                                    onChange={(e) =>
                                        updateCreative("url", e.target.value)
                                    }
                                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Call to Action
                                </label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowCTADropdown(!showCTADropdown)
                                        }
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    >
                                        <span
                                            className={
                                                selectedCTA
                                                    ? ""
                                                    : "text-muted-foreground"
                                            }
                                        >
                                            {selectedCTA?.label || "Select CTA"}
                                        </span>
                                        <ChevronDown
                                            className={`h-4 w-4 text-muted-foreground transition-transform ${showCTADropdown
                                                ? "rotate-180"
                                                : ""
                                                }`}
                                        />
                                    </button>
                                    {showCTADropdown && (
                                        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
                                            {CTA_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        updateCreative(
                                                            "cta",
                                                            option.value
                                                        );
                                                        setShowCTADropdown(
                                                            false
                                                        );
                                                    }}
                                                    className={`w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors ${creative.cta ===
                                                        option.value
                                                        ? "bg-primary/10 text-primary"
                                                        : ""
                                                        }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Preview */}
                <div className="bg-gradient-to-br from-muted/50 to-muted/20 rounded-xl p-6 flex flex-col">
                    <div className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Live Preview
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <AdPreview data={data} />
                    </div>
                </div>
            </div>
        </div>
    );
}
