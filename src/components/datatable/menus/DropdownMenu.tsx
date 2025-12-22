import { useState, useRef, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface DropdownMenuProps {
    options: { label: string; value: string }[];
    value: string;
    onSelect: (value: string) => void;
    onClear?: () => void;
    position: { top: number; left: number };
    colorMap?: Record<string, string>;
}

export function DropdownMenu({ options, value, onSelect, onClear, position, colorMap }: DropdownMenuProps) {
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    // Focus search input on mount and calculate position
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Adjust position if dropdown would go off-screen
    useEffect(() => {
        if (dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const dropdownHeight = rect.height;
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - position.top - 10;

            if (spaceBelow < dropdownHeight && position.top > dropdownHeight) {
                // Not enough space below, position above
                setAdjustedPosition({
                    ...position,
                    top: position.top - dropdownHeight - 8
                });
            } else {
                setAdjustedPosition(position);
            }
        }
    }, [position]);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    // Find current selected option
    const selectedOption = options.find(o => String(o.value) === String(value));

    return (
        <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl min-w-[180px] overflow-hidden"
            style={{ top: adjustedPosition.top, left: adjustedPosition.left, maxHeight: 'calc(100vh - 20px)' }}
        >
            {/* Selected value with X to clear (Notion-style) */}
            {selectedOption && value && (
                <div className="p-2 border-b border-gray-100">
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            colorMap?.[String(value)] || "bg-gray-100 text-gray-700"
                        )}
                    >
                        {selectedOption.label}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear?.();
                            }}
                            className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                </div>
            )}

            {/* Search Input */}
            <div className="p-2 border-b border-gray-100">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Find an option"
                        className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                </div>
            </div>

            {/* Hint text */}
            <div className="px-3 py-1.5 text-[10px] text-gray-400">
                Select an option
            </div>

            {/* Options List */}
            <div className="max-h-[200px] overflow-y-auto py-1">
                {filteredOptions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400 italic whitespace-nowrap">
                        No options found
                    </div>
                ) : (
                    filteredOptions.map((opt) => (
                        <div
                            key={opt.value}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(opt.value);
                            }}
                            className={cn(
                                "px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 transition-colors whitespace-nowrap flex items-center gap-2",
                                opt.value === value ? "bg-blue-50 text-blue-700" : "text-gray-700"
                            )}
                        >
                            <span
                                className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                    colorMap?.[String(opt.value)] || "bg-gray-100 text-gray-700"
                                )}
                            >
                                {opt.label}
                            </span>
                            {opt.value === value && (
                                <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
