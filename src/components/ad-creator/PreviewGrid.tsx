import { useState, useCallback, useRef, useEffect } from 'react';
import type { Creative, AdCopy } from '../../lib/supabase-service';
import type { AdCombination } from '../../types/ad-creator';
import { AdPreviewCard } from './AdPreviewCard';

interface PreviewGridProps {
    combinations: AdCombination[];
    selectedCombinations: Set<string>;
    creativeMap: Map<string, Creative>;
    adCopyMap: Map<string, AdCopy>;
    onToggleCombination: (id: string) => void;
}

const ITEMS_PER_PAGE = 20;

export function PreviewGrid({
    combinations,
    selectedCombinations,
    creativeMap,
    adCopyMap,
    onToggleCombination,
}: PreviewGridProps) {
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Intersection observer for lazy loading
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < combinations.length) {
                    setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, combinations.length));
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [visibleCount, combinations.length]);

    // Reset visible count when combinations change
    useEffect(() => {
        setVisibleCount(ITEMS_PER_PAGE);
    }, [combinations.length]);

    const visibleCombinations = combinations.slice(0, visibleCount);
    const hasMore = visibleCount < combinations.length;

    const getCreative = useCallback(
        (id: string) => creativeMap.get(id),
        [creativeMap]
    );

    const getAdCopy = useCallback(
        (id: string) => adCopyMap.get(id),
        [adCopyMap]
    );

    return (
        <div className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {visibleCombinations.map((combo) => (
                    <AdPreviewCard
                        key={combo.id}
                        creative={getCreative(combo.creativeId)}
                        headline={getAdCopy(combo.headlineId)}
                        primaryText={getAdCopy(combo.primaryId)}
                        description={getAdCopy(combo.descriptionId)}
                        isSelected={selectedCombinations.has(combo.id)}
                        onToggleSelect={() => onToggleCombination(combo.id)}
                    />
                ))}
            </div>

            {/* Load More Trigger */}
            {hasMore && (
                <div
                    ref={loadMoreRef}
                    className="flex items-center justify-center py-8 text-sm text-gray-500"
                >
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        Loading more... ({visibleCount} of {combinations.length})
                    </div>
                </div>
            )}

            {/* All loaded message */}
            {!hasMore && combinations.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                    Showing all {combinations.length} combinations
                </div>
            )}
        </div>
    );
}
