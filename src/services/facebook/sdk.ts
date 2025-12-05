// Facebook SDK Initialization and Auth

import { FB_CONFIG } from './config';
import type { FacebookLoginStatus, FacebookAuthResponse } from '../../types/facebook';

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
export const loginWithFacebook = (): Promise<FacebookAuthResponse> => {
    return new Promise((resolve, reject) => {
        if (!window.FB) {
            reject(new Error('Facebook SDK not initialized'));
            return;
        }

        // First, check if user already has a valid session
        window.FB.getLoginStatus((statusResponse: FacebookLoginStatus) => {
            if (statusResponse.status === 'connected' && statusResponse.authResponse) {
                console.log('[Facebook Auth] User already connected, reusing session');
                // User already logged in, use existing session
                const auth = statusResponse.authResponse;
                localStorage.setItem('fb_access_token', auth.accessToken);
                localStorage.setItem('fb_user_id', auth.userID);
                localStorage.setItem('fb_token_expiry', String(Date.now() + auth.expiresIn * 1000));
                resolve(auth);
                return;
            }

            // Not connected, trigger login
            console.log('[Facebook Auth] No existing session, triggering login');
            window.FB.login(
                (response: FacebookLoginStatus) => {
                    if (response.status === 'connected' && response.authResponse) {
                        console.log('[Facebook Auth] Login successful');
                        // Store access token
                        localStorage.setItem('fb_access_token', response.authResponse.accessToken);
                        localStorage.setItem('fb_user_id', response.authResponse.userID);
                        localStorage.setItem('fb_token_expiry', String(Date.now() + response.authResponse.expiresIn * 1000));
                        resolve(response.authResponse);
                    } else {
                        reject(new Error('Facebook login failed or was cancelled'));
                    }
                },
                {
                    scope: FB_CONFIG.permissions,
                    return_scopes: true,
                    // Use Facebook Login for Business config if available (enables never-expiring tokens)
                    ...(FB_CONFIG.configId && { config_id: FB_CONFIG.configId }),
                }
            );
        });
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
