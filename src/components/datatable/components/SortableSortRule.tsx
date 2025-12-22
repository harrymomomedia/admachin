import { GripVertical, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../../utils/cn';
import type { ColumnDef, SortRule } from '../types';

interface SortableSortRuleProps<T> {
    rule: SortRule;
    columns: ColumnDef<T>[];
    onUpdate: (updates: Partial<SortRule>) => void;
    onRemove: () => void;
}

export function SortableSortRule<T>({
    rule,
    columns,
    onUpdate,
    onRemove
}: SortableSortRuleProps<T>) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: rule.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className={cn("flex items-center gap-2", isDragging && "opacity-50")}>
            <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
                <GripVertical className="w-4 h-4" />
            </div>
            <select
                value={rule.key}
                onChange={(e) => onUpdate({ key: e.target.value })}
                className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
            >
                {columns.map(col => (
                    <option key={col.key} value={col.key}>{col.header}</option>
                ))}
            </select>
            <select
                value={rule.direction}
                onChange={(e) => onUpdate({ direction: e.target.value as 'asc' | 'desc' })}
                className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
            >
                <option value="asc">A → Z</option>
                <option value="desc">Z → A</option>
            </select>
            <button
                onClick={onRemove}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
