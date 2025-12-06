// Shared types for the ad launch flow

import type { TargetingOption } from './facebook';

// Creation modes for the launch page
export type CreationMode = 'new_campaign' | 'add_to_campaign' | 'add_to_adset';

export interface AudienceData {
    locations?: TargetingOption[];
    ageMin?: number;
    ageMax?: number;
    gender?: number[]; // FB API: 1=male, 2=female, default all
    interests?: TargetingOption[];
    excludedLocations?: TargetingOption[];
}

export interface BudgetData {
    type?: "daily" | "lifetime";
    amount?: string; // Kept as string for input handling, converted to cents for API in backend logic
    startDate?: string;
    endDate?: string;
}

export interface CreativeMedia {
    id: string;
    file: File;
    preview: string;
    type: "image" | "video";
    status: "uploading" | "success" | "error";
    progress: number;
    hash?: string;
    url?: string;
    error?: string;
}

export interface CreativeData {
    media?: CreativeMedia[];
    mediaPreview?: string;
    mediaType?: "image" | "video";
    imageHash?: string;
    imageUrl?: string; // Direct URL for simple image ads
    primaryText?: string;
    headline?: string;
    description?: string;
    url?: string;
    cta?: string;
    pageId?: string; // Facebook Page ID (required)
}

// Detailed placement positions per platform
export interface FacebookPositions {
    feed: boolean;
    rightColumn: boolean;
    instantArticles: boolean;
    marketplace: boolean;
    videoFeeds: boolean;
    stories: boolean;
    searchResults: boolean;
    inStreamVideos: boolean;
    reels: boolean;
}

export interface InstagramPositions {
    feed: boolean;
    stories: boolean;
    explore: boolean;
    reels: boolean;
    profileFeed: boolean;
    searchResults: boolean;
}

export interface AudienceNetworkPositions {
    nativeBannerInterstitial: boolean;
    rewardedVideo: boolean;
}

export interface MessengerPositions {
    inbox: boolean;
    stories: boolean;
    sponsoredMessages: boolean;
}

export interface PlacementData {
    advantagePlus: boolean; // true = automatic placements
    platforms: {
        facebook: boolean;
        instagram: boolean;
        messenger: boolean;
        audienceNetwork: boolean;
    };
    facebookPositions?: FacebookPositions;
    instagramPositions?: InstagramPositions;
    audienceNetworkPositions?: AudienceNetworkPositions;
    messengerPositions?: MessengerPositions;
}

export interface LaunchAdFormData {
    creationMode?: CreationMode;
    existingCampaignId?: string;
    existingAdSetId?: string;
    objective?: string;
    name?: string;
    adSetName?: string;
    audience?: AudienceData;
    creative?: CreativeData;
    budget?: BudgetData;
    placements?: PlacementData;
    specialAdCategories?: string[]; // CREDIT, HOUSING, EMPLOYMENT, ISSUES_ELECTIONS_POLITICS
    conversion?: {
        pixelId?: string;
        customEvent?: string; // e.g. LEAD, PURCHASE, COMPLETE_REGISTRATION
    };
}
