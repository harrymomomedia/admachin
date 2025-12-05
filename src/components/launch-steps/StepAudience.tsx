import { MapPin, Users, Globe } from "lucide-react";
import type { LaunchAdFormData, AudienceData } from "../../types/launch";

interface StepAudienceProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
}

export function StepAudience({ data, updateData }: StepAudienceProps) {
    const audience = data.audience || {};

    const updateAudience = (key: keyof AudienceData, value: string) => {
        updateData({
            ...data,
            audience: { ...audience, [key]: value },
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">Define Your Audience</h2>
                <p className="text-muted-foreground">Who do you want to see your ads?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <MapPin className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">Location</h3>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Locations</label>
                            <input
                                type="text"
                                placeholder="Search locations (e.g. United States)"
                                value={audience.location || ""}
                                onChange={(e) => updateAudience("location", e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>

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
                                        placeholder="18"
                                        value={audience.ageMin || ""}
                                        onChange={(e) => updateAudience("ageMin", e.target.value)}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <span>-</span>
                                    <input
                                        type="number"
                                        placeholder="65+"
                                        value={audience.ageMax || ""}
                                        onChange={(e) => updateAudience("ageMax", e.target.value)}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-muted-foreground">Gender</label>
                                <select
                                    value={audience.gender || "all"}
                                    onChange={(e) => updateAudience("gender", e.target.value)}
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="all">All</option>
                                    <option value="men">Men</option>
                                    <option value="women">Women</option>
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
                            <textarea
                                placeholder="Add interests (e.g. Technology, Fashion, Sports)"
                                value={audience.interests || ""}
                                onChange={(e) => updateAudience("interests", e.target.value)}
                                className="w-full h-32 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                            />
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                            <p>Estimated Audience Size:</p>
                            <p className="font-semibold text-foreground text-lg">1.2M - 1.5M people</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
