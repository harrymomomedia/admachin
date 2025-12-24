import { Flame } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface PriorityCellProps {
    value: unknown;
    maxPriority?: number;
}

/**
 * Reusable Priority cell renderer for DataTable.
 * Shows P1-P5 with flame icons. Lower number = higher priority.
 * P1: 3 flames (red), P2: 2 flames (orange), P3: 1 flame (yellow), P4-P5: no flames (gray)
 */
export function PriorityCell({
    value,
    maxPriority = 5
}: PriorityCellProps) {
    const numValue = Number(value) || 0;

    if (!value && value !== 0) {
        return <span className="text-xs text-gray-400">-</span>;
    }

    // Priority config: lower number = higher priority
    // P1 = most urgent (3 flames, red)
    // P2 = high (2 flames, orange)
    // P3 = medium (1 flame, yellow)
    // P4, P5 = low (no flames, gray)
    const getConfig = (priority: number) => {
        if (priority <= 1) {
            return { flames: 3, color: 'text-red-500', flameColor: 'text-red-500' };
        } else if (priority === 2) {
            return { flames: 2, color: 'text-orange-500', flameColor: 'text-orange-500' };
        } else if (priority === 3) {
            return { flames: 1, color: 'text-yellow-500', flameColor: 'text-yellow-500' };
        } else if (priority === 4) {
            return { flames: 0, color: 'text-gray-500', flameColor: '' };
        } else {
            return { flames: 0, color: 'text-gray-400', flameColor: '' };
        }
    };

    const config = getConfig(numValue);

    return (
        <div className="flex items-center gap-1">
            {/* P-text */}
            <span className={cn("text-xs font-semibold", config.color)}>
                P{numValue}
            </span>
            {/* Flames */}
            {config.flames > 0 && (
                <div className="flex items-center -space-x-1">
                    {Array.from({ length: config.flames }).map((_, i) => (
                        <Flame
                            key={i}
                            className={cn("w-3.5 h-3.5", config.flameColor)}
                            fill="currentColor"
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Re-export for backwards compatibility
export { PriorityCell as PriorityColumn };
