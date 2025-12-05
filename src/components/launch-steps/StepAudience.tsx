import { useState, useEffect } from "react";
import { MapPin, Users, Globe, Search, X, Loader2 } from "lucide-react";
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

    const updateAudience = (key: keyof AudienceData, value: any) => {
        updateData({
            ...data,
            audience: { ...audience, [key]: value },
        });
    };

    const addLocation = (loc: TargetingOption) => {
        const current = audience.locations || [];
        if (!current.find(l => l.key === loc.key)) {
            updateAudience("locations", [...current, loc]);
        }
        setLocationQuery("");
        setLocationResults([]);
    };

    const removeLocation = (key: string) => {
        updateAudience("locations", (audience.locations || []).filter(l => l.key !== key));
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
            <div>
                <h2 className="text-xl font-semibold">Define Your Audience</h2>
                <p className="text-muted-foreground">Who do you want to see your ads?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    {/* Location Targeting */}
                    <div className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <MapPin className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">Locations</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2 mb-2">
                                {audience.locations?.map((loc) => (
                                    <span key={loc.key} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-sm rounded-full">
                                        {loc.name}
                                        <button onClick={() => removeLocation(loc.key!)} className="hover:text-primary/70">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search locations..."
                                    value={locationQuery}
                                    onChange={(e) => setLocationQuery(e.target.value)}
                                    className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                {loadingLocation && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                                {locationResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                        {locationResults.map((result) => (
                                            <button
                                                key={result.key}
                                                onClick={() => addLocation(result)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                                            >
                                                <div className="font-medium">{result.name}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{result.type} · {result.country_code}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Demographics */}
                    <div className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">Demographics</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm text-muted-foreground">Age Range</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={13}
                                        max={65}
                                        value={audience.ageMin || 18}
                                        onChange={(e) => updateAudience("ageMin", parseInt(e.target.value))}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <span>-</span>
                                    <input
                                        type="number"
                                        min={13}
                                        max={65}
                                        value={audience.ageMax || 65}
                                        onChange={(e) => updateAudience("ageMax", parseInt(e.target.value))}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-muted-foreground">Gender</label>
                                <select
                                    value={audience.gender?.[0] || 0} // 0 is implied All if emtpy
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        updateAudience("gender", val === 0 ? [] : [val]);
                                    }}
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value={0}>All</option>
                                    <option value={1}>Men</option>
                                    <option value={2}>Women</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4 h-full">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">Detailed Targeting</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Interests & Behaviors</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {audience.interests?.map((interest) => (
                                    <span key={interest.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-600 text-sm rounded-full">
                                        {interest.name}
                                        <button onClick={() => removeInterest(interest.id)} className="hover:text-blue-800">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Add interests (e.g. Technology, Fashion)"
                                    value={interestQuery}
                                    onChange={(e) => setInterestQuery(e.target.value)}
                                    className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                {loadingInterest && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                                {interestResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                        {interestResults.map((result) => (
                                            <button
                                                key={result.id}
                                                onClick={() => addInterest(result)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                                            >
                                                <div className="font-medium">{result.name}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{result.type || 'Interest'}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground mt-auto">
                            <p>Audience Definition</p>
                            <p className="font-semibold text-foreground text-lg">
                                {audience.locations?.length ? 'Specific' : 'Broad'}
                            </p>
                            <p className="text-xs mt-1">
                                Potential Reach: <span className="font-medium text-foreground">Unavailable (Requires Ad Account context)</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
