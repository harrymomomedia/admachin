import { Image as ImageIcon, Upload } from "lucide-react";
import { AdPreview } from "../AdPreview";

interface StepCreativeProps {
    data: any;
    updateData: (data: any) => void;
}

export function StepCreative({ data, updateData }: StepCreativeProps) {
    const creative = data.creative || {};

    const updateCreative = (key: string, value: any) => {
        updateData({
            ...data,
            creative: { ...creative, [key]: value },
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">Ad Creative</h2>
                <p className="text-muted-foreground">Design your ad and see how it looks.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Ad Media</label>
                        <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="p-3 bg-primary/10 rounded-full mb-3">
                                <Upload className="h-6 w-6 text-primary" />
                            </div>
                            <p className="text-sm font-medium">Click to upload image or video</p>
                            <p className="text-xs text-muted-foreground mt-1">SVG, PNG, JPG or GIF (max. 800x400px)</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Primary Text</label>
                            <textarea
                                placeholder="Tell people what your ad is about..."
                                value={creative.primaryText || ""}
                                onChange={(e) => updateCreative("primaryText", e.target.value)}
                                className="w-full h-24 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Headline</label>
                            <input
                                type="text"
                                placeholder="Write a short headline"
                                value={creative.headline || ""}
                                onChange={(e) => updateCreative("headline", e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description (Optional)</label>
                            <input
                                type="text"
                                placeholder="Include additional details"
                                value={creative.description || ""}
                                onChange={(e) => updateCreative("description", e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Website URL</label>
                            <input
                                type="url"
                                placeholder="https://example.com"
                                value={creative.url || ""}
                                onChange={(e) => updateCreative("url", e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-6 flex flex-col items-center justify-center">
                    <div className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Ad Preview
                    </div>
                    <AdPreview data={data} />
                </div>
            </div>
        </div>
    );
}
