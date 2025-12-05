// Facebook SDK Configuration

export const FB_CONFIG = {
    appId: import.meta.env.VITE_FB_APP_ID || '',
    apiVersion: import.meta.env.VITE_FB_API_VERSION || 'v22.0',

    // Facebook Login for Business config ID (from Meta App Dashboard > Login for Business > Configurations)
    // This enables System User Access Tokens that NEVER expire
    configId: import.meta.env.VITE_FB_CONFIG_ID || '',

    // Required permissions for Marketing API
    permissions: [
        'ads_management',      // Create and manage ads
        'ads_read',            // Read ads data
        'business_management', // Manage business assets
        'pages_read_engagement', // Read page engagement
        'pages_show_list',     // Show pages
    ].join(','),

    // API Base URL
    getApiUrl: (endpoint: string) =>
        `https://graph.facebook.com/${FB_CONFIG.apiVersion}${endpoint}`,
};

// Get/set the selected ad account (stored in localStorage after user selects)
export const getSelectedAdAccountId = (): string | null => {
    return localStorage.getItem('fb_ad_account_id');
};

export const setSelectedAdAccountId = (accountId: string): void => {
    localStorage.setItem('fb_ad_account_id', accountId);
};

export const clearSelectedAdAccountId = (): void => {
    localStorage.removeItem('fb_ad_account_id');
};

// Validate configuration (only App ID required upfront)
export const validateFBConfig = (): { valid: boolean; missing: string[] } => {
    const missing: string[] = [];

    if (!FB_CONFIG.appId) missing.push('VITE_FB_APP_ID');

    return {
        valid: missing.length === 0,
        missing,
    };
};

export default FB_CONFIG;
