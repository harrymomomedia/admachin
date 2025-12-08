// Facebook Service - Main Export

export {
    FB_CONFIG,
    validateFBConfig,
    getSelectedAdAccountId,
    setSelectedAdAccountId,
    clearSelectedAdAccountId,
} from './config';
export {
    initFacebookSDK,
    checkLoginStatus,
    loginWithFacebook,
    logoutFromFacebook,
    getAccessToken,
    isAuthenticated,
} from './sdk';
export {
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
    // Insights
    getAccountInsights,
    getCampaignInsights,
    getInsightsOverTime,
    // Error class
    FacebookApiError,
    refreshFacebookToken,
} from './api';

// Re-export types
export type * from '../../types/facebook';

// Export Ad Library
export {
    searchAdLibrary,
    getAdSnapshotUrl,
    extractAdMedia,
    debugTokenPermissions,
} from './ad-library';
export type { FBAdLibrarySearchParams, FBAdLibraryAd, FBAdLibraryResponse } from './ad-library';
export type { RateLimitInfo } from './api';
