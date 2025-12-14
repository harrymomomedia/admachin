import { Search } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}

export function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    className,
    autoFocus = false
}: SearchInputProps) {
    return (
        <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                className={cn(
                    "w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50",
                    "focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white",
                    className
                )}
            />
        </div>
    );
}

export default SearchInput;
