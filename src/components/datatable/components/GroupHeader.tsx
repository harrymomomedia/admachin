import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface GroupHeaderProps {
    groupValue: string;
    count: number;
    isCollapsed: boolean;
    onToggle: () => void;
    colSpan: number;
    colorClass?: string;
    level?: number;
}

export function GroupHeader({ groupValue, count, isCollapsed, onToggle, colSpan, colorClass, level = 0 }: GroupHeaderProps) {
    return (
        <tr className="bg-gray-50 border-b border-gray-200">
            <td colSpan={colSpan} className="px-2 py-1.5">
                <button
                    type="button"
                    onClick={onToggle}
                    style={{ paddingLeft: `${level * 20}px` }}
                    className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors w-full"
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium",
                        colorClass || "bg-gray-500 text-white"
                    )}>
                        {groupValue}
                    </span>
                    <span className="text-gray-400 text-[10px]">
                        {count} {count === 1 ? 'item' : 'items'}
                    </span>
                </button>
            </td>
        </tr>
    );
}
