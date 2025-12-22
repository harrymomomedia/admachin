import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check, Filter } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface QuickFilterProps {
    columnKey: string;
    header: string;
    options: { label: string; value: string | number }[];
    colorMap?: Record<string, string>;
    value: string | null; // Current filter value (null = no filter)
    onSelect: (value: string) => void;
    onClear: () => void;
}

export function QuickFilter({ columnKey, header, options, colorMap, value, onSelect, onClear }: QuickFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Calculate dropdown position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 4,
                left: Math.max(8, Math.min(rect.left, window.innerWidth - 196)),
            });
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(o => String(o.value) === value);

    // Suppress unused variable warning - columnKey is used for uniqueness
    void columnKey;

    return (
        <div className="relative flex-shrink-0">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            >
                {value && selectedOption ? (
                    <>
                        <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                            colorMap?.[String(value)] || "bg-gray-100 text-gray-700"
                        )}>
                            {selectedOption.label}
                        </span>
                        <span
                            className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                        >
                            <X className="w-3 h-3" />
                        </span>
                    </>
                ) : (
                    <>
                        <Filter className="w-3.5 h-3.5" />
                        {header}
                    </>
                )}
            </button>

            {isOpen && createPortal(
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[9998]" onClick={() => { setIsOpen(false); setSearch(''); }} />

                    {/* Dropdown - positioned within viewport bounds */}
                    <div
                        ref={dropdownRef}
                        className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl min-w-[180px] max-w-[calc(100vw-16px)] overflow-hidden"
                        style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                        }}
                    >
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={`Filter ${header.toLowerCase()}...`}
                                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                                    autoFocus
                                />
                            </div>
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
                                        onClick={() => {
                                            onSelect(String(opt.value));
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className={cn(
                                            "px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 transition-colors whitespace-nowrap flex items-center gap-2",
                                            String(opt.value) === value ? "bg-blue-50 text-blue-700" : "text-gray-700"
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
                                        {String(opt.value) === value && (
                                            <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
