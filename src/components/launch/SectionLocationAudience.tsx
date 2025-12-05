import { useState, useEffect } from "react";
import { MapPin, Search, X, Loader2, Users } from "lucide-react";
import { searchTargeting } from "../../services/facebook/api";
import type { LaunchAdFormData, AudienceData } from "../../types/launch";
import type { TargetingOption } from "../../types/facebook";

interface SectionLocationAudienceProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
}

export function SectionLocationAudience({ data, updateData }: SectionLocationAudienceProps) {
    const audience = data.audience || {};

    // Search states
    const [locationQuery, setLocationQuery] = useState("");
    const [locationResults, setLocationResults] = useState<TargetingOption[]>([]);
    const [loadingLocation, setLoadingLocation] = useState(false);

    // Debounced search for Locations
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (locationQuery.length > 2) {
                setLoadingLocation(true);
                try {
                    const response = await searchTargeting(locationQuery, "adgeolocation");
                    setLocationResults(response.data as TargetingOption[]);
                } catch (e) {
                    console.error("Location search failed", e);
                } finally {
                    setLoadingLocation(false);
                }
            } else {
                setLocationResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [locationQuery]);

    const updateAudience = (key: keyof AudienceData, value: TargetingOption[] | number | number[]) => {
        updateData({
            ...data,
            audience: { ...audience, [key]: value },
        });
    };

    const addLocation = (loc: TargetingOption) => {
        const current = audience.locations || [];
        if (!current.find((l) => l.key === loc.key)) {
            updateAudience("locations", [...current, loc]);
        }
        setLocationQuery("");
        setLocationResults([]);
    };

    const removeLocation = (key: string) => {
        updateAudience("locations", (audience.locations || []).filter((l) => l.key !== key));
    };

    const genderValue = audience.gender?.[0] || 0; // 0 = all, 1 = male, 2 = female

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Locations Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">Locations</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Search Locations <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search country, region, or city..."
                                value={locationQuery}
                                onChange={(e) => setLocationQuery(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                            {loadingLocation && (
                                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />
                            )}

                            {locationResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                    {locationResults.map((result) => (
                                        <button
                                            key={result.key}
                                            onClick={() => addLocation(result)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="font-medium text-gray-900">{result.name}</div>
                                            <div className="text-xs text-gray-500 capitalize">
                                                {result.type} · {result.country_code}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Locations */}
                    {(audience.locations?.length || 0) > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {audience.locations?.map((loc) => (
                                <span
                                    key={loc.key}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-100"
                                >
                                    {loc.name}
                                    <button
                                        onClick={() => removeLocation(loc.key!)}
                                        className="hover:text-blue-900 focus:outline-none"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Audience Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">Audience</h3>
                </div>

                <div className="space-y-5">
                    {/* Age Range & Gender Row */}
                    <div className="flex gap-4">
                        {/* Age Range */}
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Age Range</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={18}
                                    max={65}
                                    value={audience.ageMin || 18}
                                    onChange={(e) => updateAudience("ageMin", parseInt(e.target.value))}
                                    className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                <span className="text-gray-400 text-sm">to</span>
                                <input
                                    type="number"
                                    min={18}
                                    max={65}
                                    value={audience.ageMax || 65}
                                    onChange={(e) => updateAudience("ageMax", parseInt(e.target.value))}
                                    className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>

                        {/* Gender */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Gender</label>
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                {[
                                    { label: "All", value: 0 },
                                    { label: "Male", value: 1 },
                                    { label: "Female", value: 2 },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            updateAudience("gender", option.value === 0 ? [] : [option.value])
                                        }
                                        className={`px-4 py-2 text-sm font-medium transition-colors ${genderValue === option.value
                                                ? "bg-blue-50 text-blue-600 border-blue-200"
                                                : "bg-white text-gray-700 hover:bg-gray-50"
                                            } ${option.value !== 0 ? "border-l border-gray-200" : ""}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
