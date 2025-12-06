// FB Ad Accounts Page - Flat table layout (no grouping)

import { useState, useMemo } from 'react';
import { Search, Plus, Trash2, RefreshCw, AlertTriangle, Database } from 'lucide-react';
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
                profileEmail: profile.email,
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
                    <h1 className="text-2xl font-bold text-foreground">Account Overview</h1>
                </div>
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search accounts, email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64 pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
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
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Section Header */}
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-foreground">Connected Ad Accounts</h2>
                            <p className="text-sm text-muted-foreground">
                                Managing {allAccounts.length} ad account{allAccounts.length !== 1 ? 's' : ''} across {connectedProfiles.length} Facebook profile{connectedProfiles.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <button className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Facebook User</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currency</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredAccounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-muted-foreground">No matching accounts found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAccounts.map((account) => {
                                        const statusBadge = getStatusBadge(account.account_status);
                                        return (
                                            <tr key={account.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-foreground">
                                                        {account.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {account.currency}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                                                    {account.id.replace('act_', '')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <span className="text-xs font-medium text-primary">
                                                                {account.profileName.charAt(0)}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-foreground">
                                                                {account.profileName}
                                                            </div>
                                                            {account.profileEmail && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    {account.profileEmail}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={cn(
                                                        "px-2 py-1 rounded-full text-xs font-medium",
                                                        statusBadge.className
                                                    )}>
                                                        • {statusBadge.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">
                                                    {account.currency}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => disconnectAdAccount(account.profileId, account.id)}
                                                        className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                        title="Remove account"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
