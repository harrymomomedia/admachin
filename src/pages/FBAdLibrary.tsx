import { useState, useEffect } from 'react';
import {
    Search,
    ExternalLink,
    Bookmark,
    BookmarkCheck,
    Calendar,
    Tag,
    Globe,
    Bug
} from 'lucide-react';
import {
    searchAdLibrary,
    getAdSnapshotUrl,
    debugTokenPermissions,
    type FBAdLibraryAd,
    type FBAdLibrarySearchParams
} from '../services/facebook';
import {
    getSavedFBAds,
    saveFBAd,
    deleteSavedFBAd,
    type FBAdLibrarySaved
} from '../lib/supabase-fb-ads-library';

interface TokenDebugInfo {
    userId: string;
    appId: string;
    permissions: string[];
    isValid: boolean;
    expiresAt?: string;
    businesses?: Array<{ id: string; name: string; verification_status?: string }>;
    error?: string;
}

export function FBAdLibrary() {
    const [searchTerm, setSearchTerm] = useState('');
    const [country, setCountry] = useState('US');
    const [activeStatus, setActiveStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
    const [searchResults, setSearchResults] = useState<FBAdLibraryAd[]>([]);
    const [savedAds, setSavedAds] = useState<FBAdLibrarySaved[]>([]);
    const [savedAdIds, setSavedAdIds] = useState<Set<string>>(new Set());
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
    const [error, setError] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false);
    const [tokenInfo, setTokenInfo] = useState<TokenDebugInfo | null>(null);


    // Load saved ads on mount
    useEffect(() => {
        loadSavedAds();
    }, []);

    const loadSavedAds = async () => {
        setIsLoadingSaved(true);
        try {
            const ads = await getSavedFBAds();
            setSavedAds(ads);
            setSavedAdIds(new Set(ads.map(ad => ad.fb_ad_id)));
        } catch (error) {
            console.error('Failed to load saved ads:', error);
        } finally {
            setIsLoadingSaved(false);
        }
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            setError('Please enter a search term');
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            const params: FBAdLibrarySearchParams = {
                search_terms: searchTerm,
                ad_reached_countries: country,
                ad_active_status: activeStatus,
                limit: 50
            };

            const response = await searchAdLibrary(params);
            setSearchResults(response.data || []);
        } catch (error: unknown) {
            console.error('Search failed:', error);
            let errorMessage = 'An unknown error has occurred.';
            let errorDetails = '';

            if (error instanceof Error) {
                errorMessage = error.message;
                errorDetails = `Error Type: ${error.name}\nMessage: ${error.message}`;

                // Include stack trace for debugging
                if (error.stack) {
                    errorDetails += `\nStack: ${error.stack.substring(0, 500)}`;
                }

                // Check if it has additional properties (like FB API error fields)
                const fbError = error as { code?: number; subcode?: number; fbtraceId?: string };
                if (fbError.code) {
                    errorDetails += `\nFB Error Code: ${fbError.code}`;
                }
                if (fbError.subcode) {
                    errorDetails += `\nFB Subcode: ${fbError.subcode}`;
                }
                if (fbError.fbtraceId) {
                    errorDetails += `\nFB Trace ID: ${fbError.fbtraceId}`;
                }
            } else {
                errorDetails = `Raw error: ${JSON.stringify(error)}`;
            }

            // Show full details in error message
            setError(`${errorMessage}\n\n--- Debug Info ---\n${errorDetails}`);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSaveAd = async (ad: FBAdLibraryAd) => {
        try {
            await saveFBAd({
                fb_ad_id: ad.id,
                page_name: ad.page_name,
                page_id: ad.page_id,
                ad_snapshot_url: ad.ad_snapshot_url,
                ad_creative_body: ad.ad_creative_bodies?.[0],
                ad_creative_link_title: ad.ad_creative_link_titles?.[0],
                ad_creative_link_description: ad.ad_creative_link_descriptions?.[0],
                ad_creative_link_caption: ad.ad_creative_link_captions?.[0],
                ad_creation_time: ad.ad_creation_time,
                ad_delivery_start_time: ad.ad_delivery_start_time,
                ad_delivery_stop_time: ad.ad_delivery_stop_time || undefined,
                spend: ad.spend,
                impressions: ad.impressions,
                demographic_distribution: ad.demographic_distribution,
                region_distribution: ad.delivery_by_region,
                publisher_platforms: ad.publisher_platforms,
                search_terms: searchTerm,
                search_country: country,
            });

            // Reload saved ads
            await loadSavedAds();
        } catch (error) {
            console.error('Failed to save ad:', error);
            alert('Failed to save ad. Please try again.');
        }
    };

    const handleUnsaveAd = async (adId: string) => {
        const savedAd = savedAds.find(ad => ad.fb_ad_id === adId);
        if (!savedAd) return;

        try {
            await deleteSavedFBAd(savedAd.id);
            await loadSavedAds();
        } catch (error) {
            console.error('Failed to unsave ad:', error);
            alert('Failed to unsave ad. Please try again.');
        }
    };

    const AdCard = ({ ad, isSaved }: { ad: FBAdLibraryAd | FBAdLibrarySaved; isSaved: boolean }) => {
        // FBAdLibraryAd has 'id', FBAdLibrarySaved has 'fb_ad_id'
        const isLibraryAd = 'id' in ad && !('fb_ad_id' in ad);
        const libraryAd = isLibraryAd ? ad as FBAdLibraryAd : null;
        const savedAd = !isLibraryAd ? ad as FBAdLibrarySaved : null;

        const adId = libraryAd ? libraryAd.id : savedAd?.fb_ad_id || '';
        const pageName = libraryAd ? libraryAd.page_name : savedAd?.page_name || 'Unknown';
        const body = libraryAd ? libraryAd.ad_creative_bodies?.[0] : savedAd?.ad_creative_body;
        const headline = libraryAd ? libraryAd.ad_creative_link_titles?.[0] : savedAd?.ad_creative_link_title;
        const displayUrl = libraryAd ? libraryAd.ad_creative_link_captions?.[0] : savedAd?.ad_creative_link_caption;
        const platforms = libraryAd ? libraryAd.publisher_platforms : savedAd?.publisher_platforms;
        const startDate = libraryAd ? libraryAd.ad_delivery_start_time : savedAd?.ad_delivery_start_time;

        // Parse media from saved ad
        const images = savedAd?.images as Array<{ public_url?: string; original_url?: string }> | null;
        const videos = savedAd?.videos as Array<{ public_url?: string; original_url?: string; poster?: string }> | null;

        return (
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{pageName}</h3>
                            {platforms && (
                                <div className="flex gap-1">
                                    {platforms.map(p => (
                                        <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {startDate && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {new Date(startDate).toLocaleDateString()}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => isSaved ? handleUnsaveAd(adId) : handleSaveAd(libraryAd!)}
                        className={`p-2 rounded-lg transition-colors ${isSaved
                            ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                        title={isSaved ? 'Unsave' : 'Save'}
                    >
                        {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                </div>

                {/* Ad Body */}
                {body && (
                    <p className="text-sm text-gray-700 mb-3 line-clamp-4">
                        {body}
                    </p>
                )}

                {/* Media Preview */}
                {(images?.length || videos?.length) ? (
                    <div className="mb-3 grid grid-cols-2 gap-2 max-h-48 overflow-hidden rounded-lg">
                        {videos?.slice(0, 1).map((v, i) => (
                            <div key={`v-${i}`} className="relative col-span-2 aspect-video bg-gray-100 rounded overflow-hidden">
                                {v.public_url ? (
                                    <video
                                        src={v.public_url}
                                        poster={v.poster}
                                        className="w-full h-full object-cover"
                                        controls={false}
                                        muted
                                    />
                                ) : v.poster ? (
                                    // Show poster image if video URL not available
                                    <img
                                        src={v.poster}
                                        alt="Video thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                ) : v.original_url && v.original_url !== 'blob_video' ? (
                                    <video
                                        src={v.original_url}
                                        className="w-full h-full object-cover"
                                        controls={false}
                                        muted
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400">
                                        <span className="text-xs">Video not available</span>
                                    </div>
                                )}
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                                    Video
                                </div>
                            </div>
                        ))}
                        {images?.slice(0, videos?.length ? 2 : 4).map((img, i) => (
                            <div key={`img-${i}`} className="aspect-square bg-gray-100 rounded overflow-hidden">
                                {img.public_url ? (
                                    <img
                                        src={img.public_url}
                                        alt={`Ad creative ${i + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                ) : img.original_url ? (
                                    <img
                                        src={img.original_url}
                                        alt={`Ad creative ${i + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400">
                                        <span className="text-xs">Image</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* Display URL & Headline */}
                {(displayUrl || headline) && (
                    <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                        {displayUrl && (
                            <div className="text-xs text-gray-500 uppercase tracking-wide">
                                {displayUrl}
                            </div>
                        )}
                        {headline && (
                            <div className="text-sm font-medium text-gray-900 line-clamp-2">
                                {headline}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <a
                        href={getAdSnapshotUrl(adId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                        <ExternalLink className="w-3 h-3" />
                        View on Facebook
                    </a>
                    {savedAd?.tags && savedAd.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                                {savedAd.tags.join(', ')}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">FB Ad Library</h1>
                        <p className="text-xs text-gray-500">Search and save ads from Facebook's Ad Library</p>
                    </div>
                    <button
                        onClick={async () => {
                            setShowDebug(!showDebug);
                            if (!tokenInfo) {
                                const info = await debugTokenPermissions();
                                setTokenInfo(info);
                            }
                        }}
                        className={`p-2 rounded-lg transition-colors ${showDebug ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        title="Debug Token"
                    >
                        <Bug className="w-4 h-4" />
                    </button>
                </div>

                {/* Debug Panel */}
                {showDebug && (
                    <div className="mt-3 p-4 bg-gray-900 rounded-lg text-xs font-mono text-green-400">
                        <div className="font-bold text-white mb-2">🔧 Token Debug Info</div>
                        {tokenInfo ? (
                            <div className="space-y-1">
                                <div>Status: <span className={tokenInfo.isValid ? 'text-green-400' : 'text-red-400'}>{tokenInfo.isValid ? '✓ Valid' : '✗ Invalid'}</span></div>
                                <div>User ID: {tokenInfo.userId || 'N/A'}</div>
                                <div>App ID: {tokenInfo.appId || 'N/A'}</div>
                                <div>Expires: {tokenInfo.expiresAt || 'N/A'}</div>

                                {/* Business Manager Info */}
                                <div className="mt-2 pt-2 border-t border-gray-700">
                                    <div className="text-white">Business Managers ({tokenInfo.businesses?.length || 0}):</div>
                                    {tokenInfo.businesses && tokenInfo.businesses.length > 0 ? (
                                        <div className="mt-1 space-y-1">
                                            {tokenInfo.businesses.map(biz => (
                                                <div key={biz.id} className="flex items-center gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded ${biz.verification_status === 'verified' ? 'bg-green-700' : 'bg-yellow-700'
                                                        }`}>
                                                        {biz.verification_status === 'verified' ? '✓' : '?'} {biz.name}
                                                    </span>
                                                    <span className="text-gray-500">ID: {biz.id}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-yellow-400 mt-1">No business managers found for this token</div>
                                    )}
                                </div>

                                <div className="mt-2 pt-2 border-t border-gray-700">
                                    <div className="text-white">Permissions ({tokenInfo.permissions.length}):</div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {tokenInfo.permissions.map(p => (
                                            <span key={p} className={`px-1.5 py-0.5 rounded ${p === 'ads_read' ? 'bg-green-700' : 'bg-gray-700'}`}>
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                    {!tokenInfo.permissions.includes('ads_read') && (
                                        <div className="mt-2 text-yellow-400">
                                            ⚠️ Missing 'ads_read' permission - required for Ad Library API
                                        </div>
                                    )}
                                </div>
                                {tokenInfo.error && (
                                    <div className="mt-2 text-red-400">Error: {tokenInfo.error}</div>
                                )}
                            </div>
                        ) : (
                            <div>Loading token info...</div>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
                <button
                    onClick={() => setActiveTab('search')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'search'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Search className="w-4 h-4 inline mr-2" />
                    Search
                </button>
                <button
                    onClick={() => setActiveTab('saved')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'saved'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Bookmark className="w-4 h-4 inline mr-2" />
                    Saved ({savedAds.length})
                </button>
            </div>

            {/* Search Tab */}
            {activeTab === 'search' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search Form */}
                    <div className="p-6 border-b border-gray-200 bg-gray-50">
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Search for ads (e.g., 'Nike shoes', 'Real estate')"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <select
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="US">🇺🇸 United States</option>
                                <option value="CA">🇨🇦 Canada</option>
                                <option value="GB">🇬🇧 United Kingdom</option>
                                <option value="AU">🇦🇺 Australia</option>
                                <option value="KR">🇰🇷 South Korea</option>
                            </select>
                            <select
                                value={activeStatus}
                                onChange={(e) => setActiveStatus(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="ALL">All Ads</option>
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                            <button
                                onClick={handleSearch}
                                disabled={isSearching}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSearching ? 'Searching...' : 'Search'}
                            </button>
                        </div>

                        {error && (
                            <div className={`mt-3 p-3 rounded-lg text-sm ${error.includes('Not authenticated') || error.includes('login')
                                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                                : 'bg-red-50 border border-red-200 text-red-700'
                                }`}>
                                {error.includes('Not authenticated') ? (
                                    <div className="flex items-center justify-between">
                                        <span>Please login with Facebook first to search the Ad Library.</span>
                                        <a
                                            href="/facebook/profiles"
                                            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                                        >
                                            Go to Facebook Login
                                        </a>
                                    </div>
                                ) : (
                                    <pre className="whitespace-pre-wrap font-mono text-xs overflow-auto max-h-64">{error}</pre>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Results */}
                    <div className="flex-1 overflow-auto p-6">
                        {isSearching ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                                    <p className="text-gray-500">Searching Facebook Ad Library...</p>
                                </div>
                            </div>
                        ) : searchResults.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {searchResults.map((ad) => (
                                    <AdCard key={ad.id} ad={ad} isSaved={savedAdIds.has(ad.id)} />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Globe className="w-16 h-16 text-gray-300 mb-4" />
                                <p className="text-gray-500 mb-2">No search results yet</p>
                                <p className="text-sm text-gray-400">Enter a search term above to find ads</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Saved Tab */}
            {activeTab === 'saved' && (
                <div className="flex-1 overflow-auto p-6">
                    {isLoadingSaved ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                                <p className="text-gray-500">Loading saved ads...</p>
                            </div>
                        </div>
                    ) : savedAds.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {savedAds.map((ad) => (
                                <AdCard key={ad.id} ad={ad} isSaved={true} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Bookmark className="w-16 h-16 text-gray-300 mb-4" />
                            <p className="text-gray-500 mb-2">No saved ads yet</p>
                            <p className="text-sm text-gray-400">Search and save ads to see them here</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
