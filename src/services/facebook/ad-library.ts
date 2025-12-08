// Facebook Ad Library API Service
import { FB_CONFIG } from './config';
import { getAccessToken } from './sdk';
import { FacebookApiError } from './api';

/**
 * Debug function to check token permissions and business info
 */
export async function debugTokenPermissions(): Promise<{
    userId: string;
    appId: string;
    permissions: string[];
    isValid: boolean;
    expiresAt?: string;
    businesses?: Array<{ id: string; name: string; verification_status?: string }>;
    error?: string;
}> {
    const accessToken = getAccessToken();

    if (!accessToken) {
        return {
            userId: '',
            appId: '',
            permissions: [],
            isValid: false,
            error: 'No access token found'
        };
    }

    try {
        // Get token debug info
        const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
        const debugResponse = await fetch(debugUrl);
        const debugData = await debugResponse.json();

        console.log('[FB Token Debug] Response:', JSON.stringify(debugData, null, 2));

        if (debugData.error) {
            return {
                userId: '',
                appId: '',
                permissions: [],
                isValid: false,
                error: debugData.error.message
            };
        }

        const tokenData = debugData.data;
        const userId = tokenData.user_id || '';

        // Try to fetch business info for this user/system user
        let businesses: Array<{ id: string; name: string; verification_status?: string }> = [];

        try {
            // Get businesses the user has access to
            const bizUrl = `https://graph.facebook.com/${FB_CONFIG.apiVersion}/me/businesses?access_token=${accessToken}&fields=id,name,verification_status`;
            const bizResponse = await fetch(bizUrl);
            const bizData = await bizResponse.json();

            console.log('[FB Business Debug] Response:', JSON.stringify(bizData, null, 2));

            if (bizData.data && Array.isArray(bizData.data)) {
                businesses = bizData.data.map((biz: { id: string; name: string; verification_status?: string }) => ({
                    id: biz.id,
                    name: biz.name,
                    verification_status: biz.verification_status
                }));
            }
        } catch (bizError) {
            console.error('[FB Business Debug] Error:', bizError);
        }

        return {
            userId,
            appId: tokenData.app_id || '',
            permissions: tokenData.scopes || [],
            isValid: tokenData.is_valid || false,
            expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : 'Never',
            businesses
        };
    } catch (error) {
        return {
            userId: '',
            appId: '',
            permissions: [],
            isValid: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Types for Ad Library
export interface FBAdLibrarySearchParams {
    search_terms?: string;
    ad_reached_countries: string; // e.g., 'US'
    ad_active_status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
    ad_delivery_date_min?: string; // YYYY-MM-DD
    ad_delivery_date_max?: string; // YYYY-MM-DD
    search_page_ids?: string; // comma-separated
    publisher_platforms?: string[]; // 'facebook', 'instagram', 'messenger', 'whatsapp'
    limit?: number; // max 1000
    after?: string; // pagination cursor
}

export interface FBAdLibraryAd {
    id: string;
    ad_creation_time: string;
    ad_creative_bodies?: string[];
    ad_creative_link_captions?: string[];
    ad_creative_link_descriptions?: string[];
    ad_creative_link_titles?: string[];
    ad_delivery_start_time?: string;
    ad_delivery_stop_time?: string | null
    ad_snapshot_url: string;
    age_country_gender_reach_breakdown?: Array<{
        age_range: string;
        country: string;
        gender: string;
        reach: number;
    }>;
    beneficiary_payers?: Array<{
        id: string;
        name: string;
    }>;
    bylines?: string;
    currency: string;
    delivery_by_region?: Array<{
        region: string;
        percentage: number;
    }>;
    demographic_distribution?: Array<{
        age: string;
        gender: string;
        percentage: number;
    }>;
    estimated_audience_size?: {
        lower_bound: number;
        upper_bound: number;
    };
    eu_total_reach?: number;
    impressions?: {
        lower_bound: number;
        upper_bound: number;
    };
    languages?: string[];
    page_id: string;
    page_name: string;
    publisher_platforms: string[];
    spend?: {
        lower_bound: number;
        upper_bound: number;
    };
}

export interface FBAdLibraryResponse {
    data: FBAdLibraryAd[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        };
        next?: string;
        previous?: string;
    };
}

/**
 * Search Facebook Ad Library
 */
export async function searchAdLibrary(
    params: FBAdLibrarySearchParams
): Promise<FBAdLibraryResponse> {
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('Not authenticated. Please login first.');
    }

    const url = new URL(FB_CONFIG.getApiUrl('/ads_archive'));
    url.searchParams.set('access_token', accessToken);

    // Required parameters
    url.searchParams.set('ad_reached_countries', params.ad_reached_countries);

    // Optional parameters
    if (params.search_terms) {
        url.searchParams.set('search_terms', params.search_terms);
    }
    if (params.ad_active_status) {
        url.searchParams.set('ad_active_status', params.ad_active_status);
    }
    if (params.ad_delivery_date_min) {
        url.searchParams.set('ad_delivery_date_min', params.ad_delivery_date_min);
    }
    if (params.ad_delivery_date_max) {
        url.searchParams.set('ad_delivery_date_max', params.ad_delivery_date_max);
    }
    if (params.search_page_ids) {
        url.searchParams.set('search_page_ids', params.search_page_ids);
    }
    if (params.publisher_platforms && params.publisher_platforms.length > 0) {
        url.searchParams.set('publisher_platforms', JSON.stringify(params.publisher_platforms));
    }

    // Pagination
    url.searchParams.set('limit', String(params.limit || 25));
    if (params.after) {
        url.searchParams.set('after', params.after);
    }

    // Fields to retrieve
    const fields = [
        'id',
        'ad_creation_time',
        'ad_creative_bodies',
        'ad_creative_link_captions',
        'ad_creative_link_descriptions',
        'ad_creative_link_titles',
        'ad_delivery_start_time',
        'ad_delivery_stop_time',
        'ad_snapshot_url',
        'age_country_gender_reach_breakdown',
        'beneficiary_payers',
        'bylines',
        'currency',
        'delivery_by_region',
        'demographic_distribution',
        'estimated_audience_size',
        'eu_total_reach',
        'impressions',
        'languages',
        'page_id',
        'page_name',
        'publisher_platforms',
        'spend',
    ].join(',');

    url.searchParams.set('fields', fields);

    try {
        const response = await fetch(url.toString());
        const data = await response.json();

        console.log('[FB Ad Library] Response status:', response.status);
        console.log('[FB Ad Library] Response data:', JSON.stringify(data, null, 2));

        if (data.error) {
            console.error('[FB Ad Library] API Error:', JSON.stringify(data.error, null, 2));
            throw new FacebookApiError(
                data.error.message || 'Unknown Facebook API error',
                data.error.code || 0,
                data.error.fbtrace_id || '',
                data.error.error_subcode
            );
        }

        return data as FBAdLibraryResponse;
    } catch (error) {
        console.error('[FB Ad Library] Fetch error:', error);
        throw error;
    }
}

/**
 * Get ad snapshot URL (redirects to full ad viewer)
 */
export function getAdSnapshotUrl(adId: string): string {
    return `https://www.facebook.com/ads/library/?id=${adId}`;
}

/**
 * Download media from Ad Library ad snapshot
 * This extracts media URLs from the ad snapshot page
 * Note: Currently a placeholder - needs server-side implementation
 */
export async function extractAdMedia(_snapshotUrl: string): Promise<{
    images: string[];
    videos: string[];
}> {
    try {
        // Note: Due to CORS, this needs to be done server-side or via proxy
        // For now, we'll return the snapshot URL itself
        // In production, you'd scrape the snapshot page or use FB's media endpoints
        return {
            images: [],
            videos: []
        };
    } catch (error) {
        console.error('Failed to extract media from ad snapshot:', error);
        return {
            images: [],
            videos: []
        };
    }
}

export default {
    searchAdLibrary,
    getAdSnapshotUrl,
    extractAdMedia,
};
