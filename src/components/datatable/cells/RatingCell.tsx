interface RatingCellProps {
    value: unknown;
    maxRating?: number;
    showValue?: boolean;
}

/**
 * Reusable Rating cell renderer for DataTable.
 * Shows a mini horizontal progress bar with heat gradient coloring.
 * Color transitions from blue (cold/low) through yellow to red (hot/high).
 */
export function RatingCell({
    value,
    maxRating = 5,
    showValue = true
}: RatingCellProps) {
    const numValue = Number(value) || 0;
    const percentage = Math.min((numValue / maxRating) * 100, 100);

    // Calculate heat gradient color based on percentage
    // 0-30%: blue shades (cold)
    // 30-60%: yellow/orange shades (warm)
    // 60-100%: red shades (hot)
    const getHeatColor = (pct: number): string => {
        if (pct <= 30) {
            // Blue gradient: lighter blue at 0%, darker blue at 30%
            return 'bg-blue-400';
        } else if (pct <= 50) {
            return 'bg-cyan-500';
        } else if (pct <= 70) {
            return 'bg-yellow-500';
        } else if (pct <= 85) {
            return 'bg-orange-500';
        } else {
            return 'bg-red-500';
        }
    };

    // Get background track color (lighter version of heat color)
    const getTrackColor = (pct: number): string => {
        if (pct <= 30) {
            return 'bg-blue-100';
        } else if (pct <= 50) {
            return 'bg-cyan-100';
        } else if (pct <= 70) {
            return 'bg-yellow-100';
        } else if (pct <= 85) {
            return 'bg-orange-100';
        } else {
            return 'bg-red-100';
        }
    };

    if (!value && value !== 0) {
        return <span className="text-xs text-gray-400">-</span>;
    }

    return (
        <div className="flex items-center gap-2 w-full">
            {/* Progress bar container */}
            <div className={`flex-1 h-2 rounded-full ${getTrackColor(percentage)} overflow-hidden min-w-[40px] max-w-[60px]`}>
                {/* Filled portion */}
                <div
                    className={`h-full rounded-full transition-all duration-300 ${getHeatColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {/* Value label */}
            {showValue && (
                <span className="text-[10px] font-medium text-gray-600 min-w-[20px]">
                    {numValue}
                </span>
            )}
        </div>
    );
}

// Re-export for backwards compatibility
export { RatingCell as RatingColumn };
