import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Image, Type, FileText, AlignLeft } from 'lucide-react';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { CreativeCard } from '../components/CardView';
import { PreviewGrid } from '../components/ad-creator/PreviewGrid';
import {
    getProjects,
    getSubprojects,
    getCreatives,
    getAdCopies,
    getUsers,
    createAds,
    type Project,
    type Subproject,
    type Creative,
    type AdCopy,
    type User,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { generateCombinations, type AdCombination } from '../types/ad-creator';

interface CollapsibleSectionProps {
    title: string;
    icon: React.ReactNode;
    selectedCount: number;
    totalCount: number;
    defaultExpanded?: boolean;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
}

function CollapsibleSection({
    title,
    icon,
    selectedCount,
    totalCount,
    defaultExpanded = true,
    headerRight,
    children,
}: CollapsibleSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-3 hover:text-gray-900 transition-colors"
                >
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="text-gray-600">{icon}</span>
                    <span className="font-medium text-gray-900">{title}</span>
                    <span className="text-sm text-gray-500">
                        ({selectedCount} of {totalCount} selected)
                    </span>
                    {selectedCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                            {selectedCount} selected
                        </span>
                    )}
                </button>
                {headerRight && (
                    <div onClick={(e) => e.stopPropagation()}>
                        {headerRight}
                    </div>
                )}
            </div>
            {isExpanded && (
                <div className="border-t border-gray-200">
                    {children}
                </div>
            )}
        </div>
    );
}

export function AdCreator() {
    const navigate = useNavigate();

    // Data state
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [allSubprojects, setAllSubprojects] = useState<Subproject[]>([]);
    const [creatives, setCreatives] = useState<Creative[]>([]);
    const [adCopies, setAdCopies] = useState<AdCopy[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Filter state
    const [projectId, setProjectId] = useState<string | null>(null);
    const [subprojectId, setSubprojectId] = useState<string | null>(null);
    const [createdById, setCreatedById] = useState<string | null>(null);

    // View mode state - default to gallery for creatives
    const [creativesViewMode, setCreativesViewMode] = useState<'table' | 'gallery'>('gallery');

    // Selection state
    const [selectedCreatives, setSelectedCreatives] = useState<Set<string>>(new Set());
    const [selectedHeadlines, setSelectedHeadlines] = useState<Set<string>>(new Set());
    const [selectedPrimary, setSelectedPrimary] = useState<Set<string>>(new Set());
    const [selectedDescriptions, setSelectedDescriptions] = useState<Set<string>>(new Set());
    const [selectedCombinations, setSelectedCombinations] = useState<Set<string>>(new Set());

    // Preview state
    const [showPreview, setShowPreview] = useState(false);

    // Saving state
    const [isSaving, setIsSaving] = useState(false);

    // Load initial data
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            try {
                const [projectsData, subprojectsData, creativesData, adCopiesData, usersData, user] = await Promise.all([
                    getProjects(),
                    getSubprojects(),
                    getCreatives(),
                    getAdCopies(),
                    getUsers(),
                    getCurrentUser(),
                ]);

                setProjects(projectsData);
                setAllSubprojects(subprojectsData);
                setSubprojects(subprojectsData);
                setCreatives(creativesData);
                setAdCopies(adCopiesData);
                setUsers(usersData);
                if (user?.id) {
                    setCurrentUserId(user.id);
                }
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, []);

    // Filter subprojects when project changes
    useEffect(() => {
        if (projectId) {
            setSubprojects(allSubprojects.filter(s => s.project_id === projectId));
            setSubprojectId(null);
        } else {
            setSubprojects(allSubprojects);
            setSubprojectId(null);
        }
    }, [projectId, allSubprojects]);

    // Filter data by project/subproject/createdBy
    const filteredCreatives = useMemo(() => {
        let filtered = creatives;
        if (projectId) {
            filtered = filtered.filter(c => c.project_id === projectId || !c.project_id);
        }
        if (subprojectId) {
            filtered = filtered.filter(c => c.subproject_id === subprojectId || !c.subproject_id);
        }
        if (createdById) {
            filtered = filtered.filter(c => c.user_id === createdById);
        }
        return filtered;
    }, [creatives, projectId, subprojectId, createdById]);

    const filteredAdCopies = useMemo(() => {
        let filtered = adCopies;
        if (projectId) {
            filtered = filtered.filter(c => c.project_id === projectId || !c.project_id);
        }
        if (subprojectId) {
            filtered = filtered.filter(c => c.subproject_id === subprojectId || !c.subproject_id);
        }
        if (createdById) {
            filtered = filtered.filter(c => c.user_id === createdById);
        }
        return filtered;
    }, [adCopies, projectId, subprojectId, createdById]);

    // Categorize ad copies
    const headlines = useMemo(() => filteredAdCopies.filter(c => c.type === 'headline'), [filteredAdCopies]);
    const primaryTexts = useMemo(() => filteredAdCopies.filter(c => c.type === 'primary_text'), [filteredAdCopies]);
    const descriptions = useMemo(() => filteredAdCopies.filter(c => c.type === 'description'), [filteredAdCopies]);

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

    // Auto-show preview for small combination counts, require button for large
    const shouldAutoPreview = combinations.length > 0 && combinations.length <= 100;
    const needsManualPreview = combinations.length > 100;

    // Initialize selected combinations when combinations change
    useEffect(() => {
        setSelectedCombinations(new Set(combinations.map(c => c.id)));
        if (shouldAutoPreview) {
            setShowPreview(true);
        } else if (needsManualPreview) {
            setShowPreview(false);
        }
    }, [combinations, shouldAutoPreview, needsManualPreview]);

    // Lookup maps for preview
    const creativeMap = useMemo(() => new Map(creatives.map(c => [c.id, c])), [creatives]);
    const adCopyMap = useMemo(() => new Map(adCopies.map(c => [c.id, c])), [adCopies]);

    // Handle save
    const handleSave = async () => {
        const selectedCombosList = combinations.filter(c => selectedCombinations.has(c.id));
        if (selectedCombosList.length === 0) return;

        setIsSaving(true);
        try {
            const adsToCreate = selectedCombosList.map(combo => ({
                creative_id: combo.creativeId,
                headline_id: combo.headlineId,
                primary_id: combo.primaryId,
                description_id: combo.descriptionId,
                user_id: currentUserId,
                project_id: projectId,
                subproject_id: subprojectId,
            }));

            await createAds(adsToCreate);
            navigate('/ads');
        } catch (error) {
            console.error('Error creating ads:', error);
            alert('Failed to create ads. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Subproject options lookup
    const subprojectOptions = useMemo(() =>
        allSubprojects.map(s => ({ label: s.name, value: s.id })),
        [allSubprojects]
    );

    // Column definitions for Creatives DataTable
    const creativeColumns: ColumnDef<Creative>[] = [
        {
            key: 'name',
            header: 'Name',
            width: 200,
            minWidth: 150,
            editable: false,
            type: 'text',
        },
        {
            key: 'media_type',
            header: 'Type',
            width: 80,
            minWidth: 60,
            editable: false,
            type: 'select',
            options: [
                { label: 'Image', value: 'image' },
                { label: 'Video', value: 'video' },
            ],
            colorMap: {
                'image': 'bg-blue-500 text-white',
                'video': 'bg-purple-500 text-white',
            },
        },
        {
            key: 'dimensions',
            header: 'Dimensions',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'text',
            getValue: (row) => {
                if (row.width && row.height) {
                    return `${row.width}×${row.height}`;
                }
                return '-';
            },
        },
        {
            key: 'project_id',
            header: 'Project',
            width: 140,
            minWidth: 100,
            editable: false,
            type: 'select',
            options: projects.map(p => ({ label: p.name, value: p.id })),
        },
        {
            key: 'subproject_id',
            header: 'Subproject',
            width: 140,
            minWidth: 100,
            editable: false,
            type: 'select',
            options: subprojectOptions,
        },
        {
            key: 'created_at',
            header: 'Created',
            width: 100,
            minWidth: 80,
            editable: false,
            type: 'date',
        },
    ];

    // Column definitions for AdCopy DataTables
    const adCopyColumns: ColumnDef<AdCopy>[] = [
        {
            key: 'text',
            header: 'Text',
            width: 350,
            minWidth: 200,
            editable: false,
            type: 'text',
        },
        {
            key: 'project_id',
            header: 'Project',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'select',
            options: projects.map(p => ({ label: p.name, value: p.id })),
        },
        {
            key: 'subproject_id',
            header: 'Subproject',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'select',
            options: subprojectOptions,
        },
        {
            key: 'created_at',
            header: 'Created',
            width: 100,
            minWidth: 80,
            editable: false,
            type: 'date',
        },
    ];

    // Check if all categories have selections
    const hasAllSelections = selectedCreatives.size > 0 &&
        selectedHeadlines.size > 0 &&
        selectedPrimary.size > 0 &&
        selectedDescriptions.size > 0;

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/ads')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Back to Ads</span>
                    </button>
                    <div className="h-6 w-px bg-gray-300" />
                    <h1 className="text-lg font-semibold text-gray-900">Create Ads</h1>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
                <div className="w-52">
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
                <div className="w-52">
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
                <div className="w-52">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Created By</label>
                    <select
                        value={createdById || ''}
                        onChange={(e) => setCreatedById(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                        <option value="">All Users</option>
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.first_name} {u.last_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
                {/* Creatives Section */}
                <CollapsibleSection
                    title="Creatives"
                    icon={<Image className="w-4 h-4" />}
                    selectedCount={selectedCreatives.size}
                    totalCount={filteredCreatives.length}
                >
                    <div className="h-[400px]">
                        <DataTable
                            columns={creativeColumns}
                            data={filteredCreatives}
                            getRowId={(row) => row.id}
                            isLoading={false}
                            emptyMessage="No creatives found"
                            selectable={true}
                            selectedIds={selectedCreatives}
                            onSelectionChange={setSelectedCreatives}
                            viewMode={creativesViewMode}
                            onViewModeChange={setCreativesViewMode}
                            cardColumns={5}
                            renderCard={(creative, isSelected, onToggle) => (
                                <CreativeCard
                                    creative={creative}
                                    isSelected={isSelected}
                                    onToggle={onToggle}
                                    selectable={true}
                                />
                            )}
                        />
                    </div>
                </CollapsibleSection>

                {/* Headlines Section */}
                <CollapsibleSection
                    title="Headlines"
                    icon={<Type className="w-4 h-4" />}
                    selectedCount={selectedHeadlines.size}
                    totalCount={headlines.length}
                >
                    <div className="h-[250px]">
                        <DataTable
                            columns={adCopyColumns}
                            data={headlines}
                            getRowId={(row) => row.id}
                            isLoading={false}
                            emptyMessage="No headlines found"
                            selectable={true}
                            selectedIds={selectedHeadlines}
                            onSelectionChange={setSelectedHeadlines}
                        />
                    </div>
                </CollapsibleSection>

                {/* Primary Text Section */}
                <CollapsibleSection
                    title="Primary Text"
                    icon={<FileText className="w-4 h-4" />}
                    selectedCount={selectedPrimary.size}
                    totalCount={primaryTexts.length}
                >
                    <div className="h-[250px]">
                        <DataTable
                            columns={adCopyColumns}
                            data={primaryTexts}
                            getRowId={(row) => row.id}
                            isLoading={false}
                            emptyMessage="No primary text found"
                            selectable={true}
                            selectedIds={selectedPrimary}
                            onSelectionChange={setSelectedPrimary}
                        />
                    </div>
                </CollapsibleSection>

                {/* Descriptions Section */}
                <CollapsibleSection
                    title="Descriptions"
                    icon={<AlignLeft className="w-4 h-4" />}
                    selectedCount={selectedDescriptions.size}
                    totalCount={descriptions.length}
                >
                    <div className="h-[250px]">
                        <DataTable
                            columns={adCopyColumns}
                            data={descriptions}
                            getRowId={(row) => row.id}
                            isLoading={false}
                            emptyMessage="No descriptions found"
                            selectable={true}
                            selectedIds={selectedDescriptions}
                            onSelectionChange={setSelectedDescriptions}
                        />
                    </div>
                </CollapsibleSection>

                {/* Summary Section */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-gray-700">Summary:</span>
                            {hasAllSelections ? (
                                <span className="text-sm text-gray-600">
                                    {selectedCreatives.size} × {selectedHeadlines.size} × {selectedPrimary.size} × {selectedDescriptions.size} ={' '}
                                    <span className="font-bold text-blue-600">{combinations.length} combinations</span>
                                </span>
                            ) : (
                                <span className="text-sm text-amber-600">
                                    Select at least one item from each category
                                </span>
                            )}
                        </div>
                        {needsManualPreview && !showPreview && (
                            <button
                                onClick={() => setShowPreview(true)}
                                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                Generate Preview ({combinations.length} combinations)
                            </button>
                        )}
                    </div>
                </div>

                {/* Preview Section */}
                {hasAllSelections && (showPreview || shouldAutoPreview) && combinations.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <span className="font-medium text-gray-900">Preview</span>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500">
                                    {selectedCombinations.size} of {combinations.length} selected
                                </span>
                                <button
                                    onClick={() => {
                                        if (selectedCombinations.size === combinations.length) {
                                            setSelectedCombinations(new Set());
                                        } else {
                                            setSelectedCombinations(new Set(combinations.map(c => c.id)));
                                        }
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    {selectedCombinations.size === combinations.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                        </div>
                        <div className="p-4">
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
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200 flex-shrink-0">
                <button
                    onClick={() => navigate('/ads')}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                    Cancel
                </button>
                <div className="flex items-center gap-4">
                    {hasAllSelections && (
                        <span className="text-sm text-gray-500">
                            Selected: {selectedCombinations.size} of {combinations.length}
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={selectedCombinations.size === 0 || isSaving}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Creating...' : `Create ${selectedCombinations.size} Ads`}
                    </button>
                </div>
            </div>
        </div>
    );
}
