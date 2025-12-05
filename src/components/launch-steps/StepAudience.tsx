import { useState, useEffect } from "react";
import { MapPin, Search, X, Loader2, MinusCircle, PlusCircle } from "lucide-react";
import { searchTargeting } from "../../services/facebook/api";
import type { LaunchAdFormData, AudienceData } from "../../types/launch";
import type { TargetingOption } from "../../types/facebook";

interface StepAudienceProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
}

export function StepAudience({ data, updateData }: StepAudienceProps) {
    const audience = data.audience || {};

    // Search states
    const [locationQuery, setLocationQuery] = useState("");
    const [interestQuery, setInterestQuery] = useState("");
    const [locationResults, setLocationResults] = useState<TargetingOption[]>([]);
    const [interestResults, setInterestResults] = useState<TargetingOption[]>([]);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [loadingInterest, setLoadingInterest] = useState(false);

    // Default to include mode
    const [isExcludeMode, setIsExcludeMode] = useState(false);

    // Debounced search for Locations
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (locationQuery.length > 2) {
                setLoadingLocation(true);
                try {
                    const response = await searchTargeting(locationQuery, 'adgeolocation');
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

    // Debounced search for Interests
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (interestQuery.length > 2) {
                setLoadingInterest(true);
                try {
                    const response = await searchTargeting(interestQuery, 'adinterest');
                    setInterestResults(response.data as TargetingOption[]);
                } catch (e) {
                    console.error("Interest search failed", e);
                } finally {
                    setLoadingInterest(false);
                }
            } else {
                setInterestResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [interestQuery]);

    const updateAudience = (key: keyof AudienceData, value: AudienceData[keyof AudienceData]) => {
        updateData({
            ...data,
            audience: { ...audience, [key]: value },
        });
    };

    const addLocation = (loc: TargetingOption) => {
        if (isExcludeMode) {
            const current = audience.excludedLocations || [];
            if (!current.find(l => l.key === loc.key)) {
                updateAudience("excludedLocations", [...current, loc]);
            }
        } else {
            const current = audience.locations || [];
            if (!current.find(l => l.key === loc.key)) {
                updateAudience("locations", [...current, loc]);
            }
        }
        setLocationQuery("");
        setLocationResults([]);
    };

    const removeLocation = (key: string, isExcluded: boolean) => {
        if (isExcluded) {
            updateAudience("excludedLocations", (audience.excludedLocations || []).filter(l => l.key !== key));
        } else {
            updateAudience("locations", (audience.locations || []).filter(l => l.key !== key));
        }
    };

    const addInterest = (interest: TargetingOption) => {
        const current = audience.interests || [];
        if (!current.find(i => i.id === interest.id)) {
            updateAudience("interests", [...current, interest]);
        }
        setInterestQuery("");
        setInterestResults([]);
    };

    const removeInterest = (id: string) => {
        updateAudience("interests", (audience.interests || []).filter(i => i.id !== id));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Locations Card */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-5 w-5 text-gray-400" />
                        <h3 className="font-semibold text-gray-900">Locations</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Search Locations *</label>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs cursor-pointer px-2 py-1 rounded-md transition-colors ${!isExcludeMode ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setIsExcludeMode(false)}>
                                    Include
                                </span>
                                <span className={`text-xs cursor-pointer px-2 py-1 rounded-md transition-colors ${isExcludeMode ? 'bg-red-100 text-red-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setIsExcludeMode(true)}>
                                    Exclude
                                </span>
                            </div>

                            <div className="relative">
                                <div className={`absolute left-3 top-2.5 h-4 w-4 ${isExcludeMode ? 'text-red-400' : 'text-green-400'}`}>
                                    {isExcludeMode ? <MinusCircle className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                                </div>

                                <input
                                    type="text"
                                    placeholder={isExcludeMode ? "Search locations to exclude..." : "Search country, region, or city..."}
                                    value={locationQuery}
                                    onChange={(e) => setLocationQuery(e.target.value)}
                                    className={`w-full bg-white border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all ${isExcludeMode ? 'focus:ring-red-500/20 border-red-200' : 'focus:ring-green-500/20 border-gray-200'}`}
                                />
                                {loadingLocation && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />}

                                {locationResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                        {locationResults.map((result) => (
                                            <button
                                                key={result.key}
                                                onClick={() => addLocation(result)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="font-medium text-gray-900">{result.name}</div>
                                                <div className="text-xs text-gray-500 capitalize">{result.type} · {result.country_code}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Selected Locations List */}
                        <div className="space-y-2">
                            {(audience.locations?.length || 0) > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Included</p>
                                    <div className="flex flex-wrap gap-2">
                                        {audience.locations?.map((loc) => (
                                            <span key={loc.key} className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full border border-green-100">
                                                {loc.name}
                                                <button onClick={() => removeLocation(loc.key!, false)} className="hover:text-green-900 focus:outline-none">
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(audience.excludedLocations?.length || 0) > 0 && (
                                <div className="space-y-1 mt-3">
                                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Excluded</p>
                                    <div className="flex flex-wrap gap-2">
                                        {audience.excludedLocations?.map((loc) => (
                                            <span key={loc.key} className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-sm rounded-full border border-red-100">
                                                {loc.name}
                                                <button onClick={() => removeLocation(loc.key!, true)} className="hover:text-red-900 focus:outline-none">
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Audience / Demographics Card */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-full">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-5 w-5 bg-transparent" /> {/* Spacer/Icon placeholder */}
                        <h3 className="font-semibold text-gray-900">Audience</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="w-1/2 space-y-2">
                                <label className="text-sm font-medium text-gray-700">Age Range</label>
                                <div className="flex items-center gap-2">
                                    <div className="relative w-full">
                                        <input
                                            type="number"
                                            min={13}
                                            max={65}
                                            value={audience.ageMin || 18}
                                            onChange={(e) => updateAudience("ageMin", parseInt(e.target.value))}
                                            className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                    <span className="text-gray-400">to</span>
                                    <div className="relative w-full">
                                        <input
                                            type="number"
                                            min={13}
                                            max={65}
                                            value={audience.ageMax || 65}
                                            onChange={(e) => updateAudience("ageMax", parseInt(e.target.value))}
                                            className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="w-1/2 space-y-2">
                                <label className="text-sm font-medium text-gray-700">Gender</label>
                                <div className="flex rounded-md shadow-sm" role="group">
                                    {[
                                        { label: 'All', value: 0 },
                                        { label: 'Male', value: 1 },
                                        { label: 'Female', value: 2 }
                                    ].map((option, idx) => {
                                        const isSelected = (audience.gender?.[0] || 0) === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => updateAudience("gender", option.value === 0 ? [] : [option.value])}
                                                className={`
                                                    flex-1 px-3 py-2 text-sm font-medium border
                                                    ${idx === 0 ? 'rounded-l-lg' : ''}
                                                    ${idx === 2 ? 'rounded-r-lg' : ''}
                                                    ${idx !== 0 ? '-ml-px' : ''}
                                                    ${isSelected
                                                        ? 'bg-blue-50 text-blue-600 border-blue-200 z-10'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}
                                                    focus:outline-none
                                                `}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Detailed Targeting (Interests) - Visual separation */}
                        <div className="pt-6 border-t border-gray-100">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Detailed Targeting</label>
                                <p className="text-xs text-gray-500 mb-2">Include people who match</p>

                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Add demographics, interests or behaviors"
                                        value={interestQuery}
                                        onChange={(e) => setInterestQuery(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    {loadingInterest && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />}

                                    {interestResults.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                            {interestResults.map((result) => (
                                                <button
                                                    key={result.id}
                                                    onClick={() => addInterest(result)}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="font-medium text-gray-900">{result.name}</div>
                                                    <div className="text-xs text-gray-500 capitalize">{result.type || 'Interest'}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2 mt-2">
                                    {audience.interests?.map((interest) => (
                                        <span key={interest.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-100">
                                            {interest.name}
                                            <button onClick={() => removeInterest(interest.id)} className="hover:text-blue-900 focus:outline-none">
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
