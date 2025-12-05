// Facebook Marketing API Types

// ===== Authentication =====
export interface FacebookAuthResponse {
    accessToken: string;
    userID: string;
    expiresIn: number;
    signedRequest: string;
    graphDomain: string;
    data_access_expiration_time: number;
}

export interface FacebookLoginStatus {
    status: 'connected' | 'not_authorized' | 'unknown';
    authResponse: FacebookAuthResponse | null;
}

// ===== Campaign Structure =====
export type CampaignObjective =
    | 'OUTCOME_AWARENESS'
    | 'OUTCOME_ENGAGEMENT'
    | 'OUTCOME_LEADS'
    | 'OUTCOME_APP_PROMOTION'
    | 'OUTCOME_SALES'
    | 'OUTCOME_TRAFFIC';

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';

export interface Campaign {
    id: string;
    name: string;
    objective: CampaignObjective;
    status: CampaignStatus;
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
    created_time: string;
    updated_time: string;
    insights?: CampaignInsights;
}

export interface CreateCampaignParams {
    name: string;
    objective: CampaignObjective;
    status?: CampaignStatus;
    special_ad_categories?: string[];
    daily_budget?: number;
    lifetime_budget?: number;
    start_time?: string;
    stop_time?: string;
}

// ===== Ad Set =====
export type AdSetStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
export type BillingEvent = 'APP_INSTALLS' | 'CLICKS' | 'IMPRESSIONS' | 'LINK_CLICKS' | 'NONE' | 'OFFER_CLAIMS' | 'PAGE_LIKES' | 'POST_ENGAGEMENT' | 'THRUPLAY' | 'PURCHASE' | 'LISTING_INTERACTION';
export type OptimizationGoal = 'NONE' | 'APP_INSTALLS' | 'AD_RECALL_LIFT' | 'ENGAGED_USERS' | 'EVENT_RESPONSES' | 'IMPRESSIONS' | 'LEAD_GENERATION' | 'QUALITY_LEAD' | 'LINK_CLICKS' | 'OFFSITE_CONVERSIONS' | 'PAGE_LIKES' | 'POST_ENGAGEMENT' | 'QUALITY_CALL' | 'REACH' | 'LANDING_PAGE_VIEWS' | 'VISIT_INSTAGRAM_PROFILE' | 'VALUE' | 'THRUPLAY' | 'DERIVED_EVENTS' | 'CONVERSATIONS' | 'IN_APP_VALUE' | 'MESSAGING_APPOINTMENT_CONVERSION' | 'MESSAGING_PURCHASE_CONVERSION' | 'SUBSCRIBERS' | 'REMINDERS_SET';

export interface Targeting {
    geo_locations?: {
        countries?: string[];
        cities?: { key: string; radius?: number; distance_unit?: string }[];
        regions?: { key: string }[];
    };
    age_min?: number;
    age_max?: number;
    genders?: number[]; // 1 = male, 2 = female
    interests?: { id: string; name: string }[];
    behaviors?: { id: string; name: string }[];
    custom_audiences?: { id: string }[];
    excluded_custom_audiences?: { id: string }[];
    locales?: number[];
    publisher_platforms?: ('facebook' | 'instagram' | 'audience_network' | 'messenger')[];
    facebook_positions?: ('feed' | 'right_hand_column' | 'instant_article' | 'marketplace' | 'video_feeds' | 'story' | 'search' | 'reels' | 'profile_feed')[];
    instagram_positions?: ('stream' | 'story' | 'explore' | 'reels' | 'profile_feed' | 'ig_search' | 'explore_home')[];
}

export interface AdSet {
    id: string;
    name: string;
    campaign_id: string;
    status: AdSetStatus;
    daily_budget?: string;
    lifetime_budget?: string;
    bid_amount?: string;
    billing_event: BillingEvent;
    optimization_goal: OptimizationGoal;
    targeting: Targeting;
    start_time?: string;
    end_time?: string;
    created_time: string;
    updated_time: string;
}

export interface CreateAdSetParams {
    name: string;
    campaign_id: string;
    status?: AdSetStatus;
    daily_budget?: number;
    lifetime_budget?: number;
    bid_amount?: number;
    billing_event: BillingEvent;
    optimization_goal: OptimizationGoal;
    targeting: Targeting;
    start_time?: string;
    end_time?: string;
}

// ===== Creative & Ads =====
export interface AdCreative {
    id: string;
    name: string;
    title?: string;
    body?: string;
    image_url?: string;
    video_id?: string;
    call_to_action_type?: CallToActionType;
    link_url?: string;
    object_story_spec?: ObjectStorySpec;
}

export type CallToActionType =
    | 'BOOK_TRAVEL'
    | 'BUY_NOW'
    | 'CALL_NOW'
    | 'CONTACT_US'
    | 'DOWNLOAD'
    | 'GET_OFFER'
    | 'GET_QUOTE'
    | 'LEARN_MORE'
    | 'MESSAGE_PAGE'
    | 'OPEN_LINK'
    | 'ORDER_NOW'
    | 'PLAY_GAME'
    | 'SHOP_NOW'
    | 'SIGN_UP'
    | 'SUBSCRIBE'
    | 'WATCH_MORE'
    | 'WHATSAPP_MESSAGE';

export interface ObjectStorySpec {
    page_id: string;
    link_data?: {
        link: string;
        message?: string;
        name?: string;
        description?: string;
        caption?: string;
        image_hash?: string;
        call_to_action?: {
            type: CallToActionType;
            value?: { link?: string };
        };
    };
    video_data?: {
        video_id: string;
        title?: string;
        message?: string;
        call_to_action?: {
            type: CallToActionType;
            value?: { link?: string };
        };
    };
}

export interface Ad {
    id: string;
    name: string;
    adset_id: string;
    creative: AdCreative;
    status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
    created_time: string;
    updated_time: string;
}

export interface CreateAdParams {
    name: string;
    adset_id: string;
    creative: {
        creative_id?: string;
        // Or inline creative
        name?: string;
        object_story_spec?: ObjectStorySpec;
    };
    status?: 'ACTIVE' | 'PAUSED';
}

// ===== Insights & Analytics =====
export interface CampaignInsights {
    impressions: string;
    clicks: string;
    spend: string;
    reach: string;
    cpc: string;
    cpm: string;
    ctr: string;
    frequency: string;
    conversions?: string;
    cost_per_conversion?: string;
    actions?: InsightAction[];
    date_start: string;
    date_stop: string;
}

export interface InsightAction {
    action_type: string;
    value: string;
    cost?: string;
}

export type InsightLevel = 'account' | 'campaign' | 'adset' | 'ad';
export type InsightTimeIncrement = 1 | 7 | 28 | 'monthly' | 'yearly' | 'all_days';

export interface InsightParams {
    level?: InsightLevel;
    date_preset?: 'today' | 'yesterday' | 'this_week' | 'last_7d' | 'last_14d' | 'last_28d' | 'last_30d' | 'last_90d' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'maximum';
    time_range?: { since: string; until: string };
    time_increment?: InsightTimeIncrement;
    fields?: string[];
    breakdowns?: string[];
    filtering?: { field: string; operator: string; value: string }[];
}

// ===== API Responses =====
export interface FacebookPaginatedResponse<T> {
    data: T[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        };
        next?: string;
        previous?: string;
    };
}

export interface FacebookErrorResponse {
    error: {
        message: string;
        type: string;
        code: number;
        error_subcode?: number;
        fbtrace_id: string;
    };
}

// ===== Account & Business =====
export interface AdAccount {
    id: string;
    name: string;
    account_id: string;
    account_status: number;
    currency: string;
    timezone_name: string;
    amount_spent: string;
    balance: string;
    business?: {
        id: string;
        name: string;
    };
}

export interface FacebookPage {
    id: string;
    name: string;
    access_token?: string;
    category: string;
    picture?: {
        data: {
            url: string;
        };
    };
}

// ===== Image Upload =====
export interface AdImage {
    hash: string;
    url: string;
    name: string;
    width: number;
    height: number;
}

// ===== Video Upload =====
export interface AdVideo {
    id: string;
    title?: string;
    description?: string;
    source?: string;
    picture?: string;
    length?: number;
    width?: number;
    height?: number;
    status?: {
        video_status: 'ready' | 'processing' | 'error';
        processing_phase?: {
            status: string;
            progress: number;
        };
    };
    created_time?: string;
    updated_time?: string;
}

export interface VideoUploadSession {
    video_id: string;
    upload_session_id?: string;
    start_offset?: string;
    end_offset?: string;
}

// ===== SDK Window Extension =====
declare global {
    interface Window {
        FB: {
            init: (params: {
                appId: string;
                cookie?: boolean;
                xfbml?: boolean;
                version: string;
            }) => void;
            login: (
                callback: (response: FacebookLoginStatus) => void,
                options?: { scope: string; return_scopes?: boolean }
            ) => void;
            logout: (callback?: () => void) => void;
            getLoginStatus: (callback: (response: FacebookLoginStatus) => void) => void;
            api: (
                path: string,
                method?: 'get' | 'post' | 'delete',
                params?: Record<string, unknown>,
                callback?: (response: unknown) => void
            ) => void;
        };
        fbAsyncInit: () => void;
    }
}

export { };
