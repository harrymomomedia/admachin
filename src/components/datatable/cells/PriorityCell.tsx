import { cn } from '../../../utils/cn';

interface PriorityCellProps {
    value: unknown;
    maxPriority?: number;
}

/**
 * Reusable Priority cell renderer for DataTable.
 * Shows color-coded priority value (red for high, orange for medium, gray for low).
 */
export function PriorityCell({
    value,
    maxPriority = 5
}: PriorityCellProps) {
    const numValue = Number(value) || 0;

    // Calculate thresholds based on maxPriority
    // High: top 20% (e.g., 4-5 out of 5)
    // Medium: middle 40% (e.g., 2-3 out of 5)
    // Low: bottom 40% (e.g., 1 out of 5)
    const highThreshold = Math.ceil(maxPriority * 0.8);
    const mediumThreshold = Math.ceil(maxPriority * 0.4);

    return (
        <span className={cn(
            "text-xs font-medium",
            numValue >= highThreshold
                ? "text-red-600"
                : numValue >= mediumThreshold
                    ? "text-orange-500"
                    : "text-gray-600"
        )}>
            {value ? String(value) : '-'}
        </span>
    );
}

// Re-export for backwards compatibility
export { PriorityCell as PriorityColumn };
