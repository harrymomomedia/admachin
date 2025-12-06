// FB Profiles Page - Manage connected Facebook profiles

import { useState } from 'react';
import { Plus, Trash2, RefreshCw, Clock, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { useFacebook } from '../contexts/FacebookContext';
import { cn } from '../utils/cn';

export function FBProfiles() {
    const {
        isLoading,
        error,
        connectedProfiles,
        connectNewProfile,
        disconnectProfile,
        refreshProfile,
        clearError,
    } = useFacebook();

    const [refreshingId, setRefreshingId] = useState<string | null>(null);

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
        </div>
    );
}
