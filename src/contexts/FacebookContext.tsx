// Facebook Context - Supports multiple FB profiles with multiple ad accounts each
// Includes rate limiting awareness and connection persistence

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
    initFacebookSDK,
    loginWithFacebook,
    logoutFromFacebook,
    getAdAccounts,
    validateFBConfig,
    FacebookApiError,
} from '../services/facebook';
import type { AdAccount } from '../services/facebook';

// ============ Types ============
export interface ConnectedProfile {
    id: string;                    // FB user ID
    name: string;                  // Profile name (from FB)
    accessToken: string;           // Access token for this profile
    tokenExpiry: number;           // Token expiry timestamp
    adAccounts: AdAccount[];       // Ad accounts for this profile
    connectedAt: number;           // When this profile was connected
}

// ============ Storage Keys ============
const STORAGE_KEY = 'admachin_connected_profiles';
const RATE_LIMIT_KEY = 'admachin_rate_limit_reset';

// ============ Storage Helpers ============
function loadProfiles(): ConnectedProfile[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const profiles = JSON.parse(stored) as ConnectedProfile[];
        // Filter out expired tokens
        const now = Date.now();
        const validProfiles = profiles.filter(p => p.tokenExpiry > now);

        // If we filtered some out, save the updated list
        if (validProfiles.length !== profiles.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validProfiles));
        }

        return validProfiles;
    } catch {
        return [];
    }
}

function saveProfiles(profiles: ConnectedProfile[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        // Also set the active token for API calls
        if (profiles.length > 0) {
            localStorage.setItem('fb_access_token', profiles[0].accessToken);
            localStorage.setItem('fb_token_expiry', String(profiles[0].tokenExpiry));
        }
    } catch {
        // Ignore storage errors
    }
}

// Rate limit helpers
function isRateLimited(): boolean {
    const resetTime = localStorage.getItem(RATE_LIMIT_KEY);
    if (!resetTime) return false;
    return Date.now() < parseInt(resetTime, 10);
}

function getRateLimitResetTime(): Date | null {
    const resetTime = localStorage.getItem(RATE_LIMIT_KEY);
    if (!resetTime) return null;
    const time = parseInt(resetTime, 10);
    if (Date.now() > time) {
        localStorage.removeItem(RATE_LIMIT_KEY);
        return null;
    }
    return new Date(time);
}

function setRateLimitReset(minutesFromNow: number): void {
    const resetTime = Date.now() + (minutesFromNow * 60 * 1000);
    localStorage.setItem(RATE_LIMIT_KEY, String(resetTime));
}

// ============ Context Types ============
interface FacebookContextType {
    // State
    isInitialized: boolean;
    isLoading: boolean;
    error: string | null;

    // Config
    isConfigValid: boolean;
    missingConfig: string[];

    // Connection status helper
    isConnected: boolean;

    // Rate limiting
    isRateLimited: boolean;
    rateLimitResetTime: Date | null;

    // Connected profiles (multiple FB accounts)
    connectedProfiles: ConnectedProfile[];

    // All ad accounts across all profiles (flattened)
    allAdAccounts: AdAccount[];

    // Actions
    connectNewProfile: () => Promise<void>;
    disconnectProfile: (profileId: string) => void;
    refreshProfile: (profileId: string) => Promise<void>;
    clearError: () => void;
    setActiveProfile: (profileId: string) => void;
    addProfileFromOAuth: (profileData: ConnectedProfile) => void; // For server-side OAuth
}

const FacebookContext = createContext<FacebookContextType | null>(null);

// ============ Provider ============
export function FacebookProvider({ children }: { children: ReactNode }) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectedProfiles, setConnectedProfiles] = useState<ConnectedProfile[]>([]);
    const [rateLimitedState, setRateLimitedState] = useState(isRateLimited());

    // Config validation
    const configValidation = validateFBConfig();

    // Derived: all ad accounts flattened
    const allAdAccounts = connectedProfiles.flatMap(p => p.adAccounts);

    // Connection status
    const isConnected = connectedProfiles.length > 0;

    // Clear error
    const clearError = useCallback(() => setError(null), []);

    // Set active profile (for API calls)
    const setActiveProfile = useCallback((profileId: string) => {
        const profile = connectedProfiles.find(p => p.id === profileId);
        if (profile) {
            localStorage.setItem('fb_access_token', profile.accessToken);
            localStorage.setItem('fb_token_expiry', String(profile.tokenExpiry));
        }
    }, [connectedProfiles]);

    // Initialize on mount
    useEffect(() => {
        if (!configValidation.valid) {
            setIsLoading(false);
            return;
        }

        const init = async () => {
            try {
                // Load saved profiles from storage FIRST
                const savedProfiles = loadProfiles();

                if (savedProfiles.length > 0) {
                    console.log('[FB] Found', savedProfiles.length, 'saved profiles');
                    setConnectedProfiles(savedProfiles);

                    // Set the first profile as active for API calls
                    localStorage.setItem('fb_access_token', savedProfiles[0].accessToken);
                    localStorage.setItem('fb_token_expiry', String(savedProfiles[0].tokenExpiry));
                }

                // Initialize FB SDK
                await initFacebookSDK();
                setIsInitialized(true);

            } catch (err) {
                console.error('[FB] Init error:', err);
                setError(err instanceof Error ? err.message : 'Failed to initialize');
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [configValidation.valid]);

    // Handle rate limit errors - uses exact time from Facebook when available
    const handleApiError = useCallback((err: unknown) => {
        // Check if it's a FacebookApiError with rate limit info
        if (err instanceof FacebookApiError && err.rateLimitInfo?.estimatedTimeToRegainAccess) {
            const minutes = err.rateLimitInfo.estimatedTimeToRegainAccess;
            setRateLimitReset(minutes);
            setRateLimitedState(true);
            setError(`Rate limited by Facebook. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''} before trying again.`);
            return true;
        }

        // Fallback: check error message for rate limit indicators
        if (err instanceof Error) {
            const message = err.message.toLowerCase();
            // Check for rate limit errors (codes 80000-80009, 17, 32)
            if (message.includes('too many calls') ||
                message.includes('rate limit') ||
                message.includes('80004') ||
                message.includes('80003')) {
                // Default to 15 minutes if we don't have exact time
                setRateLimitReset(15);
                setRateLimitedState(true);
                setError('Rate limited by Facebook. Please wait ~15 minutes before trying again.');
                return true;
            }
        }
        return false;
    }, []);

    // Connect a new FB profile
    const connectNewProfile = useCallback(async () => {
        // Check rate limiting first
        if (isRateLimited()) {
            const resetTime = getRateLimitResetTime();
            setError(`Rate limited. Please wait until ${resetTime?.toLocaleTimeString() || 'later'} to try again.`);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // This will open FB login popup
            const authResponse = await loginWithFacebook();

            // Check if this profile is already connected
            const existingProfile = connectedProfiles.find(p => p.id === authResponse.userID);
            if (existingProfile) {
                console.log('[FB] Profile already connected, updating token');
                // Update existing profile's token
                const updatedProfiles = connectedProfiles.map(p =>
                    p.id === authResponse.userID
                        ? {
                            ...p,
                            accessToken: authResponse.accessToken,
                            tokenExpiry: Date.now() + authResponse.expiresIn * 1000,
                        }
                        : p
                );
                setConnectedProfiles(updatedProfiles);
                saveProfiles(updatedProfiles);

                // Don't refresh ad accounts to avoid extra API calls
                // Ad accounts can be refreshed manually if needed
                return;
            }

            // Fetch ad accounts for this new profile
            const adAccountsResponse = await getAdAccounts();

            // Get user info (we'll use the first ad account's business name or just "Profile")
            const profileName = adAccountsResponse.data[0]?.business?.name
                || `Facebook Profile ${connectedProfiles.length + 1}`;

            // Create new profile
            const newProfile: ConnectedProfile = {
                id: authResponse.userID,
                name: profileName,
                accessToken: authResponse.accessToken,
                tokenExpiry: Date.now() + authResponse.expiresIn * 1000,
                adAccounts: adAccountsResponse.data,
                connectedAt: Date.now(),
            };

            const updatedProfiles = [...connectedProfiles, newProfile];
            setConnectedProfiles(updatedProfiles);
            saveProfiles(updatedProfiles);

            // Logout from FB SDK (so user can add another profile)
            // This doesn't invalidate the token, just clears the SDK session
            await logoutFromFacebook();

        } catch (err) {
            console.error('[FB] Connect error:', err);
            if (!handleApiError(err)) {
                setError(err instanceof Error ? err.message : 'Failed to connect profile');
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [connectedProfiles, handleApiError]);

    // Internal refresh helper
    const refreshProfileInternal = async (
        profileId: string,
        accessToken: string,
        currentProfiles: ConnectedProfile[]
    ) => {
        try {
            // Temporarily set token for API calls
            localStorage.setItem('fb_access_token', accessToken);

            const adAccountsResponse = await getAdAccounts();

            const updatedProfiles = currentProfiles.map(p =>
                p.id === profileId
                    ? { ...p, adAccounts: adAccountsResponse.data }
                    : p
            );
            setConnectedProfiles(updatedProfiles);
            saveProfiles(updatedProfiles);
        } catch (err) {
            console.error('[FB] Refresh error:', err);
            throw err;
        }
    };

    // Refresh a specific profile's ad accounts
    const refreshProfile = useCallback(async (profileId: string) => {
        // Check rate limiting first
        if (isRateLimited()) {
            const resetTime = getRateLimitResetTime();
            setError(`Rate limited. Please wait until ${resetTime?.toLocaleTimeString() || 'later'} to try again.`);
            return;
        }

        const profile = connectedProfiles.find(p => p.id === profileId);
        if (!profile) return;

        setIsLoading(true);
        setError(null);

        try {
            await refreshProfileInternal(profileId, profile.accessToken, connectedProfiles);
        } catch (err) {
            if (!handleApiError(err)) {
                setError(err instanceof Error ? err.message : 'Failed to refresh profile');
            }
        } finally {
            setIsLoading(false);
        }
    }, [connectedProfiles, handleApiError]);

    // Disconnect a profile
    const disconnectProfile = useCallback((profileId: string) => {
        const updatedProfiles = connectedProfiles.filter(p => p.id !== profileId);
        setConnectedProfiles(updatedProfiles);
        saveProfiles(updatedProfiles);

        // If we disconnected all profiles, clear the active token
        if (updatedProfiles.length === 0) {
            localStorage.removeItem('fb_access_token');
            localStorage.removeItem('fb_token_expiry');
        }
    }, [connectedProfiles]);

    // Add profile from server-side OAuth (long-lived token)
    const addProfileFromOAuth = useCallback((profileData: ConnectedProfile) => {
        // Check if profile already exists
        const existingIndex = connectedProfiles.findIndex(p => p.id === profileData.id);

        let updatedProfiles: ConnectedProfile[];
        if (existingIndex >= 0) {
            // Update existing profile
            updatedProfiles = connectedProfiles.map((p, i) =>
                i === existingIndex ? profileData : p
            );
            console.log('[FB OAuth] Updated existing profile:', profileData.name);
        } else {
            // Add new profile
            updatedProfiles = [...connectedProfiles, profileData];
            console.log('[FB OAuth] Added new profile:', profileData.name);
        }

        setConnectedProfiles(updatedProfiles);
        saveProfiles(updatedProfiles);
    }, [connectedProfiles]);

    return (
        <FacebookContext.Provider
            value={{
                isInitialized,
                isLoading,
                error,
                isConfigValid: configValidation.valid,
                missingConfig: configValidation.missing,
                isConnected,
                isRateLimited: rateLimitedState,
                rateLimitResetTime: getRateLimitResetTime(),
                connectedProfiles,
                allAdAccounts,
                connectNewProfile,
                disconnectProfile,
                refreshProfile,
                clearError,
                setActiveProfile,
                addProfileFromOAuth,
            }}
        >
            {children}
        </FacebookContext.Provider>
    );
}

// ============ Hook ============
export function useFacebook(): FacebookContextType {
    const context = useContext(FacebookContext);
    if (!context) {
        throw new Error('useFacebook must be used within a FacebookProvider');
    }
    return context;
}
