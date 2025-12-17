// Types for Ad Creator feature
import type { Creative, AdCopy } from '../lib/supabase-service';

/**
 * Represents a single ad combination (cartesian product of selections)
 */
export interface AdCombination {
    /** Unique ID format: `${creativeId}_${headlineId}_${primaryId}_${descriptionId}` */
    id: string;
    creativeId: string;
    headlineId: string;
    primaryId: string;
    descriptionId: string;
}

/**
 * State for the Ad Creator modal
 */
export interface AdCreatorState {
    projectId: string | null;
    subprojectId: string | null;
    selectedCreatives: Set<string>;
    selectedHeadlines: Set<string>;
    selectedPrimary: Set<string>;
    selectedDescriptions: Set<string>;
    /** Which preview cards are checked for final creation */
    selectedCombinations: Set<string>;
}

/**
 * Selection category info for display
 */
export interface SelectionCategory {
    key: 'creatives' | 'headlines' | 'primary' | 'descriptions';
    title: string;
    type: 'creative' | 'headline' | 'primary_text' | 'description';
    items: Creative[] | AdCopy[];
    selectedIds: Set<string>;
}

/**
 * Props for the main AdCreatorModal
 */
export interface AdCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (combinations: AdCombination[]) => Promise<void>;
    creatives: Creative[];
    adCopies: AdCopy[];
}

/**
 * Props for selection items modal (nested DataTable modal)
 */
export interface SelectItemsModalProps<T> {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: T[];
    selectedIds: Set<string>;
    onSelectionChange: (selectedIds: Set<string>) => void;
    getItemId: (item: T) => string;
    columns: Array<{
        key: string;
        header: string;
        render?: (item: T) => React.ReactNode;
    }>;
}

/**
 * Props for the preview card
 */
export interface AdPreviewCardProps {
    combination: AdCombination;
    creative: Creative | undefined;
    headline: AdCopy | undefined;
    primaryText: AdCopy | undefined;
    description: AdCopy | undefined;
    isSelected: boolean;
    onToggleSelect: () => void;
}

/**
 * Generate a unique combination ID
 */
export function generateCombinationId(
    creativeId: string,
    headlineId: string,
    primaryId: string,
    descriptionId: string
): string {
    return `${creativeId}_${headlineId}_${primaryId}_${descriptionId}`;
}

/**
 * Generate all combinations (cartesian product) from selections
 */
export function generateCombinations(
    creativeIds: string[],
    headlineIds: string[],
    primaryIds: string[],
    descriptionIds: string[]
): AdCombination[] {
    const combinations: AdCombination[] = [];

    for (const c of creativeIds) {
        for (const h of headlineIds) {
            for (const p of primaryIds) {
                for (const d of descriptionIds) {
                    combinations.push({
                        id: generateCombinationId(c, h, p, d),
                        creativeId: c,
                        headlineId: h,
                        primaryId: p,
                        descriptionId: d,
                    });
                }
            }
        }
    }

    return combinations;
}
