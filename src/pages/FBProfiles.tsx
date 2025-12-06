// FB Profiles Page - Manage connected Facebook profiles

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, RefreshCw, Clock, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { useFacebook, type ConnectedProfile } from '../contexts/FacebookContext';
import { SelectAdAccountsModal } from '../components/settings/SelectAdAccountsModal';
import { cn } from '../utils/cn';

// Debug component to diagnose Supabase RLS/Connection issues
function DebugSupabaseConnection() {
    const [status, setStatus] = useState<{
        profilesCount: number | null;
        accountsCount: number | null;
        error: string | null;
        lastCheck: Date | null;
    }>({ profilesCount: null, accountsCount: null, error: null, lastCheck: null });

    const checkConnection = async () => {
        try {
            // Check profiles
            const { count: profilesCount, error: profilesError } = await import('../lib/supabase').then(m =>
                m.supabase.from('profiles').select('*', { count: 'exact', head: true })
            );

            if (profilesError) throw new Error(`Profiles Error: ${profilesError.message} (${profilesError.code})`);

            // Check ad accounts
            const { count: accountsCount, error: accountsError } = await import('../lib/supabase').then(m =>
                m.supabase.from('ad_accounts').select('*', { count: 'exact', head: true })
            );

            if (accountsError) throw new Error(`Accounts Error: ${accountsError.message} (${accountsError.code})`);

            setStatus(prev => ({
                ...prev,
                profilesCount: profilesCount || 0,
                accountsCount: accountsCount || 0,
                error: null,
                lastCheck: new Date()
            }));
        } catch (err) {
            console.error('[Debug] Supabase check failed:', err);
            setStatus(prev => ({
                ...prev,
                error: err instanceof Error ? err.message : 'Unknown error',
                lastCheck: new Date()
            }));
        }
    };

    const [dumpData, setDumpData] = useState<string | null>(null);

    const handleDump = async () => {
        try {
            const { getProfiles } = await import('../lib/supabase-service');
            const data = await getProfiles();

            // Also fetch raw ad_accounts to check orphans
            const { data: rawAccounts, error } = await import('../lib/supabase').then(m =>
                m.supabase.from('ad_accounts').select('*').limit(20)
            );

            const dump = {
                getProfilesResult: data,
                rawAdAccountsTable: rawAccounts || error
            };

            setDumpData(JSON.stringify(dump, null, 2));
        } catch (err) {
            setDumpData(`Error fetching data: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    return (
        <div className="mt-8 border-t border-border pt-8">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Connection Debugger
            </h3>
            <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                    <span className="font-medium">Actions:</span>
                    <button
                        onClick={checkConnection}
                        className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs font-medium transition-colors"
                    >
                        Check Connection
                    </button>
                    <button
                        onClick={handleDump}
                        className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs font-medium transition-colors"
                    >
                        Dump loaded data
                    </button>
                </div>

                {status.lastCheck && (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="bg-card p-3 rounded border border-border">
                            <div className="text-xs text-muted-foreground">Profiles in DB</div>
                            <div className="font-mono text-lg font-bold">
                                {status.profilesCount !== null ? status.profilesCount : '-'}
                            </div>
                        </div>
                        <div className="bg-card p-3 rounded border border-border">
                            <div className="text-xs text-muted-foreground">Ad Accounts in DB</div>
                            <div className="font-mono text-lg font-bold">
                                {status.accountsCount !== null ? status.accountsCount : '-'}
                            </div>
                        </div>
                    </div>
                )}

                {status.error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded border border-destructive/20 text-xs font-mono break-all">
                        {status.error}
                    </div>
                )}

                {dumpData && (
                    <div className="mt-4">
                        <div className="text-xs font-medium mb-1">Data Dump:</div>
                        <pre className="bg-black/80 text-green-400 p-4 rounded-lg overflow-auto max-h-[300px] text-[10px] font-mono whitespace-pre-wrap">
                            {dumpData}
                        </pre>
                    </div>
                )}

                <div className="text-[10px] text-muted-foreground mt-2">
                    If counts are 0 but you connected accounts, your Database RLS policies may be blocking access.
                    Check Supabase Dashboard {'>'} Table Editor {'>'} RLS Policies.
                </div>
            </div>
        </div>
    );
}

// ... existing component ...

export function FBProfiles() {
    // ... existing hooks ...
    const {
        isLoading,
        error,
        connectedProfiles,
        connectNewProfile,
        disconnectProfile,
        refreshProfile,
        clearError,
        addProfileFromOAuth,
    } = useFacebook();

    const [searchParams, setSearchParams] = useSearchParams();
    const [refreshingId, setRefreshingId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Modal State
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [pendingProfile, setPendingProfile] = useState<ConnectedProfile | null>(null);

    // Track if we've processed the OAuth callback
    const processedOAuth = useRef(false);

    // ... existing useMemo oauthData ...
    const oauthData = useMemo(() => {
        // ... (keep implementation)
        const success = searchParams.get('success');
        const profileData = searchParams.get('profile');
        const errorParam = searchParams.get('error');

        console.log('[FBProfiles] URL params:', { success, hasProfile: !!profileData, error: errorParam });

        if (success === 'true' && profileData) {
            try {
                const parsed = JSON.parse(decodeURIComponent(profileData)) as ConnectedProfile;
                console.log('[FBProfiles] Parsed profile:', parsed.name, 'with', parsed.adAccounts?.length, 'accounts');
                return { profile: parsed };
            } catch (e) {
                console.error('[FBProfiles] Failed to parse OAuth profile data:', e);
                return null;
            }
        } else if (errorParam) {
            return { error: errorParam };
        }
        return null;
    }, [searchParams]);

    // ... existing useEffect ...
    useEffect(() => {
        // ... (keep implementation)
        console.log('[FBProfiles] OAuth effect:', { hasData: !!oauthData, processed: processedOAuth.current });

        if (!oauthData || processedOAuth.current) return;

        processedOAuth.current = true;

        if ('profile' in oauthData && oauthData.profile) {
            console.log('[FBProfiles] Opening selection modal for:', oauthData.profile.name);
            // Schedule state updates for next tick
            setTimeout(() => {
                setPendingProfile(oauthData.profile);
                setIsSelectionModalOpen(true);
                setSearchParams({}, { replace: true });
            }, 0);
        } else if ('error' in oauthData) {
            console.log('[FBProfiles] OAuth error:', oauthData.error);
            setTimeout(() => {
                setSearchParams({}, { replace: true });
            }, 0);
        }
    }, [oauthData, setSearchParams]);

    // Handle Modal Confirmation
    const handleSelectionConfirmed = (selectedIds: string[]) => {
        if (!pendingProfile) return;

        // Filter the profile's accounts to only the selected ones
        const filteredAccounts = pendingProfile.adAccounts.filter(acc =>
            selectedIds.includes(acc.id)
        );

        const newProfile = {
            ...pendingProfile,
            adAccounts: filteredAccounts
        };

        // Add to context
        addProfileFromOAuth(newProfile);

        setSuccessMessage(`Connected ${newProfile.name} with ${filteredAccounts.length} ad account(s). Token valid for ~60 days!`);
        setTimeout(() => setSuccessMessage(null), 5000);

        setIsSelectionModalOpen(false);
        setPendingProfile(null);
    };

    const handleRefresh = async (profileId: string) => {
        setRefreshingId(profileId);
        try {
            await refreshProfile(profileId);
        } finally {
            setRefreshingId(null);
        }
    };

    const getTokenStatus = (expiry: number) => {
        const now = Date.now();
        const daysLeft = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 0) return { status: 'expired', label: 'Expired', color: 'text-red-500' };
        if (daysLeft <= 7) return { status: 'warning', label: `${daysLeft}d left`, color: 'text-yellow-500' };
        return { status: 'valid', label: `${daysLeft}d left`, color: 'text-green-500' };
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Facebook Profiles</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage connected Facebook profiles
                    </p>
                </div>
                <button
                    onClick={connectNewProfile}
                    disabled={isLoading}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                        "bg-primary text-primary-foreground hover:bg-primary/90",
                        isLoading && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <Plus className="h-4 w-4" />
                    Connect Profile
                </button>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-green-700">{successMessage}</p>
                    </div>
                </div>
            )}

            {/* Error Banner */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">Error</p>
                        <p className="text-sm text-destructive/80">{error}</p>
                    </div>
                    <button
                        onClick={clearError}
                        className="text-destructive/60 hover:text-destructive text-sm"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Profiles List */}
            {connectedProfiles.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No profiles connected</h3>
                    <p className="text-muted-foreground mb-6">
                        Connect a Facebook profile to start managing ad accounts
                    </p>
                    <button
                        onClick={connectNewProfile}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" />
                        Connect Facebook Profile
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {connectedProfiles.map((profile) => {
                        const tokenStatus = getTokenStatus(profile.tokenExpiry);
                        const isRefreshing = refreshingId === profile.id;

                        return (
                            <div
                                key={profile.id}
                                className="bg-card border border-border rounded-xl p-6"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                            <User className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-foreground">
                                                {profile.name}
                                            </h3>
                                            {profile.email && (
                                                <p className="text-sm text-muted-foreground">
                                                    {profile.email}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-4 mt-2 text-sm">
                                                <span className="text-muted-foreground">
                                                    {profile.adAccounts.length} ad account{profile.adAccounts.length !== 1 ? 's' : ''}
                                                </span>
                                                <span className={cn("flex items-center gap-1", tokenStatus.color)}>
                                                    {tokenStatus.status === 'valid' ? (
                                                        <CheckCircle className="h-3.5 w-3.5" />
                                                    ) : tokenStatus.status === 'warning' ? (
                                                        <Clock className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                    )}
                                                    Token: {tokenStatus.label}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    Connected {new Date(profile.connectedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleRefresh(profile.id)}
                                            disabled={isRefreshing}
                                            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                            title="Refresh profile"
                                        >
                                            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                                        </button>
                                        <button
                                            onClick={() => disconnectProfile(profile.id)}
                                            className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                            title="Remove profile"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Ad Account Selection Modal */}
            <SelectAdAccountsModal
                isOpen={isSelectionModalOpen}
                onClose={() => {
                    setIsSelectionModalOpen(false);
                    setPendingProfile(null);
                }}
                onConfirmed={handleSelectionConfirmed}
                accounts={pendingProfile?.adAccounts || []}
            />

            <DebugSupabaseConnection />
        </div>
    );
}
