// Facebook SDK Initialization and Auth

import { FB_CONFIG } from './config';
import type { FacebookLoginStatus } from '../../types/facebook';

let sdkInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Load and initialize the Facebook SDK
 */
export const initFacebookSDK = (): Promise<void> => {
    if (sdkInitialized) {
        return Promise.resolve();
    }

    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = new Promise((resolve, reject) => {
        // Check if FB SDK script already exists
        if (document.getElementById('facebook-jssdk')) {
            if (window.FB) {
                sdkInitialized = true;
                resolve();
            }
            return;
        }

        // Define the async init callback
        window.fbAsyncInit = () => {
            window.FB.init({
                appId: FB_CONFIG.appId,
                cookie: true,
                xfbml: true,
                version: FB_CONFIG.apiVersion,
            });

            sdkInitialized = true;
            console.log('[Facebook SDK] Initialized successfully');
            resolve();
        };

        // Load the SDK script
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            reject(new Error('Failed to load Facebook SDK'));
        };

        const firstScript = document.getElementsByTagName('script')[0];
        firstScript.parentNode?.insertBefore(script, firstScript);

        // Timeout after 10 seconds
        setTimeout(() => {
            if (!sdkInitialized) {
                reject(new Error('Facebook SDK initialization timed out'));
            }
        }, 10000);
    });

    return initializationPromise;
};

/**
 * Check if user is already logged in
 */
export const checkLoginStatus = (): Promise<FacebookLoginStatus> => {
    return new Promise((resolve, reject) => {
        if (!window.FB) {
            reject(new Error('Facebook SDK not initialized'));
            return;
        }

        window.FB.getLoginStatus((response) => {
            resolve(response);
        });
    });
};

/**
 * Login to Facebook with Marketing API permissions
 * 
 * This uses FB.login with business permissions.
 * For Facebook Login for Business, ensure your app is configured as a
 * "Business" type app in Meta Developer Dashboard with the 
 * "Facebook Login for Business" product added.
 * 
 * Token types:
 * - User Access Token (UAT): For personal Facebook accounts
 * - System User Access Token (SUAT): For business portfolios (longer-lived)
 */
/**
 * Login to Facebook using Client-Side SDK
 * 
 * Uses the Facebook JavaScript SDK to handle authentication in the browser.
 * Sends the resulting access token to our backend for storage.
 */
export const loginWithFacebook = (): Promise<{ success: boolean; user?: any; error?: string }> => {
    return new Promise((resolve) => {
        if (!window.FB) {
            resolve({ success: false, error: 'Facebook SDK not initialized' });
            return;
        }

        console.log('[Facebook Auth] Starting FB.login()...');

        // Request permissions
        const scope = 'ads_management,ads_read,pages_read_engagement,pages_show_list';

        window.FB.login(async (response) => {
            console.log('[Facebook Auth] FB.login() response:', response.status);

            if (response.status !== 'connected') {
                console.log('[Facebook Auth] User did not authorize');
                resolve({
                    success: false,
                    error: response.status === 'not_authorized'
                        ? 'You must authorize the app to connect your Facebook account'
                        : 'Facebook login was cancelled'
                });
                return;
            }

            const accessToken = response.authResponse?.accessToken;

            if (!accessToken) {
                console.error('[Facebook Auth] No access token in response');
                resolve({ success: false, error: 'No access token received' });
                return;
            }

            console.log('[Facebook Auth] Access token received, sending to backend...');

            // Send token to backend for validation and storage
            try {
                const saveResponse = await fetch('/api/auth/facebook/save-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessToken })
                });

                const data = await saveResponse.json();

                if (data.success) {
                    console.log('[Facebook Auth] Token saved successfully:', data.user);
                    resolve({ success: true, user: data.user });
                } else {
                    console.error('[Facebook Auth] Failed to save token:', data.error);
                    resolve({ success: false, error: data.error || 'Failed to save token' });
                }
            } catch (err) {
                console.error('[Facebook Auth] Error saving token:', err);
                resolve({ success: false, error: 'Failed to communicate with server' });
            }
        }, { scope });
    });
};

/**
 * Logout from Facebook
 */
export const logoutFromFacebook = (): Promise<void> => {
    return new Promise((resolve) => {
        localStorage.removeItem('fb_access_token');
        localStorage.removeItem('fb_user_id');
        localStorage.removeItem('fb_token_expiry');

        if (window.FB) {
            window.FB.logout(() => {
                console.log('[Facebook Auth] Logged out');
                resolve();
            });
        } else {
            resolve();
        }
    });
};

/**
 * Get the stored access token
 */
export const getAccessToken = (): string | null => {
    const token = localStorage.getItem('fb_access_token');
    const expiry = localStorage.getItem('fb_token_expiry');

    if (!token || !expiry) return null;

    // Check if token is expired
    if (Date.now() > parseInt(expiry, 10)) {
        console.warn('[Facebook Auth] Access token expired');
        localStorage.removeItem('fb_access_token');
        localStorage.removeItem('fb_user_id');
        localStorage.removeItem('fb_token_expiry');
        return null;
    }

    return token;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
    return getAccessToken() !== null;
};

export default {
    initFacebookSDK,
    checkLoginStatus,
    loginWithFacebook,
    logoutFromFacebook,
    getAccessToken,
    isAuthenticated,
};
