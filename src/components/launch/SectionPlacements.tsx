import { LayoutGrid } from "lucide-react";
import type { LaunchAdFormData, PlacementData, FacebookPositions, InstagramPositions, AudienceNetworkPositions, MessengerPositions } from "../../types/launch";

interface SectionPlacementsProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
}

const DEFAULT_FB_POSITIONS: FacebookPositions = {
    feed: true,
    rightColumn: true,
    instantArticles: true,
    marketplace: true,
    videoFeeds: true,
    stories: true,
    searchResults: true,
    inStreamVideos: true,
    reels: true,
};

const DEFAULT_IG_POSITIONS: InstagramPositions = {
    feed: true,
    stories: true,
    explore: true,
    reels: true,
    profileFeed: true,
    searchResults: true,
};

const DEFAULT_AN_POSITIONS: AudienceNetworkPositions = {
    nativeBannerInterstitial: true,
    rewardedVideo: true,
};

const DEFAULT_MSG_POSITIONS: MessengerPositions = {
    inbox: true,
    stories: true,
    sponsoredMessages: true,
};

const DEFAULT_PLACEMENTS: PlacementData = {
    advantagePlus: true,
    platforms: {
        facebook: true,
        instagram: true,
        messenger: true,
        audienceNetwork: true,
    },
    facebookPositions: DEFAULT_FB_POSITIONS,
    instagramPositions: DEFAULT_IG_POSITIONS,
    audienceNetworkPositions: DEFAULT_AN_POSITIONS,
    messengerPositions: DEFAULT_MSG_POSITIONS,
};

export function SectionPlacements({ data, updateData }: SectionPlacementsProps) {
    const placements = data.placements || DEFAULT_PLACEMENTS;

    const updatePlacements = (updates: Partial<PlacementData>) => {
        updateData({
            ...data,
            placements: { ...placements, ...updates },
        });
    };

    const togglePlatform = (platform: keyof PlacementData["platforms"]) => {
        updatePlacements({
            platforms: {
                ...placements.platforms,
                [platform]: !placements.platforms[platform],
            },
        });
    };

    const toggleFbPosition = (pos: keyof FacebookPositions) => {
        updatePlacements({
            facebookPositions: {
                ...placements.facebookPositions!,
                [pos]: !placements.facebookPositions![pos],
            },
        });
    };

    const toggleIgPosition = (pos: keyof InstagramPositions) => {
        updatePlacements({
            instagramPositions: {
                ...placements.instagramPositions!,
                [pos]: !placements.instagramPositions![pos],
            },
        });
    };

    const toggleAnPosition = (pos: keyof AudienceNetworkPositions) => {
        updatePlacements({
            audienceNetworkPositions: {
                ...placements.audienceNetworkPositions!,
                [pos]: !placements.audienceNetworkPositions![pos],
            },
        });
    };

    const toggleMsgPosition = (pos: keyof MessengerPositions) => {
        updatePlacements({
            messengerPositions: {
                ...placements.messengerPositions!,
                [pos]: !placements.messengerPositions![pos],
            },
        });
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">Placements</h3>
                </div>

                {/* Advantage+ Toggle */}
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Advantage+ Placements</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={placements.advantagePlus}
                            onChange={() => updatePlacements({ advantagePlus: !placements.advantagePlus })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            <p className="text-sm text-gray-500 mb-6">
                Select the platforms and positions where your ads will appear.
            </p>

            {/* Platforms Grid */}
            {!placements.advantagePlus && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Facebook */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={placements.platforms.facebook}
                                onChange={() => togglePlatform("facebook")}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-900">Facebook</span>
                        </label>
                        {placements.platforms.facebook && (
                            <div className="ml-6 space-y-1.5">
                                {[
                                    { key: "feed" as const, label: "Feed" },
                                    { key: "rightColumn" as const, label: "Right Column" },
                                    { key: "instantArticles" as const, label: "Instant Articles" },
                                    { key: "marketplace" as const, label: "Marketplace" },
                                    { key: "videoFeeds" as const, label: "Video Feeds" },
                                    { key: "stories" as const, label: "Stories" },
                                    { key: "searchResults" as const, label: "Search Results" },
                                    { key: "inStreamVideos" as const, label: "In-Stream Videos" },
                                    { key: "reels" as const, label: "Reels" },
                                ].map((pos) => (
                                    <label key={pos.key} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={placements.facebookPositions?.[pos.key] ?? true}
                                            onChange={() => toggleFbPosition(pos.key)}
                                            className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{pos.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Instagram */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={placements.platforms.instagram}
                                onChange={() => togglePlatform("instagram")}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-900">Instagram</span>
                        </label>
                        {placements.platforms.instagram && (
                            <div className="ml-6 space-y-1.5">
                                {[
                                    { key: "feed" as const, label: "Feed" },
                                    { key: "stories" as const, label: "Stories" },
                                    { key: "explore" as const, label: "Explore" },
                                    { key: "reels" as const, label: "Reels" },
                                    { key: "profileFeed" as const, label: "Profile Feed" },
                                    { key: "searchResults" as const, label: "Search Results" },
                                ].map((pos) => (
                                    <label key={pos.key} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={placements.instagramPositions?.[pos.key] ?? true}
                                            onChange={() => toggleIgPosition(pos.key)}
                                            className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{pos.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Audience Network */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={placements.platforms.audienceNetwork}
                                onChange={() => togglePlatform("audienceNetwork")}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-900">Audience Network</span>
                        </label>
                        {placements.platforms.audienceNetwork && (
                            <div className="ml-6 space-y-1.5">
                                {[
                                    { key: "nativeBannerInterstitial" as const, label: "Native, Banner, Interstitial" },
                                    { key: "rewardedVideo" as const, label: "Rewarded Video" },
                                ].map((pos) => (
                                    <label key={pos.key} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={placements.audienceNetworkPositions?.[pos.key] ?? true}
                                            onChange={() => toggleAnPosition(pos.key)}
                                            className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{pos.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Messenger */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={placements.platforms.messenger}
                                onChange={() => togglePlatform("messenger")}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-900">Messenger</span>
                        </label>
                        {placements.platforms.messenger && (
                            <div className="ml-6 space-y-1.5">
                                {[
                                    { key: "inbox" as const, label: "Inbox" },
                                    { key: "stories" as const, label: "Stories" },
                                    { key: "sponsoredMessages" as const, label: "Sponsored Messages" },
                                ].map((pos) => (
                                    <label key={pos.key} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={placements.messengerPositions?.[pos.key] ?? true}
                                            onChange={() => toggleMsgPosition(pos.key)}
                                            className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{pos.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {placements.advantagePlus && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
                    Advantage+ will automatically optimize your ad placements across all available positions for the best results.
                </div>
            )}
        </div>
    );
}
