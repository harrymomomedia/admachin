// FB Ad Accounts Page - Manage ad accounts from connected profiles

import { useState, useMemo } from 'react';
import { Search, Plus, Trash2, AlertTriangle, Database, User } from 'lucide-react';
import { useFacebook } from '../contexts/FacebookContext';
import { cn } from '../utils/cn';
import { Link } from 'react-router-dom';

export function FBAdAccounts() {
    const {
        connectedProfiles,
        disconnectAdAccount,
    } = useFacebook();

    const [searchQuery, setSearchQuery] = useState('');

    // Flatten accounts with profile info
    const allAccounts = useMemo(() => {
        return connectedProfiles.flatMap(profile =>
            profile.adAccounts.map(account => ({
                ...account,
                profileId: profile.id,
                profileName: profile.name,
            }))
        );
    }, [connectedProfiles]);

    // Filter by search
    const filteredAccounts = useMemo(() => {
        if (!searchQuery.trim()) return allAccounts;
        const query = searchQuery.toLowerCase();
        return allAccounts.filter(acc =>
            acc.name.toLowerCase().includes(query) ||
            acc.id.toLowerCase().includes(query) ||
            acc.profileName.toLowerCase().includes(query)
        );
    }, [allAccounts, searchQuery]);

    // Group by profile
    const accountsByProfile = useMemo(() => {
        const grouped: Record<string, typeof filteredAccounts> = {};
        filteredAccounts.forEach(acc => {
            if (!grouped[acc.profileId]) {
                grouped[acc.profileId] = [];
            }
            grouped[acc.profileId].push(acc);
        });
        return grouped;
    }, [filteredAccounts]);

    const getStatusBadge = (status: number) => {
        const statusMap: Record<number, { label: string; className: string }> = {
            1: { label: 'Active', className: 'bg-green-500/10 text-green-500' },
            2: { label: 'Disabled', className: 'bg-red-500/10 text-red-500' },
            3: { label: 'Unsettled', className: 'bg-yellow-500/10 text-yellow-500' },
            7: { label: 'Pending', className: 'bg-blue-500/10 text-blue-500' },
            100: { label: 'Closed', className: 'bg-gray-500/10 text-gray-500' },
        };
        return statusMap[status] || { label: 'Unknown', className: 'bg-gray-500/10 text-gray-500' };
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Ad Accounts</h1>
                    <p className="text-muted-foreground mt-1">
                        Managing {allAccounts.length} ad account{allAccounts.length !== 1 ? 's' : ''} across {connectedProfiles.length} profile{connectedProfiles.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search accounts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Content */}
            {connectedProfiles.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No ad accounts</h3>
                    <p className="text-muted-foreground mb-6">
                        Connect a Facebook profile to see your ad accounts
                    </p>
                    <Link
                        to="/facebook/profiles"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" />
                        Connect Profile
                    </Link>
                </div>
            ) : filteredAccounts.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No matching accounts</h3>
                    <p className="text-muted-foreground">
                        Try a different search query
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(accountsByProfile).map(([profileId, accounts]) => {
                        const profile = connectedProfiles.find(p => p.id === profileId);
                        if (!profile) return null;

                        return (
                            <div key={profileId} className="bg-card border border-border rounded-xl overflow-hidden">
                                {/* Profile Header */}
                                <div className="px-6 py-4 bg-muted/50 border-b border-border flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="font-medium text-foreground">{profile.name}</span>
                                    <span className="text-sm text-muted-foreground">
                                        ({accounts.length} account{accounts.length !== 1 ? 's' : ''})
                                    </span>
                                </div>

                                {/* Accounts Table */}
                                <div className="divide-y divide-border">
                                    {accounts.map((account) => {
                                        const statusBadge = getStatusBadge(account.account_status);

                                        return (
                                            <div
                                                key={account.id}
                                                className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium text-foreground">
                                                        {account.name}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {account.id}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={cn(
                                                        "px-2 py-1 rounded-full text-xs font-medium",
                                                        statusBadge.className
                                                    )}>
                                                        {statusBadge.label}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {account.currency}
                                                    </span>
                                                    <button
                                                        onClick={() => disconnectAdAccount(profileId, account.id)}
                                                        className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                        title="Remove account"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
