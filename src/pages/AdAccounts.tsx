// Ad Accounts Page - Single source for all FB connections
// Supports both client-side (short tokens) and server-side OAuth (60-day tokens)

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, RefreshCw, Trash2, AlertTriangle, CheckCircle, User, Mail } from 'lucide-react';
import { useFacebook, type ConnectedProfile } from '../contexts/FacebookContext';
import { SelectAdAccountsModal } from '../components/settings/SelectAdAccountsModal';
import { cn } from '../utils/cn';

export function AdAccounts() {
    const {
        isLoading,
        error,
        isRateLimited,
        rateLimitResetTime,
        connectedProfiles,
        // allAdAccounts, // We will derive our own flat list to include profile info
        disconnectAdAccount,
        refreshProfile,
        clearError,
        addProfileFromOAuth,
    } = useFacebook();

    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Modal State
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [pendingProfile, setPendingProfile] = useState<ConnectedProfile | null>(null);

    // Handle OAuth callback parameters from URL
    useEffect(() => {
        const success = searchParams.get('success');
        const profileData = searchParams.get('profile');
        const errorParam = searchParams.get('error');

        if (success === 'true' && profileData) {
            try {
                const profile = JSON.parse(decodeURIComponent(profileData)) as ConnectedProfile;

                // Instead of adding immediately, open the selection modal
                setPendingProfile(profile);
                setIsSelectionModalOpen(true);

                // Clear URL params
                setSearchParams({});
            } catch (e) {
                console.error('Failed to parse OAuth profile data:', e);
            }
        } else if (errorParam) {
            // Error is shown via the error state in context
            setSearchParams({});
        }
    }, [searchParams, setSearchParams]);

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

    // Derived Flat List of Accounts with Profile Info
    const flatAccounts = useMemo(() => {
        const flat = [];
        for (const profile of connectedProfiles) {
            for (const account of profile.adAccounts) {
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    const match =
                        account.name.toLowerCase().includes(q) ||
                        account.account_id.includes(q) ||
                        profile.name.toLowerCase().includes(q) ||
                        (profile.email && profile.email.toLowerCase().includes(q));
                    if (!match) continue;
                }

                flat.push({
                    ...account,
                    _profileName: profile.name,
                    _profileEmail: profile.email,
                    _profileId: profile.id,
                });
            }
        }
        return flat;
    }, [connectedProfiles, searchQuery]);

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
                                placeholder="Search accounts, email..."
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
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Connected Ad Accounts</h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Managing {flatAccounts.length} ad account{flatAccounts.length !== 1 ? 's' : ''} across {connectedProfiles.length} Facebook profile{connectedProfiles.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                // Refresh all profiles
                                connectedProfiles.forEach(p => refreshProfile(p.id));
                            }}
                            disabled={isLoading || connectedProfiles.length === 0}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Refresh All"
                        >
                            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                        </button>
                    </div>

                    {/* Empty State */}
                    {flatAccounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4">
                            <div className="w-16 h-16 bg-[#1877F2]/10 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts connected</h3>
                            <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
                                Connect your Facebook ad accounts to start managing campaigns and tracking performance.
                            </p>
                            <button
                                onClick={handleConnect}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-6 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isLoading ? 'Connecting...' : 'Connect with Facebook'}
                            </button>
                        </div>
                    ) : (
                        /* Flat Table */
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Facebook User</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Spend</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {flatAccounts.map((account) => (
                                        <tr key={`${account._profileId}_${account.id}`} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div>
                                                        <div className="font-medium text-gray-900">{account.name}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{account.currency}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                    {account.account_id}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                                                        <User className="w-3.5 h-3.5 text-gray-400" />
                                                        {account._profileName}
                                                    </div>
                                                    {account._profileEmail && (
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                                                            <Mail className="w-3 H-3 text-gray-400" />
                                                            {account._profileEmail}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                    account.account_status === 1
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-yellow-100 text-yellow-800"
                                                )}>
                                                    <span className={cn(
                                                        "w-1.5 h-1.5 rounded-full mr-1.5",
                                                        account.account_status === 1 ? "bg-green-500" : "bg-yellow-500"
                                                    )} />
                                                    {account.account_status === 1 ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-medium text-gray-900">
                                                    {formatCurrency(account.amount_spent || '0', account.currency)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={cn(
                                                    "text-sm font-medium",
                                                    parseFloat(account.balance || '0') > 0 ? "text-orange-600" : "text-gray-500"
                                                )}>
                                                    {formatCurrency(account.balance || '0', account.currency)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => disconnectAdAccount(account._profileId, account.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors group"
                                                    title="Disconnect Account"
                                                >
                                                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Selection Modal */}
            {pendingProfile && (
                <SelectAdAccountsModal
                    isOpen={isSelectionModalOpen}
                    onClose={() => {
                        setIsSelectionModalOpen(false);
                        setPendingProfile(null);
                    }}
                    onConfirmed={handleSelectionConfirmed}
                    accounts={pendingProfile.adAccounts}
                    isLoading={false}
                />
            )}
        </div>
    );
}

export default AdAccounts;
