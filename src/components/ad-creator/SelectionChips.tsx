import { X, Plus } from 'lucide-react';

interface SelectionChipsProps<T> {
    icon: React.ReactNode;
    title: string;
    items: T[];
    selectedIds: Set<string>;
    getItemId: (item: T) => string;
    getItemLabel: (item: T) => string;
    onRemove: (id: string) => void;
    onSelectClick: () => void;
}

export function SelectionChips<T>({
    icon,
    title,
    items,
    selectedIds,
    getItemId,
    getItemLabel,
    onRemove,
    onSelectClick,
}: SelectionChipsProps<T>) {
    const selectedItems = items.filter((item) => selectedIds.has(getItemId(item)));
    const count = selectedIds.size;

    return (
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 min-w-[140px]">
                {icon}
                <span className="text-sm font-medium">{title}</span>
                <span className="text-xs text-gray-400">({count})</span>
            </div>
            <div className="flex-1 flex flex-wrap gap-2">
                {selectedItems.slice(0, 5).map((item) => (
                    <span
                        key={getItemId(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-700 max-w-[200px]"
                    >
                        <span className="truncate">{getItemLabel(item)}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(getItemId(item));
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                {count > 5 && (
                    <span className="text-xs text-gray-500 py-1">
                        +{count - 5} more
                    </span>
                )}
                <button
                    onClick={onSelectClick}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                >
                    <Plus className="w-3 h-3" />
                    Select...
                </button>
            </div>
        </div>
    );
}
