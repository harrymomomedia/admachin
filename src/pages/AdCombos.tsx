import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ArrowLeft, Image, Type, FileText, AlignLeft, Filter, X, Search, ChevronDown, Plus } from 'lucide-react';
import { DataTable, DataTableSelectionModal, type ColumnDef } from '../components/datatable';
import { PreviewGrid } from '../components/ad-creator/PreviewGrid';
import {
    getProjects,
    getSubprojects,
    getCreatives,
    getAdCopies,
    getUsers,
    createAds,
    getCreativeUrl,
    type Project,
    type Subproject,
    type Creative,
    type AdCopy,
    type User,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { generateCombinations, type AdCombination } from '../types/ad-creator';
import {
    generateColorMap,
    createProjectColumn,
    createSubprojectColumn,
} from '../lib/datatable-defaults';

interface SelectionCardProps {
    title: string;
    icon: React.ReactNode;
    selectedCount: number;
    totalCount: number;
    onClick: () => void;
    selectedItems?: string[];
    accentColor?: string;
}

function SelectionCard({
    title,
    icon,
    selectedCount,
    totalCount,
    onClick,
    selectedItems = [],
    accentColor = 'blue',
}: SelectionCardProps) {
    const colorClasses: Record<string, { bg: string; text: string; border: string; badge: string }> = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
        green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
    };

    const colors = colorClasses[accentColor] || colorClasses.blue;
    const hasSelection = selectedCount > 0;

    return (
        <div
            className={`flex-1 min-w-[200px] border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                hasSelection ? `${colors.border} ${colors.bg}` : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={onClick}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className={hasSelection ? colors.text : 'text-gray-500'}>{icon}</span>
                    <span className="font-medium text-gray-900">{title}</span>
                </div>
                <Plus className={`w-5 h-5 ${hasSelection ? colors.text : 'text-gray-400'}`} />
            </div>

            <div className="flex items-center gap-2">
                {hasSelection ? (
                    <span className={`px-2.5 py-1 text-sm font-semibold rounded-full ${colors.badge}`}>
                        {selectedCount} selected
                    </span>
                ) : (
                    <span className="text-sm text-gray-500">Click to select from {totalCount}</span>
                )}
            </div>

            {/* Preview of selected items */}
            {selectedItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500 space-y-1 max-h-[60px] overflow-hidden">
                        {selectedItems.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="truncate">{item}</div>
                        ))}
                        {selectedItems.length > 2 && (
                            <div className="text-gray-400">+{selectedItems.length - 2} more</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

interface SelectionSectionProps {
    title: string;
    icon: React.ReactNode;
    selectedCount: number;
    totalCount: number;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
}

function SelectionSection({
    title,
    icon,
    selectedCount,
    totalCount,
    headerRight,
    children,
}: SelectionSectionProps) {
    return (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden flex flex-col max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-3">
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
                </div>
                {headerRight && (
                    <div onClick={(e) => e.stopPropagation()}>
                        {headerRight}
                    </div>
                )}
            </div>
            {/* Content - scrollable when exceeds max-height */}
            <div className="overflow-auto">
                {children}
            </div>
        </div>
    );
}


interface FilterPillProps {
    label: string;
    options: { label: string; value: string; color?: string }[];
    value: string | null;
    onSelect: (value: string | null) => void;
    disabled?: boolean;
}

function FilterPill({ label, options, value, onSelect, disabled }: FilterPillProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Calculate dropdown position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left,
            });
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative flex-shrink-0">
            <button
                ref={buttonRef}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap border ${
                    disabled
                        ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
                }`}
            >
                {value && selectedOption ? (
                    <>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            selectedOption.color || 'bg-gray-100 text-gray-700'
                        }`}>
                            {selectedOption.label}
                        </span>
                        <span
                            className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(null);
                            }}
                        >
                            <X className="w-3 h-3" />
                        </span>
                    </>
                ) : (
                    <>
                        <Filter className="w-3.5 h-3.5" />
                        {label}
                    </>
                )}
            </button>

            {isOpen && createPortal(
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[9998]" onClick={() => { setIsOpen(false); setSearch(''); }} />

                    {/* Dropdown */}
                    <div
                        ref={dropdownRef}
                        className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl min-w-[200px] overflow-hidden"
                        style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                        }}
                    >
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search..."
                                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Options */}
                        <div className="max-h-[200px] overflow-y-auto py-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-500">No options found</div>
                            ) : (
                                filteredOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            onSelect(opt.value);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 ${
                                            opt.value === value ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                            opt.color || 'bg-gray-100 text-gray-700'
                                        }`}>
                                            {opt.label}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

export function AdCombos() {
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

    // Modal state for DataTable selection modals
    const [openModal, setOpenModal] = useState<'creatives' | 'headlines' | 'primary' | 'descriptions' | null>(null);

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
            filtered = filtered.filter(c => c.project_id === projectId);
        }
        if (subprojectId) {
            filtered = filtered.filter(c => c.subproject_id === subprojectId);
        }
        if (createdById) {
            filtered = filtered.filter(c => c.user_id === createdById);
        }
        return filtered;
    }, [creatives, projectId, subprojectId, createdById]);

    const filteredAdCopies = useMemo(() => {
        let filtered = adCopies;
        if (projectId) {
            filtered = filtered.filter(c => c.project_id === projectId);
        }
        if (subprojectId) {
            filtered = filtered.filter(c => c.subproject_id === subprojectId);
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

    // Lookup maps for names
    const projectNameMap = useMemo(() =>
        new Map(projects.map(p => [p.id, p.name])),
        [projects]
    );
    const subprojectNameMap = useMemo(() =>
        new Map(allSubprojects.map(s => [s.id, s.name])),
        [allSubprojects]
    );
    const userNameMap = useMemo(() =>
        new Map(users.map(u => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim()])),
        [users]
    );

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
            navigate('/ad-combos');
        } catch (error) {
            console.error('Error creating ads:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to create ads: ${errorMessage}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Generate colorMaps using shared utility
    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(allSubprojects), [allSubprojects]);

    // Column definitions for Creatives DataTable
    const creativeColumns: ColumnDef<Creative>[] = [
        {
            key: 'row_number',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            type: 'id',
        },
        {
            key: 'preview',
            header: 'Preview',
            width: 70,
            minWidth: 60,
            editable: false,
            type: 'media',
            thumbnailSize: 'small',
            mediaTypeKey: 'type',
            getValue: (row: Creative) => {
                const dims = row.dimensions as { thumbnail?: string } | null;
                return dims?.thumbnail ? getCreativeUrl(dims.thumbnail) : getCreativeUrl(row.storage_path);
            },
        },
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
            getValue: (row: Creative) => {
                const dims = row.dimensions as { width?: number; height?: number } | null;
                if (dims?.width && dims?.height) {
                    return `${dims.width}×${dims.height}`;
                }
                return '-';
            },
        },
        createProjectColumn<Creative>({ projects, subprojects: allSubprojects, projectColorMap, editable: false }),
        createSubprojectColumn<Creative>({ projects, subprojects: allSubprojects, subprojectColorMap, editable: false }),
        {
            key: 'user_id',
            header: 'Created By',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'people',
            users: users,
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
            key: 'row_number',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            type: 'id',
        },
        {
            key: 'text',
            header: 'Text',
            width: 350,
            minWidth: 200,
            editable: false,
            type: 'text',
        },
        createProjectColumn<AdCopy>({ projects, subprojects: allSubprojects, projectColorMap, editable: false }),
        createSubprojectColumn<AdCopy>({ projects, subprojects: allSubprojects, subprojectColorMap, editable: false }),
        {
            key: 'user_id',
            header: 'Created By',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'people',
            users: users,
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
                        onClick={() => navigate('/ad-combos')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Back to Ads</span>
                    </button>
                    <div className="h-6 w-px bg-gray-300" />
                    <h1 className="text-2xl font-bold text-gray-900">Create Ads</h1>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
                <FilterPill
                    label="Project"
                    options={projects.map((p) => ({
                        label: p.name,
                        value: p.id,
                        color: projectColorMap[p.id]
                    }))}
                    value={projectId}
                    onSelect={setProjectId}
                />
                <FilterPill
                    label="Subproject"
                    options={subprojects.map((s) => ({
                        label: s.name,
                        value: s.id,
                        color: subprojectColorMap[s.id]
                    }))}
                    value={subprojectId}
                    onSelect={setSubprojectId}
                    disabled={!projectId}
                />
                <FilterPill
                    label="Created By"
                    options={users.map((u) => ({
                        label: `${u.first_name} ${u.last_name}`,
                        value: u.id
                    }))}
                    value={createdById}
                    onSelect={setCreatedById}
                />

            </div>

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
                {/* Selection Cards Row */}
                <div className="flex gap-4 flex-wrap">
                    <SelectionCard
                        title="Creatives"
                        icon={<Image className="w-5 h-5" />}
                        selectedCount={selectedCreatives.size}
                        totalCount={filteredCreatives.length}
                        onClick={() => setOpenModal('creatives')}
                        selectedItems={Array.from(selectedCreatives).map(id => {
                            const creative = filteredCreatives.find(c => c.id === id);
                            return creative?.name || id;
                        })}
                        accentColor="blue"
                    />
                    <SelectionCard
                        title="Headlines"
                        icon={<Type className="w-5 h-5" />}
                        selectedCount={selectedHeadlines.size}
                        totalCount={headlines.length}
                        onClick={() => setOpenModal('headlines')}
                        selectedItems={Array.from(selectedHeadlines).map(id => {
                            const headline = headlines.find(h => h.id === id);
                            return headline?.text || id;
                        })}
                        accentColor="purple"
                    />
                    <SelectionCard
                        title="Primary Text"
                        icon={<FileText className="w-5 h-5" />}
                        selectedCount={selectedPrimary.size}
                        totalCount={primaryTexts.length}
                        onClick={() => setOpenModal('primary')}
                        selectedItems={Array.from(selectedPrimary).map(id => {
                            const primary = primaryTexts.find(p => p.id === id);
                            return primary?.text || id;
                        })}
                        accentColor="green"
                    />
                    <SelectionCard
                        title="Descriptions"
                        icon={<AlignLeft className="w-5 h-5" />}
                        selectedCount={selectedDescriptions.size}
                        totalCount={descriptions.length}
                        onClick={() => setOpenModal('descriptions')}
                        selectedItems={Array.from(selectedDescriptions).map(id => {
                            const desc = descriptions.find(d => d.id === id);
                            return desc?.text || id;
                        })}
                        accentColor="amber"
                    />
                </div>

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
                    onClick={() => navigate('/ad-combos')}
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

            {/* Selection Modals */}
            <DataTableSelectionModal
                title="Select Creatives"
                isOpen={openModal === 'creatives'}
                onClose={() => setOpenModal(null)}
                onConfirm={(ids) => setSelectedCreatives(ids)}
                initialSelectedIds={selectedCreatives}
                confirmText="Select Creatives"
                columns={creativeColumns}
                data={filteredCreatives}
                getRowId={(row) => row.id}
                emptyMessage="No creatives found"
                viewMode={creativesViewMode}
                onViewModeChange={setCreativesViewMode}
                cardColumns={5}
                galleryConfig={{
                    mediaUrlKey: 'storage_path',
                    mediaTypeKey: 'type',
                    nameKey: 'name',
                    projectKey: 'project_id',
                    subprojectKey: 'subproject_id',
                    userKey: 'user_id',
                    dateKey: 'created_at',
                    fileSizeKey: 'file_size',
                    rowNumberKey: 'row_number',
                    showFileInfo: false,
                }}
                galleryLookups={{
                    projects: projectNameMap,
                    subprojects: subprojectNameMap,
                    users: userNameMap,
                    projectColors: projectColorMap,
                    subprojectColors: subprojectColorMap,
                }}
                viewId="ad-creator-creatives"
            />

            <DataTableSelectionModal
                title="Select Headlines"
                isOpen={openModal === 'headlines'}
                onClose={() => setOpenModal(null)}
                onConfirm={(ids) => setSelectedHeadlines(ids)}
                initialSelectedIds={selectedHeadlines}
                confirmText="Select Headlines"
                columns={adCopyColumns}
                data={headlines}
                getRowId={(row) => row.id}
                emptyMessage="No headlines found"
                viewId="ad-creator-headlines"
            />

            <DataTableSelectionModal
                title="Select Primary Text"
                isOpen={openModal === 'primary'}
                onClose={() => setOpenModal(null)}
                onConfirm={(ids) => setSelectedPrimary(ids)}
                initialSelectedIds={selectedPrimary}
                confirmText="Select Primary Text"
                columns={adCopyColumns}
                data={primaryTexts}
                getRowId={(row) => row.id}
                emptyMessage="No primary text found"
                viewId="ad-creator-primary"
            />

            <DataTableSelectionModal
                title="Select Descriptions"
                isOpen={openModal === 'descriptions'}
                onClose={() => setOpenModal(null)}
                onConfirm={(ids) => setSelectedDescriptions(ids)}
                initialSelectedIds={selectedDescriptions}
                confirmText="Select Descriptions"
                columns={adCopyColumns}
                data={descriptions}
                getRowId={(row) => row.id}
                emptyMessage="No descriptions found"
                viewId="ad-creator-descriptions"
            />
        </div>
    );
}
