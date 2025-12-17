import { Check } from 'lucide-react';

interface CombinationSummaryProps {
    creativesCount: number;
    headlinesCount: number;
    primaryCount: number;
    descriptionsCount: number;
    totalCombinations: number;
    selectedCount: number;
    onSelectAll: () => void;
    onDeselectAll: () => void;
}

export function CombinationSummary({
    creativesCount,
    headlinesCount,
    primaryCount,
    descriptionsCount,
    totalCombinations,
    selectedCount,
    onSelectAll,
    onDeselectAll,
}: CombinationSummaryProps) {
    const allSelected = selectedCount === totalCombinations && totalCombinations > 0;
    const someSelected = selectedCount > 0 && selectedCount < totalCombinations;

    // Only show if we have all four categories selected
    const hasAllCategories = creativesCount > 0 && headlinesCount > 0 && primaryCount > 0 && descriptionsCount > 0;

    if (!hasAllCategories) {
        return (
            <div className="flex items-center justify-center py-4 px-6 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                Select at least one item from each category to see combinations
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between py-3 px-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-800">Preview:</span>
                <span className="text-sm text-blue-700">
                    {creativesCount} × {headlinesCount} × {primaryCount} × {descriptionsCount} ={' '}
                    <span className="font-bold">{totalCombinations} combinations</span>
                </span>
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={allSelected ? onDeselectAll : onSelectAll}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                    <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            allSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : someSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-blue-400'
                        }`}
                    >
                        {(allSelected || someSelected) && <Check className="w-3 h-3" />}
                    </div>
                    <span>
                        {allSelected ? 'Deselect All' : `Select All (${totalCombinations})`}
                    </span>
                </button>
            </div>
        </div>
    );
}
