import { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Image, Type, FileText, AlignLeft } from 'lucide-react';
import type { Creative, AdCopy, Project, Subproject } from '../../lib/supabase-service';
import { getProjects, getSubprojects } from '../../lib/supabase-service';
import { generateCombinations, type AdCombination } from '../../types/ad-creator';
import { SelectionChips } from './SelectionChips';
import { SelectItemsModal } from './SelectItemsModal';
import { PreviewGrid } from './PreviewGrid';
import { CombinationSummary } from './CombinationSummary';

interface AdCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (combinations: AdCombination[]) => Promise<void>;
    creatives: Creative[];
    adCopies: AdCopy[];
}

export function AdCreatorModal({
    isOpen,
    onClose,
    onSave,
    creatives,
    adCopies,
}: AdCreatorModalProps) {
    // Project/subproject filter
    const [projectId, setProjectId] = useState<string | null>(null);
    const [subprojectId, setSubprojectId] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);

    // Selection state
    const [selectedCreatives, setSelectedCreatives] = useState<Set<string>>(new Set());
    const [selectedHeadlines, setSelectedHeadlines] = useState<Set<string>>(new Set());
    const [selectedPrimary, setSelectedPrimary] = useState<Set<string>>(new Set());
    const [selectedDescriptions, setSelectedDescriptions] = useState<Set<string>>(new Set());
    const [selectedCombinations, setSelectedCombinations] = useState<Set<string>>(new Set());

    // Selection modal state
    const [selectingType, setSelectingType] = useState<'creatives' | 'headlines' | 'primary' | 'descriptions' | null>(null);

    // Saving state
    const [isSaving, setIsSaving] = useState(false);

    // Load projects and subprojects
    useEffect(() => {
        if (isOpen) {
            getProjects().then(setProjects).catch(console.error);
        }
    }, [isOpen]);

    useEffect(() => {
        if (projectId) {
            getSubprojects(projectId).then(setSubprojects).catch(console.error);
        } else {
            setSubprojects([]);
            setSubprojectId(null);
        }
    }, [projectId]);

    // Filter items by project/subproject
    const filteredCreatives = useMemo(() => {
        let filtered = creatives;
        if (projectId) {
            filtered = filtered.filter(c => c.project_id === projectId || !c.project_id);
        }
        if (subprojectId) {
            filtered = filtered.filter(c => c.subproject_id === subprojectId || !c.subproject_id);
        }
        return filtered;
    }, [creatives, projectId, subprojectId]);

    const filteredAdCopies = useMemo(() => {
        let filtered = adCopies;
        if (projectId) {
            filtered = filtered.filter(c => c.project_id === projectId || !c.project_id);
        }
        if (subprojectId) {
            filtered = filtered.filter(c => c.subproject_id === subprojectId || !c.subproject_id);
        }
        return filtered;
    }, [adCopies, projectId, subprojectId]);

    // Categorize ad copies
    const headlines = useMemo(() =>
        filteredAdCopies.filter(c => c.type === 'headline'),
        [filteredAdCopies]
    );

    const primaryTexts = useMemo(() =>
        filteredAdCopies.filter(c => c.type === 'primary_text'),
        [filteredAdCopies]
    );

    const descriptions = useMemo(() =>
        filteredAdCopies.filter(c => c.type === 'description'),
        [filteredAdCopies]
    );

    // Generate combinations
    const combinations = useMemo(() => {
        if (
            selectedCreatives.size === 0 ||
            selectedHeadlines.size === 0 ||
            selectedPrimary.size === 0 ||
            selectedDescriptions.size === 0
        ) {
            return [];
        }

        return generateCombinations(
            Array.from(selectedCreatives),
            Array.from(selectedHeadlines),
            Array.from(selectedPrimary),
            Array.from(selectedDescriptions)
        );
    }, [selectedCreatives, selectedHeadlines, selectedPrimary, selectedDescriptions]);

    // Initialize selected combinations when combinations change
    useEffect(() => {
        // Select all combinations by default
        setSelectedCombinations(new Set(combinations.map(c => c.id)));
    }, [combinations]);

    // Handle save
    const handleSave = async () => {
        const selectedCombosList = combinations.filter(c => selectedCombinations.has(c.id));
        if (selectedCombosList.length === 0) return;

        setIsSaving(true);
        try {
            await onSave(selectedCombosList);
            onClose();
        } catch (error) {
            console.error('Error saving ads:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle selection modal
    const handleOpenSelectModal = (type: 'creatives' | 'headlines' | 'primary' | 'descriptions') => {
        setSelectingType(type);
    };

    const handleCloseSelectModal = () => {
        setSelectingType(null);
    };

    // Get current selection and setter for the active modal
    const getSelectionProps = useCallback(() => {
        switch (selectingType) {
            case 'creatives':
                return {
                    title: 'Select Creatives',
                    items: filteredCreatives,
                    selectedIds: selectedCreatives,
                    onSelectionChange: setSelectedCreatives,
                    getItemId: (item: Creative) => item.id,
                };
            case 'headlines':
                return {
                    title: 'Select Headlines',
                    items: headlines,
                    selectedIds: selectedHeadlines,
                    onSelectionChange: setSelectedHeadlines,
                    getItemId: (item: AdCopy) => item.id,
                };
            case 'primary':
                return {
                    title: 'Select Primary Text',
                    items: primaryTexts,
                    selectedIds: selectedPrimary,
                    onSelectionChange: setSelectedPrimary,
                    getItemId: (item: AdCopy) => item.id,
                };
            case 'descriptions':
                return {
                    title: 'Select Descriptions',
                    items: descriptions,
                    selectedIds: selectedDescriptions,
                    onSelectionChange: setSelectedDescriptions,
                    getItemId: (item: AdCopy) => item.id,
                };
            default:
                return null;
        }
    }, [
        selectingType,
        filteredCreatives,
        headlines,
        primaryTexts,
        descriptions,
        selectedCreatives,
        selectedHeadlines,
        selectedPrimary,
        selectedDescriptions,
    ]);

    // Lookup maps for preview
    const creativeMap = useMemo(() => new Map(creatives.map(c => [c.id, c])), [creatives]);
    const adCopyMap = useMemo(() => new Map(adCopies.map(c => [c.id, c])), [adCopies]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedCreatives(new Set());
            setSelectedHeadlines(new Set());
            setSelectedPrimary(new Set());
            setSelectedDescriptions(new Set());
            setSelectedCombinations(new Set());
            setProjectId(null);
            setSubprojectId(null);
            setSelectingType(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const selectionProps = getSelectionProps();

    return (
        <>
            {/* Main Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold">Create Ads</h2>
                        <button
                            onClick={onClose}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-6">
                        {/* Project/Subproject Filter */}
                        <div className="flex gap-4 mb-6">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
                                <select
                                    value={projectId || ''}
                                    onChange={(e) => setProjectId(e.target.value || null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                    <option value="">All Projects</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Subproject</label>
                                <select
                                    value={subprojectId || ''}
                                    onChange={(e) => setSubprojectId(e.target.value || null)}
                                    disabled={!projectId}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                                >
                                    <option value="">All Subprojects</option>
                                    {subprojects.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Selection Sections */}
                        <div className="space-y-3 mb-6">
                            <SelectionChips
                                icon={<Image className="w-4 h-4" />}
                                title="Creatives"
                                items={filteredCreatives}
                                selectedIds={selectedCreatives}
                                getItemId={(item) => item.id}
                                getItemLabel={(item) => item.name}
                                onRemove={(id) => {
                                    const newSet = new Set(selectedCreatives);
                                    newSet.delete(id);
                                    setSelectedCreatives(newSet);
                                }}
                                onSelectClick={() => handleOpenSelectModal('creatives')}
                            />
                            <SelectionChips
                                icon={<Type className="w-4 h-4" />}
                                title="Headlines"
                                items={headlines}
                                selectedIds={selectedHeadlines}
                                getItemId={(item) => item.id}
                                getItemLabel={(item) => item.text?.substring(0, 30) + (item.text && item.text.length > 30 ? '...' : '') || 'Untitled'}
                                onRemove={(id) => {
                                    const newSet = new Set(selectedHeadlines);
                                    newSet.delete(id);
                                    setSelectedHeadlines(newSet);
                                }}
                                onSelectClick={() => handleOpenSelectModal('headlines')}
                            />
                            <SelectionChips
                                icon={<FileText className="w-4 h-4" />}
                                title="Primary Text"
                                items={primaryTexts}
                                selectedIds={selectedPrimary}
                                getItemId={(item) => item.id}
                                getItemLabel={(item) => item.text?.substring(0, 30) + (item.text && item.text.length > 30 ? '...' : '') || 'Untitled'}
                                onRemove={(id) => {
                                    const newSet = new Set(selectedPrimary);
                                    newSet.delete(id);
                                    setSelectedPrimary(newSet);
                                }}
                                onSelectClick={() => handleOpenSelectModal('primary')}
                            />
                            <SelectionChips
                                icon={<AlignLeft className="w-4 h-4" />}
                                title="Descriptions"
                                items={descriptions}
                                selectedIds={selectedDescriptions}
                                getItemId={(item) => item.id}
                                getItemLabel={(item) => item.text?.substring(0, 30) + (item.text && item.text.length > 30 ? '...' : '') || 'Untitled'}
                                onRemove={(id) => {
                                    const newSet = new Set(selectedDescriptions);
                                    newSet.delete(id);
                                    setSelectedDescriptions(newSet);
                                }}
                                onSelectClick={() => handleOpenSelectModal('descriptions')}
                            />
                        </div>

                        {/* Combination Summary */}
                        <CombinationSummary
                            creativesCount={selectedCreatives.size}
                            headlinesCount={selectedHeadlines.size}
                            primaryCount={selectedPrimary.size}
                            descriptionsCount={selectedDescriptions.size}
                            totalCombinations={combinations.length}
                            selectedCount={selectedCombinations.size}
                            onSelectAll={() => setSelectedCombinations(new Set(combinations.map(c => c.id)))}
                            onDeselectAll={() => setSelectedCombinations(new Set())}
                        />

                        {/* Preview Grid */}
                        {combinations.length > 0 && (
                            <PreviewGrid
                                combinations={combinations}
                                selectedCombinations={selectedCombinations}
                                creativeMap={creativeMap}
                                adCopyMap={adCopyMap}
                                onToggleCombination={(id) => {
                                    const newSet = new Set(selectedCombinations);
                                    if (newSet.has(id)) {
                                        newSet.delete(id);
                                    } else {
                                        newSet.add(id);
                                    }
                                    setSelectedCombinations(newSet);
                                }}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                                Selected: {selectedCombinations.size} of {combinations.length}
                            </span>
                            <button
                                onClick={handleSave}
                                disabled={selectedCombinations.size === 0 || isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Creating...' : `Create ${selectedCombinations.size} Ads`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selection Modal */}
            {selectingType && selectionProps && (
                <SelectItemsModal
                    isOpen={true}
                    onClose={handleCloseSelectModal}
                    title={selectionProps.title}
                    items={selectionProps.items}
                    selectedIds={selectionProps.selectedIds}
                    onSelectionChange={selectionProps.onSelectionChange}
                    getItemId={selectionProps.getItemId as (item: Creative | AdCopy) => string}
                    type={selectingType}
                />
            )}
        </>
    );
}
