import { LayoutGrid } from "lucide-react";
import type { LaunchAdFormData, PlacementData } from "../../types/launch";

interface StepPlacementsProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
}

export function StepPlacements({ data, updateData }: StepPlacementsProps) {
    const placements: PlacementData = data.placements || {
        advantagePlus: true,
        platforms: {
            facebook: true,
            instagram: true,
            messenger: true,
            audienceNetwork: true,
        }
    };

    const updatePlacements = (key: keyof PlacementData, value: boolean | PlacementData["platforms"]) => {
        updateData({
            ...data,
            placements: { ...placements, [key]: value },
        });
    };

    const togglePlatform = (platform: keyof PlacementData['platforms']) => {
        updatePlacements("platforms", {
            ...placements.platforms,
            [platform]: !placements.platforms[platform]
        });
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
                <LayoutGrid className="h-5 w-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Placements</h3>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-medium text-gray-900">Advantage+ Placements</h4>
                        <p className="text-sm text-gray-500">Maximize your budget and help show your ads to more people.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={placements.advantagePlus}
                            onChange={() => updatePlacements("advantagePlus", !placements.advantagePlus)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none ring-offset-white rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {!placements.advantagePlus && (
                    <div className="pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <h4 className="font-medium text-gray-900 mb-4">Platforms</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all">
                                <input
                                    type="checkbox"
                                    checked={placements.platforms.facebook}
                                    onChange={() => togglePlatform("facebook")}
                                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="font-medium text-gray-900 block">Facebook</span>
                                    <span className="text-xs text-gray-500">Feed, Stories, Reels...</span>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all">
                                <input
                                    type="checkbox"
                                    checked={placements.platforms.instagram}
                                    onChange={() => togglePlatform("instagram")}
                                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="font-medium text-gray-900 block">Instagram</span>
                                    <span className="text-xs text-gray-500">Feed, Stories, Reels...</span>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all">
                                <input
                                    type="checkbox"
                                    checked={placements.platforms.audienceNetwork}
                                    onChange={() => togglePlatform("audienceNetwork")}
                                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="font-medium text-gray-900 block">Audience Network</span>
                                    <span className="text-xs text-gray-500">Third-party apps & sites</span>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all">
                                <input
                                    type="checkbox"
                                    checked={placements.platforms.messenger}
                                    onChange={() => togglePlatform("messenger")}
                                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="font-medium text-gray-900 block">Messenger</span>
                                    <span className="text-xs text-gray-500">Inbox, Stories...</span>
                                </div>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
