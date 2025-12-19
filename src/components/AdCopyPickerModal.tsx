import { useState, useMemo, useRef, useEffect } from 'react';
import { X, Search } from 'lucide-react';

// Minimal ad copy type for picker (matches DataTable's adCopies prop)
interface AdCopyMinimal {
    id: string;
    text: string | null;
    name?: string | null;
    type: string;
    row_number?: number;
}

interface AdCopyPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (adCopyId: string | null) => void;
    adCopies: AdCopyMinimal[];
    currentValue: string | null;
    title: string;
    type: 'headline' | 'primary_text' | 'description';
}

export function AdCopyPickerModal({
    isOpen,
    onClose,
    onSelect,
    adCopies,
    currentValue,
    title,
    type,
}: AdCopyPickerModalProps) {
    const [search, setSearch] = useState('');
    const [rowNumberInput, setRowNumberInput] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Filter ad copies by type and search
    const filteredCopies = useMemo(() => {
        let filtered = adCopies.filter(c => c.type === type);

        if (search) {
            const lowerSearch = search.toLowerCase();
            filtered = filtered.filter(c =>
                c.text?.toLowerCase().includes(lowerSearch) ||
                c.name?.toLowerCase().includes(lowerSearch) ||
                c.row_number?.toString().includes(search)
            );
        }

        return filtered.sort((a, b) => (b.row_number || 0) - (a.row_number || 0));
    }, [adCopies, type, search]);

    // Handle row number jump
    const handleRowNumberJump = () => {
        const num = parseInt(rowNumberInput, 10);
        if (!isNaN(num)) {
            const found = adCopies.find(c => c.type === type && c.row_number === num);
            if (found) {
                onSelect(found.id);
                onClose();
            }
        }
    };

    // Focus search input when modal opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Handle keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search & Row Number Input */}
                <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100">
                    {/* Row Number Jump */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">ID:</span>
                        <input
                            type="text"
                            value={rowNumberInput}
                            onChange={(e) => setRowNumberInput(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => e.key === 'Enter' && handleRowNumberJump()}
                            placeholder="#"
                            className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <button
                            onClick={handleRowNumberJump}
                            className="px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            Go
                        </button>
                    </div>

                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search text..."
                            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>

                    {/* Clear Selection */}
                    {currentValue && (
                        <button
                            onClick={() => { onSelect(null); onClose(); }}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* List */}
                <div className="flex-1 overflow-auto">
                    {filteredCopies.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 text-sm">
                            No {type.replace('_', ' ')} found
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredCopies.map((copy) => {
                                const isSelected = copy.id === currentValue;
                                return (
                                    <button
                                        key={copy.id}
                                        onClick={() => { onSelect(copy.id); onClose(); }}
                                        className={`w-full text-left px-6 py-3 hover:bg-gray-50 transition-colors ${
                                            isSelected ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                                                isSelected
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                #{copy.row_number || '?'}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                                                    {copy.text || <span className="italic text-gray-400">(empty)</span>}
                                                </p>
                                                {copy.name && (
                                                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                        {copy.name}
                                                    </p>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <span className="text-xs text-blue-500 font-medium">Selected</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
                    <span className="text-xs text-gray-500">
                        {filteredCopies.length} item{filteredCopies.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
