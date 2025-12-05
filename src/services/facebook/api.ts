// Facebook Marketing API Client

import { FB_CONFIG, getSelectedAdAccountId } from './config';
import { getAccessToken } from './sdk';
import type {
    Campaign,
    CreateCampaignParams,
    AdSet,
    CreateAdSetParams,
    Ad,
    CreateAdParams,
    AdAccount,
    FacebookPage,
    CampaignInsights,
    InsightParams,
    FacebookPaginatedResponse,
    AdImage,
    AdVideo,
    VideoUploadSession,
} from '../../types/facebook';

// Rate limit info parsed from headers
export interface RateLimitInfo {
    callCount: number;
    totalCpuTime: number;
    totalTime: number;
    estimatedTimeToRegainAccess?: number; // minutes until reset
}

class FacebookApiError extends Error {
    code: number;
    subcode?: number;
    fbtraceId: string;
    rateLimitInfo?: RateLimitInfo;

    constructor(
        message: string,
        code: number,
        fbtraceId: string,
        subcode?: number,
        rateLimitInfo?: RateLimitInfo
    ) {
        super(message);
        this.name = 'FacebookApiError';
        this.code = code;
        this.subcode = subcode;
        this.fbtraceId = fbtraceId;
        this.rateLimitInfo = rateLimitInfo;
    }
}

// Export for use in context
export { FacebookApiError };

/**
 * Parse rate limit info from Facebook's X-Business-Use-Case-Usage header
 */
function parseRateLimitHeader(response: Response): RateLimitInfo | undefined {
    const header = response.headers.get('X-Business-Use-Case-Usage');
    if (!header) return undefined;

    try {
        const parsed = JSON.parse(header);
        // The header is keyed by ad account ID, get the first one
        const accountData = Object.values(parsed)[0] as Array<{
            call_count: number;
            total_cputime: number;
            total_time: number;
            estimated_time_to_regain_access?: number;
        }>;

        if (accountData && accountData.length > 0) {
            const info = accountData[0];
            return {
                callCount: info.call_count,
                totalCpuTime: info.total_cputime,
                totalTime: info.total_time,
                estimatedTimeToRegainAccess: info.estimated_time_to_regain_access,
            };
        }
    } catch {
        // Header parsing failed, ignore
    }
    return undefined;
}

/**
 * Make an authenticated request to the Facebook Graph API
 */
async function apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
): Promise<T> {
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('Not authenticated. Please login first.');
    }

    const url = new URL(FB_CONFIG.getApiUrl(endpoint));
    url.searchParams.set('access_token', accessToken);

    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    } else if (body && method === 'GET') {
        // For GET requests, add body params as query strings
        Object.entries(body).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
        });
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();

    // Parse rate limit info from headers
    const rateLimitInfo = parseRateLimitHeader(response);

    if (data.error) {
        throw new FacebookApiError(
            data.error.message,
            data.error.code,
            data.error.fbtrace_id,
            data.error.error_subcode,
            rateLimitInfo
        );
    }

    return data as T;
}

// Helper to get ad account ID with validation
function requireAdAccountId(): string {
    const adAccountId = getSelectedAdAccountId();
    if (!adAccountId) {
        throw new Error('No ad account selected. Please select an ad account first.');
    }
    return adAccountId;
}

// ===== Account & Pages =====

/**
 * Get a specific Ad Account's details
 */
export async function getAdAccount(accountId?: string): Promise<AdAccount> {
    const adAccountId = accountId || requireAdAccountId();
    return apiRequest<AdAccount>(`/${adAccountId}`, 'GET', {
        fields: 'id,name,account_id,account_status,currency,timezone_name,amount_spent,balance,business{id,name}',
    });
}

/**
 * Get user's ad accounts
 */
export async function getAdAccounts(): Promise<FacebookPaginatedResponse<AdAccount>> {
    return apiRequest<FacebookPaginatedResponse<AdAccount>>('/me/adaccounts', 'GET', {
        fields: 'id,name,account_id,account_status,currency,timezone_name,amount_spent,balance,business{id,name}',
    });
}

/**
 * Get user's Facebook pages (needed for ad creatives)
 */
export async function getPages(): Promise<FacebookPaginatedResponse<FacebookPage>> {
    return apiRequest<FacebookPaginatedResponse<FacebookPage>>('/me/accounts', 'GET', {
        fields: 'id,name,access_token,category,picture{url}',
    });
}

// ===== Campaigns =====

/**
 * Get all campaigns for the ad account
 */
export async function getCampaigns(
    limit = 25,
    after?: string
): Promise<FacebookPaginatedResponse<Campaign>> {
    const adAccountId = requireAdAccountId();
    return apiRequest<FacebookPaginatedResponse<Campaign>>(`/${adAccountId}/campaigns`, 'GET', {
        fields: 'id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time',
        limit,
        ...(after && { after }),
    });
}

/**
 * Get a single campaign by ID
 */
export async function getCampaign(campaignId: string): Promise<Campaign> {
    return apiRequest<Campaign>(`/${campaignId}`, 'GET', {
        fields: 'id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time',
    });
}

/**
 * Create a new campaign
 */
export async function createCampaign(params: CreateCampaignParams): Promise<{ id: string }> {
    const adAccountId = requireAdAccountId();

    const body: Record<string, unknown> = {
        name: params.name,
        objective: params.objective,
        status: params.status || 'PAUSED',
        special_ad_categories: params.special_ad_categories || [],
    };

    if (params.daily_budget) {
        body.daily_budget = params.daily_budget * 100; // Convert to cents
    }
    if (params.lifetime_budget) {
        body.lifetime_budget = params.lifetime_budget * 100;
    }
    if (params.start_time) body.start_time = params.start_time;
    if (params.stop_time) body.stop_time = params.stop_time;

    return apiRequest<{ id: string }>(`/${adAccountId}/campaigns`, 'POST', body);
}

/**
 * Update a campaign
 */
export async function updateCampaign(
    campaignId: string,
    params: Partial<CreateCampaignParams>
): Promise<{ success: boolean }> {
    const body: Record<string, unknown> = {};

    if (params.name) body.name = params.name;
    if (params.status) body.status = params.status;
    if (params.daily_budget) body.daily_budget = params.daily_budget * 100;
    if (params.lifetime_budget) body.lifetime_budget = params.lifetime_budget * 100;

    return apiRequest<{ success: boolean }>(`/${campaignId}`, 'POST', body);
}

/**
 * Delete (archive) a campaign
 */
export async function deleteCampaign(campaignId: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/${campaignId}`, 'DELETE');
}

// ===== Ad Sets =====

/**
 * Get ad sets for a campaign
 */
export async function getAdSets(
    campaignId?: string,
    limit = 25
): Promise<FacebookPaginatedResponse<AdSet>> {
    const adAccountId = requireAdAccountId();
    const endpoint = campaignId
        ? `/${campaignId}/adsets`
        : `/${adAccountId}/adsets`;

    return apiRequest<FacebookPaginatedResponse<AdSet>>(endpoint, 'GET', {
        fields: 'id,name,campaign_id,status,daily_budget,lifetime_budget,bid_amount,billing_event,optimization_goal,targeting,start_time,end_time,created_time,updated_time',
        limit,
    });
}

/**
 * Create a new ad set
 */
export async function createAdSet(params: CreateAdSetParams): Promise<{ id: string }> {
    const adAccountId = requireAdAccountId();

    const body: Record<string, unknown> = {
        name: params.name,
        campaign_id: params.campaign_id,
        billing_event: params.billing_event,
        optimization_goal: params.optimization_goal,
        targeting: params.targeting,
        status: params.status || 'PAUSED',
    };

    if (params.daily_budget) body.daily_budget = params.daily_budget * 100;
    if (params.lifetime_budget) body.lifetime_budget = params.lifetime_budget * 100;
    if (params.bid_amount) body.bid_amount = params.bid_amount * 100;
    if (params.start_time) body.start_time = params.start_time;
    if (params.end_time) body.end_time = params.end_time;

    return apiRequest<{ id: string }>(`/${adAccountId}/adsets`, 'POST', body);
}

/**
 * Update an ad set
 */
export async function updateAdSet(
    adSetId: string,
    params: Partial<CreateAdSetParams>
): Promise<{ success: boolean }> {
    const body: Record<string, unknown> = {};

    if (params.name) body.name = params.name;
    if (params.status) body.status = params.status;
    if (params.targeting) body.targeting = params.targeting;
    if (params.daily_budget) body.daily_budget = params.daily_budget * 100;

    return apiRequest<{ success: boolean }>(`/${adSetId}`, 'POST', body);
}

// ===== Ads =====

/**
 * Get ads for an ad set or all ads
 */
export async function getAds(
    adSetId?: string,
    limit = 25
): Promise<FacebookPaginatedResponse<Ad>> {
    const adAccountId = requireAdAccountId();
    const endpoint = adSetId ? `/${adSetId}/ads` : `/${adAccountId}/ads`;

    return apiRequest<FacebookPaginatedResponse<Ad>>(endpoint, 'GET', {
        fields: 'id,name,adset_id,creative{id,name,title,body,image_url,video_id,call_to_action_type,link_url,object_story_spec},status,created_time,updated_time',
        limit,
    });
}

/**
 * Create a new ad
 */
export async function createAd(params: CreateAdParams): Promise<{ id: string }> {
    const adAccountId = requireAdAccountId();

    return apiRequest<{ id: string }>(`/${adAccountId}/ads`, 'POST', {
        name: params.name,
        adset_id: params.adset_id,
        creative: params.creative,
        status: params.status || 'PAUSED',
    });
}

// ===== Images =====

/**
 * Upload an image for use in ads
 */
export async function uploadImage(imageFile: File): Promise<AdImage> {
    const adAccountId = requireAdAccountId();
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('source', imageFile);
    formData.append('access_token', accessToken);

    const response = await fetch(
        FB_CONFIG.getApiUrl(`/${adAccountId}/adimages`),
        {
            method: 'POST',
            body: formData,
        }
    );

    const data = await response.json();

    if (data.error) {
        throw new FacebookApiError(
            data.error.message,
            data.error.code,
            data.error.fbtrace_id
        );
    }

    // Response contains images keyed by filename
    const imageKey = Object.keys(data.images)[0];
    return data.images[imageKey] as AdImage;
}

// ===== Videos =====

/**
 * Start a video upload session (for chunked uploads)
 */
export async function startVideoUpload(
    fileSize: number,
    fileName?: string
): Promise<VideoUploadSession> {
    const adAccountId = requireAdAccountId();
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('upload_phase', 'start');
    formData.append('file_size', fileSize.toString());
    formData.append('access_token', accessToken);
    if (fileName) {
        formData.append('file_name', fileName);
    }

    const response = await fetch(
        FB_CONFIG.getApiUrl(`/${adAccountId}/advideos`),
        {
            method: 'POST',
            body: formData,
        }
    );

    const data = await response.json();

    if (data.error) {
        throw new FacebookApiError(
            data.error.message,
            data.error.code,
            data.error.fbtrace_id
        );
    }

    return data as VideoUploadSession;
}

/**
 * Upload a video chunk
 */
export async function uploadVideoChunk(
    uploadSessionId: string,
    _videoId: string,
    chunk: Blob,
    startOffset: number
): Promise<{ start_offset: string; end_offset: string }> {
    const adAccountId = requireAdAccountId();
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('upload_phase', 'transfer');
    formData.append('upload_session_id', uploadSessionId);
    formData.append('start_offset', startOffset.toString());
    formData.append('video_file_chunk', chunk);
    formData.append('access_token', accessToken);

    const response = await fetch(
        FB_CONFIG.getApiUrl(`/${adAccountId}/advideos`),
        {
            method: 'POST',
            body: formData,
        }
    );

    const data = await response.json();

    if (data.error) {
        throw new FacebookApiError(
            data.error.message,
            data.error.code,
            data.error.fbtrace_id
        );
    }

    return data;
}

/**
 * Finish a video upload session
 */
export async function finishVideoUpload(
    uploadSessionId: string,
    _videoId: string,
    title?: string,
    description?: string
): Promise<{ success: boolean }> {
    const adAccountId = requireAdAccountId();
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('upload_phase', 'finish');
    formData.append('upload_session_id', uploadSessionId);
    formData.append('access_token', accessToken);
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);

    const response = await fetch(
        FB_CONFIG.getApiUrl(`/${adAccountId}/advideos`),
        {
            method: 'POST',
            body: formData,
        }
    );

    const data = await response.json();

    if (data.error) {
        throw new FacebookApiError(
            data.error.message,
            data.error.code,
            data.error.fbtrace_id
        );
    }

    return data;
}

/**
 * Upload a complete video file (for smaller videos < 1GB)
 */
export async function uploadVideo(
    videoFile: File,
    title?: string,
    description?: string
): Promise<AdVideo> {
    const adAccountId = requireAdAccountId();
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('source', videoFile);
    formData.append('access_token', accessToken);
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);

    const response = await fetch(
        FB_CONFIG.getApiUrl(`/${adAccountId}/advideos`),
        {
            method: 'POST',
            body: formData,
        }
    );

    const data = await response.json();

    if (data.error) {
        throw new FacebookApiError(
            data.error.message,
            data.error.code,
            data.error.fbtrace_id
        );
    }

    return data as AdVideo;
}

/**
 * Get video status and details
 */
export async function getVideoStatus(videoId: string): Promise<AdVideo> {
    return apiRequest<AdVideo>(`/${videoId}`, 'GET', {
        fields: 'id,title,description,source,picture,length,width,height,status,created_time,updated_time',
    });
}

/**
 * Get all ad videos for the account
 */
export async function getAdVideos(
    limit = 25
): Promise<FacebookPaginatedResponse<AdVideo>> {
    const adAccountId = requireAdAccountId();
    return apiRequest<FacebookPaginatedResponse<AdVideo>>(`/${adAccountId}/advideos`, 'GET', {
        fields: 'id,title,description,source,picture,length,width,height,status,created_time',
        limit,
    });
}

// ===== Insights & Analytics =====

/**
 * Get insights for the ad account
 */
export async function getAccountInsights(
    params: InsightParams = {}
): Promise<CampaignInsights[]> {
    const adAccountId = requireAdAccountId();

    const fields = params.fields?.join(',') ||
        'impressions,clicks,spend,reach,cpc,cpm,ctr,frequency,actions';

    const body: Record<string, unknown> = {
        fields,
        date_preset: params.date_preset || 'last_30d',
    };

    if (params.time_range) body.time_range = params.time_range;
    if (params.time_increment) body.time_increment = params.time_increment;
    if (params.breakdowns) body.breakdowns = params.breakdowns.join(',');
    if (params.level) body.level = params.level;

    const response = await apiRequest<FacebookPaginatedResponse<CampaignInsights>>(
        `/${adAccountId}/insights`,
        'GET',
        body
    );

    return response.data;
}

/**
 * Get insights for a specific campaign
 */
export async function getCampaignInsights(
    campaignId: string,
    params: InsightParams = {}
): Promise<CampaignInsights[]> {
    const fields = params.fields?.join(',') ||
        'impressions,clicks,spend,reach,cpc,cpm,ctr,frequency,actions';

    const body: Record<string, unknown> = {
        fields,
        date_preset: params.date_preset || 'last_30d',
    };

    if (params.time_range) body.time_range = params.time_range;
    if (params.time_increment) body.time_increment = params.time_increment;

    const response = await apiRequest<FacebookPaginatedResponse<CampaignInsights>>(
        `/${campaignId}/insights`,
        'GET',
        body
    );

    return response.data;
}

/**
 * Get insights broken down by time period
 */
export async function getInsightsOverTime(
    params: InsightParams & { increment?: 1 | 7 | 28 } = {}
): Promise<CampaignInsights[]> {
    return getAccountInsights({
        ...params,
        time_increment: params.increment || 1,
    });
}

export default {
    // Account
    getAdAccount,
    getAdAccounts,
    getPages,
    // Campaigns
    getCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    // Ad Sets
    getAdSets,
    createAdSet,
    updateAdSet,
    // Ads
    getAds,
    createAd,
    // Images
    uploadImage,
    // Videos
    uploadVideo,
    startVideoUpload,
    uploadVideoChunk,
    finishVideoUpload,
    getVideoStatus,
    getAdVideos,
    // Insights
    getAccountInsights,
    getCampaignInsights,
    getInsightsOverTime,
    refreshFacebookToken,
};

/**
 * Refresh a long-lived access token via server-side API
 */
export async function refreshFacebookToken(currentToken: string): Promise<{ access_token: string; expires_in: number }> {
    const response = await fetch('/api/auth/facebook/refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken: currentToken }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh token');
    }

    return data;
}



