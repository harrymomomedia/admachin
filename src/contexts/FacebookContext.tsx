// Facebook Context - Supports multiple FB profiles with multiple ad accounts each
// Includes rate limiting awareness and connection persistence via Supabase

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
    initFacebookSDK,
    loginWithFacebook,
    getAdAccounts,
    validateFBConfig,
    FacebookApiError,
    refreshFacebookToken,
} from '../services/facebook';
import type { AdAccount } from '../services/facebook';
import {
    getProfiles,
    upsertProfile,
    addAdAccounts,
    deleteProfile as deleteProfileFromDb,
    type ProfileWithAccounts,
} from '../lib/supabase-service';

// ============ Types ============
export interface ConnectedProfile {
    id: string;                    // FB user ID
    name: string;                  // Profile name (from FB)
    email?: string;                // User email (optional)
    accessToken: string;           // Access token for this profile
    tokenExpiry: number;           // Token expiry timestamp
    adAccounts: AdAccount[];       // Ad accounts for this profile
    connectedAt: number;           // When this profile was connected
    dbId?: string;                 // Supabase profile ID for deletion
}

// ============ Storage Keys (session cache only) ============
const RATE_LIMIT_KEY = 'admachin_rate_limit_reset';

// ============ Supabase Helpers ============

/**
 * Load profiles from Supabase
 */
async function loadProfilesFromDb(): Promise<ConnectedProfile[]> {
    try {
        const profiles = await getProfiles();
        const now = Date.now();

        // Filter out expired tokens and map to ConnectedProfile
        const validProfiles = profiles
            .filter(p => new Date(p.token_expiry).getTime() > now)
            .map((p: ProfileWithAccounts) => ({
                id: p.fb_user_id,
                name: p.fb_name,
                email: p.fb_email || undefined,
                accessToken: p.access_token,
                tokenExpiry: new Date(p.token_expiry).getTime(),
                adAccounts: p.ad_accounts.map(a => ({
                    id: a.fb_account_id,
                    account_id: a.fb_account_id,
                    name: a.name,
                    account_status: a.status,
                    currency: a.currency,
                    timezone_name: a.timezone || '',
                    amount_spent: '0',
                    balance: '0',
                })),
                connectedAt: new Date(p.created_at).getTime(),
                dbId: p.id,
            }));

        return validProfiles;
    } catch (error) {
        console.error('[FB] Failed to load profiles from Supabase:', error);
        return [];
    }
}

/**
 * Save profile to Supabase
 */
async function saveProfileToDb(profile: ConnectedProfile): Promise<string | null> {
    try {
        const savedProfile = await upsertProfile({
            fb_user_id: profile.id,
            fb_name: profile.name,
            fb_email: profile.email || null,
            access_token: profile.accessToken,
            token_expiry: new Date(profile.tokenExpiry),
        });

        // Save ad accounts
        if (profile.adAccounts.length > 0) {
            await addAdAccounts(savedProfile.id, profile.adAccounts.map(a => ({
                fb_account_id: a.id || a.account_id,
                name: a.name,
                status: a.account_status,
                currency: a.currency,
                timezone: a.timezone_name || null,
            })));
        }

        return savedProfile.id;
    } catch (error) {
        console.error('[FB] Failed to save profile to Supabase:', error);
        return null;
    }
}

/**
 * Set session cache for quick API access (localStorage)
 */
function setSessionCache(profiles: ConnectedProfile[]): void {
    if (profiles.length > 0) {
        localStorage.setItem('fb_access_token', profiles[0].accessToken);
        localStorage.setItem('fb_token_expiry', String(profiles[0].tokenExpiry));
    } else {
        localStorage.removeItem('fb_access_token');
        localStorage.removeItem('fb_token_expiry');
    }
}

// Rate limit helpers (still use localStorage as session-scoped)
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
    connectNewProfile: () => void;
    disconnectProfile: (profileId: string) => void;
    disconnectAdAccount: (profileId: string, accountId: string) => void;
    refreshProfile: (profileId: string) => Promise<void>;
    clearError: () => void;
    setActiveProfile: (profileId: string) => void;
    addProfileFromOAuth: (profileData: ConnectedProfile) => void; // For server-side OAuth

    // Team & User Info
    teamName: string;
    currentUser: ConnectedProfile | null;
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
        setSessionCache(updatedProfiles);
        // Save to Supabase asynchronously
        saveProfileToDb(profileData).catch(err => console.error('[FB] Failed to save profile:', err));
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
                let savedProfiles = await loadProfilesFromDb();

                // Auto-Login Logic: Check Server-Side Session
                if (savedProfiles.length === 0) {
                    try {
                        console.log('[FB] Checking server-side session...');
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout to prevent UI hanging

                        const response = await fetch('/api/auth/facebook/session', {
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);

                        console.log('[FB] Server session response status:', response.status);

                        if (response.ok) {
                            const session = await response.json();
                            console.log('[FB] Server session data:', session);

                            if (session.isAuthenticated && session.profile) {
                                console.log('[FB] Inherited server-side session for:', session.profile.name);
                                const serverProfile: ConnectedProfile = {
                                    ...session.profile,
                                    adAccounts: [], // accounts will be fetched on refresh
                                    connectedAt: Date.now()
                                };
                                savedProfiles = [serverProfile];
                                setConnectedProfiles(savedProfiles);
                                setSessionCache(savedProfiles);
                                // Save to Supabase asynchronously
                                saveProfileToDb(serverProfile).catch(err => console.error('[FB] Failed to save server profile:', err));
                            } else {
                                console.log('[FB] Server session not authenticated');
                            }
                        }
                    } catch (sessionErr) {
                        console.warn('[FB] Failed to check server session (timeout or error):', sessionErr);
                    }
                }

                if (savedProfiles.length > 0) {
                    console.log('[FB] Found', savedProfiles.length, 'profiles (local or inherited)');
                    setConnectedProfiles(savedProfiles);

                    // Set the first profile as active for API calls
                    const activeProfile = savedProfiles[0];
                    localStorage.setItem('fb_access_token', activeProfile.accessToken);
                    localStorage.setItem('fb_token_expiry', String(activeProfile.tokenExpiry));

                    // Auto-Refresh Token Check
                    // If token expires in less than 7 days, try to refresh it
                    const now = Date.now();
                    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

                    // Only attempt refresh if it's NOT a system/persistent token
                    // System tokens (from env) are assumed managed by admin/server
                    if (activeProfile.tokenExpiry - now < sevenDaysMs && activeProfile.id !== 'system_persistent_id') {
                        console.log('[FB] Token expiring soon, attempting refresh...');
                        try {
                            const refreshData = await refreshFacebookToken(activeProfile.accessToken);

                            // Update profile with new token
                            const updatedProfile = {
                                ...activeProfile,
                                accessToken: refreshData.access_token,
                                tokenExpiry: Date.now() + refreshData.expires_in * 1000
                            };

                            // Save updated profile
                            const updatedList = savedProfiles.map((p, i) => i === 0 ? updatedProfile : p);
                            setConnectedProfiles(updatedList);
                            setSessionCache(updatedList);
                            // Save to Supabase asynchronously
                            saveProfileToDb(updatedProfile).catch(err => console.error('[FB] Failed to save refreshed profile:', err));

                            // Update active token
                            localStorage.setItem('fb_access_token', updatedProfile.accessToken);
                            localStorage.setItem('fb_token_expiry', String(updatedProfile.tokenExpiry));
                            console.log('[FB] Token refreshed successfully');
                        } catch (refreshErr) {
                            console.warn('[FB] Token refresh failed:', refreshErr);
                            // Don't error out the whole app, just continue with old token
                        }
                    }
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

    // NOTE: OAuth callback is now handled by FBProfiles page with selection modal
    // The page will call addProfileFromOAuth after user selects accounts

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

    const connectNewProfile = useCallback(() => {
        // Check rate limiting first
        if (isRateLimited()) {
            const resetTime = getRateLimitResetTime();
            setError(`Rate limited. Please wait until ${resetTime?.toLocaleTimeString() || 'later'} to try again.`);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Server-side OAuth - redirects browser to Facebook
            loginWithFacebook();
            // Note: page redirects, so code below never runs
        } catch (err) {
            console.error('[FB] Connect error:', err);
            setError(err instanceof Error ? err.message : 'Failed to initiate connection');
            setIsLoading(false);
        }
    }, []);

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

            const updatedProfiles = currentProfiles.map(p => {
                if (p.id !== profileId) return p;

                // Only update accounts that are ALREADY connected.
                // We don't want to re-add accounts the user explicitly disconnected or didn't select.
                const existingAccountIds = new Set(p.adAccounts.map(a => a.id));
                const refreshedConnectedAccounts = adAccountsResponse.data.filter(a => existingAccountIds.has(a.id));

                return { ...p, adAccounts: refreshedConnectedAccounts };
            });

            setConnectedProfiles(updatedProfiles);
            setSessionCache(updatedProfiles);
            // Save updated profile to Supabase
            const profile = updatedProfiles.find(p => p.id === profileId);
            if (profile) {
                await saveProfileToDb(profile);
            }
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
        const profileToRemove = connectedProfiles.find(p => p.id === profileId);
        const updatedProfiles = connectedProfiles.filter(p => p.id !== profileId);
        setConnectedProfiles(updatedProfiles);
        setSessionCache(updatedProfiles);

        // Delete from Supabase asynchronously
        if (profileToRemove?.dbId) {
            deleteProfileFromDb(profileToRemove.dbId).catch(err => console.error('[FB] Failed to delete profile from DB:', err));
        }

        // If we disconnected all profiles, clear the active token
        if (updatedProfiles.length === 0) {
            localStorage.removeItem('fb_access_token');
            localStorage.removeItem('fb_token_expiry');
        }
    }, [connectedProfiles]);

    // Disconnect a specific ad account
    const disconnectAdAccount = useCallback((profileId: string, accountId: string) => {
        const updatedProfiles = connectedProfiles.map(p => {
            if (p.id !== profileId) return p;
            return {
                ...p,
                adAccounts: p.adAccounts.filter(a => a.id !== accountId)
            };
        });

        setConnectedProfiles(updatedProfiles);
        setSessionCache(updatedProfiles);
        // Save updated profile to Supabase
        const profile = updatedProfiles.find(p => p.id === profileId);
        if (profile) {
            saveProfileToDb(profile).catch(err => console.error('[FB] Failed to save after ad account disconnect:', err));
        }
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
                disconnectAdAccount,
                refreshProfile,
                clearError,
                setActiveProfile,
                addProfileFromOAuth,
                teamName: 'Momomedia', // Hardcoded for now as per requirement, or could be state
                currentUser: connectedProfiles.length > 0 ? connectedProfiles[0] : null,
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
