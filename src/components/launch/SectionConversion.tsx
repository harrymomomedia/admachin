import { useState, useEffect } from "react";
import { Target, AlertCircle } from "lucide-react";
import { getPixels, type Pixel } from "../../services/facebook/api";
import type { LaunchAdFormData } from "../../types/launch";

interface SectionConversionProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
    isConnected: boolean;
}

const CONVERSION_EVENTS = [
    { value: "LEAD", label: "Lead" },
    { value: "PURCHASE", label: "Purchase" },
    { value: "ADD_TO_CART", label: "Add to Cart" },
    { value: "COMPLETE_REGISTRATION", label: "Complete Registration" },
    { value: "CONTACT", label: "Contact" },
    { value: "SCHEDULE", label: "Schedule" },
    { value: "START_TRIAL", label: "Start Trial" },
    { value: "SUBMIT_APPLICATION", label: "Submit Application" },
    { value: "SUBSCRIBE", label: "Subscribe" },
    { value: "VIEW_CONTENT", label: "View Content" },
];

export function SectionConversion({ data, updateData, isConnected }: SectionConversionProps) {
    const [pixels, setPixels] = useState<Pixel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const objective = data.objective || "OUTCOME_TRAFFIC";
    const needsConversion = ["OUTCOME_LEADS", "OUTCOME_SALES"].includes(objective);

    useEffect(() => {
        const loadPixels = async () => {
            if (!isConnected) return;

            setLoading(true);
            try {
                const response = await getPixels();
                setPixels(response.data);

                // Auto-select first pixel if none selected
                if (response.data.length > 0 && !data.conversion?.pixelId) {
                    updateData({
                        ...data,
                        conversion: {
                            ...data.conversion,
                            pixelId: response.data[0].id,
                            customEvent: data.conversion?.customEvent || "LEAD"
                        }
                    });
                }
            } catch (err) {
                console.error("Failed to load pixels:", err);
                setError("Failed to load pixels");
            } finally {
                setLoading(false);
            }
        };

        if (needsConversion) {
            loadPixels();
        }
    }, [isConnected, needsConversion]);

    // Update default event based on objective
    useEffect(() => {
        if (!data.conversion?.customEvent) {
            let defaultEvent = "LEAD";
            if (objective === "OUTCOME_SALES") defaultEvent = "PURCHASE";

            updateData({
                ...data,
                conversion: {
                    ...data.conversion,
                    customEvent: defaultEvent
                }
            });
        }
    }, [objective]);


    if (!needsConversion) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
                <Target className="h-5 w-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Conversion Destination</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pixel Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                        Facebook Pixel <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={data.conversion?.pixelId || ""}
                        onChange={(e) => updateData({
                            ...data,
                            conversion: { ...data.conversion, pixelId: e.target.value }
                        })}
                        disabled={loading || pixels.length === 0}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">Select Pixel</option>
                        {pixels.map((pixel) => (
                            <option key={pixel.id} value={pixel.id}>
                                {pixel.name}
                            </option>
                        ))}
                    </select>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    {pixels.length === 0 && !loading && !error && (
                        <div className="flex items-center gap-2 text-yellow-600 text-xs mt-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>No Pixels found. Please create a Pixel in Events Manager.</span>
                        </div>
                    )}
                </div>

                {/* Conversion Event */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                        Conversion Event <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={data.conversion?.customEvent || ""}
                        onChange={(e) => updateData({
                            ...data,
                            conversion: { ...data.conversion, customEvent: e.target.value }
                        })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                        {CONVERSION_EVENTS.map((evt) => (
                            <option key={evt.value} value={evt.value}>
                                {evt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">
                <p>
                    Your ad will optimize for <strong>{CONVERSION_EVENTS.find(e => e.value === data.conversion?.customEvent)?.label || data.conversion?.customEvent}</strong> conversions using the selected Pixel.
                </p>
            </div>
        </div>
    );
}
