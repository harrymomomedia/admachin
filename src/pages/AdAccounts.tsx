// Ad Accounts Page - Single source for all FB connections
// Supports both client-side (short tokens) and server-side OAuth (60-day tokens)

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, RefreshCw, Trash2, AlertTriangle, ChevronDown, ChevronRight, Clock, CheckCircle } from 'lucide-react';
import { useFacebook, type ConnectedProfile } from '../contexts/FacebookContext';
import { cn } from '../utils/cn';

export function AdAccounts() {
    const {
        isLoading,
        error,
        isRateLimited,
        rateLimitResetTime,
        connectedProfiles,
        allAdAccounts,
        // connectNewProfile is not used - we use server-side OAuth now
        disconnectProfile,
        refreshProfile,
        clearError,
        addProfileFromOAuth,
    } = useFacebook();

    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Handle OAuth callback parameters from URL
    useEffect(() => {
        const success = searchParams.get('success');
        const profileData = searchParams.get('profile');
        const errorParam = searchParams.get('error');

        if (success === 'true' && profileData) {
            try {
                const profile = JSON.parse(decodeURIComponent(profileData));
                addProfileFromOAuth(profile);
                setSuccessMessage(`Connected ${profile.name} with ${profile.adAccounts?.length || 0} ad account(s). Token valid for ~60 days!`);
                // Clear URL params
                setSearchParams({});
                // Clear success message after 5 seconds
                setTimeout(() => setSuccessMessage(null), 5000);
            } catch (e) {
                console.error('Failed to parse OAuth profile data:', e);
            }
        } else if (errorParam) {
            // Error is shown via the error state in context
            setSearchParams({});
        }
    }, [searchParams, setSearchParams, addProfileFromOAuth]);

    // Toggle profile expansion
    const toggleProfile = (profileId: string) => {
        const newExpanded = new Set(expandedProfiles);
        if (newExpanded.has(profileId)) {
            newExpanded.delete(profileId);
        } else {
            newExpanded.add(profileId);
        }
        setExpandedProfiles(newExpanded);
    };

    // Filter accounts by search
    const filterAccounts = (profile: ConnectedProfile) => {
        if (!searchQuery) return profile.adAccounts;
        return profile.adAccounts.filter(acc =>
            acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            acc.account_id.includes(searchQuery)
        );
    };

    // Format currency
    const formatCurrency = (amount: string, currency: string) => {
        const num = parseFloat(amount) / 100;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 2,
        }).format(num);
    };

    // Handle connect click - use server-side OAuth for 60-day tokens
    const handleConnect = () => {
        // Redirect to server-side OAuth endpoint
        window.location.href = '/api/auth/facebook';
    };


    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Header */}
            <div className="border-b border-white/10">
                <div className="px-6 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-semibold text-white">Account Overview</h1>
                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search accounts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                            />
                        </div>
                        {/* Connect Button */}
                        <button
                            onClick={handleConnect}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0095F6] hover:bg-[#0086E0] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            Connect Account
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {/* Success Banner */}
                {successMessage && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-green-400">Successfully Connected!</p>
                            <p className="text-xs text-green-400/80 mt-1">{successMessage}</p>
                        </div>
                    </div>
                )}

                {/* Rate Limit Banner */}
                {isRateLimited && rateLimitResetTime && (
                    <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-amber-400">Rate Limited by Facebook</p>
                            <p className="text-xs text-amber-400/80 mt-1">
                                Too many API calls. You can try again at {rateLimitResetTime.toLocaleTimeString()}.
                                Your connected accounts are still saved below.
                            </p>
                        </div>
                    </div>
                )}

                {/* Error Banner (non-rate-limit errors) */}
                {error && !error.includes('Rate limit') && !error.includes('too many') && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                        <button onClick={clearError} className="text-red-400 hover:text-red-300">
                            <span className="sr-only">Dismiss</span>
                            &times;
                        </button>
                    </div>
                )}

                {/* Main Card */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* Card Header */}
                    <div className="px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Ad Accounts</h2>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {connectedProfiles.length} profile{connectedProfiles.length !== 1 ? 's' : ''} connected
                                    {' · '}
                                    {allAdAccounts.length} ad account{allAdAccounts.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Empty State */}
                    {connectedProfiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4">
                            <div className="w-16 h-16 bg-[#1877F2]/10 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Connect your first account</h3>
                            <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
                                Connect your Facebook ad accounts to start managing campaigns and tracking performance.
                            </p>
                            <button
                                onClick={handleConnect}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-6 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                    </svg>
                                )}
                                {isLoading ? 'Connecting...' : 'Connect with Facebook'}
                            </button>
                        </div>
                    ) : (
                        /* Profiles List */
                        <div className="divide-y divide-gray-100">
                            {connectedProfiles.map((profile) => {
                                const isExpanded = expandedProfiles.has(profile.id);
                                const filteredAccounts = filterAccounts(profile);
                                const hasMatchingAccounts = filteredAccounts.length > 0;

                                // Skip profiles with no matching accounts when searching
                                if (searchQuery && !hasMatchingAccounts) return null;

                                return (
                                    <div key={profile.id}>
                                        {/* Profile Header */}
                                        <div
                                            className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer"
                                            onClick={() => toggleProfile(profile.id)}
                                        >
                                            <button className="text-gray-400">
                                                {isExpanded ? (
                                                    <ChevronDown className="w-5 h-5" />
                                                ) : (
                                                    <ChevronRight className="w-5 h-5" />
                                                )}
                                            </button>

                                            <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center flex-shrink-0">
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                                </svg>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900">{profile.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {profile.adAccounts.length} ad account{profile.adAccounts.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => refreshProfile(profile.id)}
                                                    disabled={isLoading}
                                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Refresh"
                                                >
                                                    <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                                                </button>
                                                <button
                                                    onClick={() => disconnectProfile(profile.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Disconnect"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Ad Accounts Table */}
                                        {isExpanded && (
                                            <div className="bg-gray-50 border-t border-gray-100">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="border-b border-gray-200">
                                                            <th className="pl-16 pr-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Account Name
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Account ID
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Status
                                                            </th>
                                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Lifetime Spend
                                                            </th>
                                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Balance
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 bg-white">
                                                        {filteredAccounts.map((account) => (
                                                            <tr key={account.id} className="hover:bg-gray-50">
                                                                <td className="pl-16 pr-4 py-4">
                                                                    <p className="font-medium text-gray-900">{account.name}</p>
                                                                    <p className="text-sm text-gray-500">{account.currency}</p>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <span className="font-mono text-sm text-gray-600">
                                                                        {account.account_id}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <span className={cn(
                                                                        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium",
                                                                        account.account_status === 1
                                                                            ? "bg-green-50 text-green-700"
                                                                            : "bg-yellow-50 text-yellow-700"
                                                                    )}>
                                                                        {account.account_status === 1 ? 'Active' : 'Inactive'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4 text-right">
                                                                    <span className="font-medium text-gray-900">
                                                                        {formatCurrency(account.amount_spent || '0', account.currency)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4 text-right">
                                                                    <span className={cn(
                                                                        "font-medium",
                                                                        parseFloat(account.balance || '0') > 0 ? "text-orange-500" : "text-gray-500"
                                                                    )}>
                                                                        {formatCurrency(account.balance || '0', account.currency)}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Add Another Account */}
                {connectedProfiles.length > 0 && (
                    <div className="mt-6 text-center">
                        <button
                            onClick={handleConnect}
                            disabled={isLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 text-[#0095F6] hover:bg-[#0095F6]/5 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            Connect another Facebook account
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdAccounts;
