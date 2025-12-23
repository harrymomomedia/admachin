import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SelectOption {
    label: string;
    value: string | number;
}

interface SingleSelectProps {
    value: string | number | undefined;
    options: SelectOption[];
    onChange: (value: string | number) => void;
    placeholder?: string;
    colorMap?: Record<string, string>;
    className?: string;
    disabled?: boolean;
    /** Allow clearing the selection with an X button */
    clearable?: boolean;
    /** Callback when selection is cleared */
    onClear?: () => void;
}

export function SingleSelect({
    value,
    options,
    onChange,
    placeholder = 'Select...',
    colorMap = {},
    className,
    disabled = false,
    clearable = false,
    onClear
}: SingleSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside - use setTimeout to allow click events to complete first
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            // Check if click is inside button or dropdown
            const isInsideButton = buttonRef.current?.contains(target);
            const isInsideDropdown = dropdownRef.current?.contains(target);

            if (!isInsideButton && !isInsideDropdown) {
                setIsOpen(false);
                setSearch('');
            }
        };

        // Use setTimeout to add listener after current event loop
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen]);

    const selectedOption = options.find(opt => String(opt.value) === String(value));
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClear) {
            onClear();
        } else {
            // Use empty string which will be converted to null by the parent
            onChange('' as unknown as string);
        }
        setIsOpen(false);
    };

    const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 200 });

    // Update dropdown position when button ref changes or dropdown opens
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const dropdownHeight = 250; // Approximate max height (search + options list)
            const spaceBelow = window.innerHeight - rect.bottom - 10;
            const spaceAbove = rect.top - 10;

            // Open upward if not enough space below and more space above
            const openUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

            setDropdownPosition({
                top: openUpward ? undefined : rect.bottom + 4,
                bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
                left: rect.left,
                width: Math.max(rect.width, 200)
            });
        }
    }, [isOpen]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border cursor-pointer transition-colors",
                    "hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500",
                    disabled && "opacity-50 cursor-not-allowed",
                    className
                )}
            >
                {selectedOption ? (
                    <span className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap",
                        colorMap[String(selectedOption.value)] || "bg-gray-100 text-gray-700 border-gray-200"
                    )}>
                        {selectedOption.label}
                        {clearable && !disabled && (
                            <span
                                onClick={handleClear}
                                className="p-0.5 -mr-0.5 hover:bg-black/10 rounded cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </span>
                        )}
                    </span>
                ) : (
                    <span className="text-gray-400 whitespace-nowrap">{placeholder}</span>
                )}
                <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    data-single-select-dropdown="true"
                    className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] overflow-hidden"
                    style={{
                        top: dropdownPosition.top,
                        bottom: dropdownPosition.bottom,
                        left: dropdownPosition.left,
                        minWidth: dropdownPosition.width,
                        maxHeight: Math.min(250, dropdownPosition.top !== undefined
                            ? window.innerHeight - (dropdownPosition.top || 0) - 10
                            : (dropdownPosition.bottom !== undefined ? window.innerHeight - dropdownPosition.bottom - 10 : 250))
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Find an option"
                                autoFocus
                                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-[200px] overflow-y-auto p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-400">No options found</div>
                        ) : (
                            filteredOptions.map(opt => {
                                const isSelected = String(opt.value) === String(value);
                                return (
                                    <button
                                        key={String(opt.value)}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                                            isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                                        )}
                                    >
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap",
                                            colorMap[String(opt.value)] || "bg-gray-100 text-gray-700 border-gray-200"
                                        )}>
                                            {opt.label}
                                        </span>
                                        {isSelected && (
                                            <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

export default SingleSelect;
