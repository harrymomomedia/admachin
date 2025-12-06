import { useState } from 'react';
import { Check, X, Search } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { AdAccount } from '../../services/facebook';

interface SelectAdAccountsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmed: (selectedIds: string[]) => void;
    accounts: AdAccount[];
    isLoading?: boolean;
    profileName?: string;
}

export function SelectAdAccountsModal({
    isOpen,
    onClose,
    onConfirmed,
    accounts,
    isLoading,
    profileName
}: SelectAdAccountsModalProps) {
    // Start with NO accounts selected, letting user choose.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const filteredAccounts = accounts.filter(acc =>
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.account_id.includes(searchQuery)
    );

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleConfirm = () => {
        onConfirmed(Array.from(selectedIds));
    };

    // Format currency
    const formatCurrency = (amount: string, currency: string) => {
        const num = parseFloat(amount) / 100;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(num);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Select Ad Accounts {profileName ? `for ${profileName}` : ''}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Choose which Facebook Ad Accounts you want to manage in AdMachin.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Sub-header / Search */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search accounts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="text-sm text-gray-500">
                        {selectedIds.size} selected
                    </div>
                    <button
                        onClick={() => {
                            if (selectedIds.size === filteredAccounts.length) {
                                setSelectedIds(new Set());
                            } else {
                                setSelectedIds(new Set(filteredAccounts.map(a => a.id)));
                            }
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                    >
                        {selectedIds.size === filteredAccounts.length ? 'Deselect All' : 'Select All'}
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
                    {filteredAccounts.length === 0 ? (
                        <div className="py-12 text-center text-gray-500 text-sm">
                            No ad accounts found matching your search.
                        </div>
                    ) : (
                        filteredAccounts.map((account) => {
                            const isSelected = selectedIds.has(account.id);
                            return (
                                <div
                                    key={account.id}
                                    onClick={() => toggleSelection(account.id)}
                                    className={cn(
                                        "group flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200",
                                        isSelected
                                            ? "bg-white border-blue-200 shadow-sm ring-1 ring-blue-500/20"
                                            : "bg-white border-gray-100 hover:border-gray-200"
                                    )}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                                {account.name}
                                            </h3>
                                            {isSelected && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                    Selected
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                            <span className="font-mono">{account.account_id}</span>
                                            <span>•</span>
                                            <span>{account.currency}</span>
                                            <span>•</span>
                                            <span>Spent: {formatCurrency(account.amount_spent || '0', account.currency)}</span>
                                        </div>
                                    </div>

                                    <div className={cn(
                                        "w-24 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200",
                                        isSelected
                                            ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                                            : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                                    )}>
                                        {isSelected ? (
                                            <span className="flex items-center gap-1">
                                                <Check className="w-4 h-4" />
                                                Selected
                                            </span>
                                        ) : 'Select'}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={selectedIds.size === 0 || isLoading}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            'Processing...'
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Connect {selectedIds.size} Accounts
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
