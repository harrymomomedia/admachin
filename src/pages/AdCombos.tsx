import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ArrowLeft, Image, Type, FileText, AlignLeft, Filter, X, Search, ChevronDown } from 'lucide-react';
import { DataTable, type ColumnDef } from '../components/datatable';
import { PreviewGrid } from '../components/ad-creator/PreviewGrid';
import {
    getProjects,
    getSubprojects,
    getCreatives,
    getAdCopies,
    getUsers,
    createAds,
    getUserViewPreferences,
    saveUserViewPreferences,
    getSharedViewPreferences,
    saveSharedViewPreferences,
    getCreativeUrl,
    type Project,
    type Subproject,
    type Creative,
    type AdCopy,
    type User,
    type ViewPreferencesConfig,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { generateCombinations, type AdCombination } from '../types/ad-creator';

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

// Color palette for dynamic colorMaps (same as Ads.tsx)
const colorPalette = [
    'bg-pink-500 text-white',
    'bg-indigo-500 text-white',
    'bg-cyan-500 text-white',
    'bg-amber-500 text-white',
    'bg-rose-500 text-white',
    'bg-violet-500 text-white',
    'bg-teal-500 text-white',
    'bg-orange-500 text-white',
    'bg-lime-500 text-white',
    'bg-fuchsia-500 text-white',
];

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

    // Preview state
    const [showPreview, setShowPreview] = useState(false);

    // Saving state
    const [isSaving, setIsSaving] = useState(false);

    // View preferences state for each DataTable
    const [creativesPrefs, setCreativesPrefs] = useState<ViewPreferencesConfig | null>(null);
    const [headlinesPrefs, setHeadlinesPrefs] = useState<ViewPreferencesConfig | null>(null);
    const [primaryPrefs, setPrimaryPrefs] = useState<ViewPreferencesConfig | null>(null);
    const [descriptionsPrefs, setDescriptionsPrefs] = useState<ViewPreferencesConfig | null>(null);

    // Shared/Team column preferences
    const [sharedCreativesPrefs, setSharedCreativesPrefs] = useState<ViewPreferencesConfig | null>(null);
    const [sharedHeadlinesPrefs, setSharedHeadlinesPrefs] = useState<ViewPreferencesConfig | null>(null);
    const [sharedPrimaryPrefs, setSharedPrimaryPrefs] = useState<ViewPreferencesConfig | null>(null);
    const [sharedDescriptionsPrefs, setSharedDescriptionsPrefs] = useState<ViewPreferencesConfig | null>(null);

    // Team columns dropdown state
    const [showTeamColumnsDropdown, setShowTeamColumnsDropdown] = useState(false);
    const teamColumnsDropdownRef = useRef<HTMLDivElement>(null);

    // Handle preferences change for each DataTable
    const handleCreativesPrefsChange = async (prefs: ViewPreferencesConfig) => {
        if (!currentUserId) return;
        try {
            await saveUserViewPreferences(currentUserId, 'ad-creator-creatives', prefs);
        } catch (error) {
            console.error('Failed to save creatives preferences:', error);
        }
    };

    const handleHeadlinesPrefsChange = async (prefs: ViewPreferencesConfig) => {
        if (!currentUserId) return;
        try {
            await saveUserViewPreferences(currentUserId, 'ad-creator-headlines', prefs);
        } catch (error) {
            console.error('Failed to save headlines preferences:', error);
        }
    };

    const handlePrimaryPrefsChange = async (prefs: ViewPreferencesConfig) => {
        if (!currentUserId) return;
        try {
            await saveUserViewPreferences(currentUserId, 'ad-creator-primary', prefs);
        } catch (error) {
            console.error('Failed to save primary preferences:', error);
        }
    };

    const handleDescriptionsPrefsChange = async (prefs: ViewPreferencesConfig) => {
        if (!currentUserId) return;
        try {
            await saveUserViewPreferences(currentUserId, 'ad-creator-descriptions', prefs);
        } catch (error) {
            console.error('Failed to save descriptions preferences:', error);
        }
    };

    // Handle save columns for team - saves column_widths and column_order for all tables
    const handleSaveColumnsForTeam = async () => {
        try {
            await Promise.all([
                creativesPrefs?.column_widths || creativesPrefs?.column_order
                    ? saveSharedViewPreferences('ad-creator-creatives', {
                        column_widths: creativesPrefs?.column_widths,
                        column_order: creativesPrefs?.column_order,
                    })
                    : Promise.resolve(),
                headlinesPrefs?.column_widths || headlinesPrefs?.column_order
                    ? saveSharedViewPreferences('ad-creator-headlines', {
                        column_widths: headlinesPrefs?.column_widths,
                        column_order: headlinesPrefs?.column_order,
                    })
                    : Promise.resolve(),
                primaryPrefs?.column_widths || primaryPrefs?.column_order
                    ? saveSharedViewPreferences('ad-creator-primary', {
                        column_widths: primaryPrefs?.column_widths,
                        column_order: primaryPrefs?.column_order,
                    })
                    : Promise.resolve(),
                descriptionsPrefs?.column_widths || descriptionsPrefs?.column_order
                    ? saveSharedViewPreferences('ad-creator-descriptions', {
                        column_widths: descriptionsPrefs?.column_widths,
                        column_order: descriptionsPrefs?.column_order,
                    })
                    : Promise.resolve(),
            ]);
            // Update shared prefs state
            setSharedCreativesPrefs(prev => ({
                ...prev,
                column_widths: creativesPrefs?.column_widths,
                column_order: creativesPrefs?.column_order,
            }));
            setSharedHeadlinesPrefs(prev => ({
                ...prev,
                column_widths: headlinesPrefs?.column_widths,
                column_order: headlinesPrefs?.column_order,
            }));
            setSharedPrimaryPrefs(prev => ({
                ...prev,
                column_widths: primaryPrefs?.column_widths,
                column_order: primaryPrefs?.column_order,
            }));
            setSharedDescriptionsPrefs(prev => ({
                ...prev,
                column_widths: descriptionsPrefs?.column_widths,
                column_order: descriptionsPrefs?.column_order,
            }));
        } catch (error) {
            console.error('Failed to save team columns:', error);
        }
    };

    // Handle use team columns - loads team column_widths and column_order
    const handleUseTeamColumns = () => {
        if (sharedCreativesPrefs?.column_widths || sharedCreativesPrefs?.column_order) {
            setCreativesPrefs(prev => ({
                ...prev,
                column_widths: sharedCreativesPrefs?.column_widths,
                column_order: sharedCreativesPrefs?.column_order,
            }));
        }
        if (sharedHeadlinesPrefs?.column_widths || sharedHeadlinesPrefs?.column_order) {
            setHeadlinesPrefs(prev => ({
                ...prev,
                column_widths: sharedHeadlinesPrefs?.column_widths,
                column_order: sharedHeadlinesPrefs?.column_order,
            }));
        }
        if (sharedPrimaryPrefs?.column_widths || sharedPrimaryPrefs?.column_order) {
            setPrimaryPrefs(prev => ({
                ...prev,
                column_widths: sharedPrimaryPrefs?.column_widths,
                column_order: sharedPrimaryPrefs?.column_order,
            }));
        }
        if (sharedDescriptionsPrefs?.column_widths || sharedDescriptionsPrefs?.column_order) {
            setDescriptionsPrefs(prev => ({
                ...prev,
                column_widths: sharedDescriptionsPrefs?.column_widths,
                column_order: sharedDescriptionsPrefs?.column_order,
            }));
        }
    };

    // Check if current columns match team columns
    const isMatchingTeamColumns = useMemo(() => {
        const hasTeamColumns = sharedCreativesPrefs?.column_widths || sharedCreativesPrefs?.column_order ||
            sharedHeadlinesPrefs?.column_widths || sharedHeadlinesPrefs?.column_order ||
            sharedPrimaryPrefs?.column_widths || sharedPrimaryPrefs?.column_order ||
            sharedDescriptionsPrefs?.column_widths || sharedDescriptionsPrefs?.column_order;

        if (!hasTeamColumns) return false;

        const creativesMatch =
            JSON.stringify(creativesPrefs?.column_widths || {}) === JSON.stringify(sharedCreativesPrefs?.column_widths || {}) &&
            JSON.stringify(creativesPrefs?.column_order || []) === JSON.stringify(sharedCreativesPrefs?.column_order || []);
        const headlinesMatch =
            JSON.stringify(headlinesPrefs?.column_widths || {}) === JSON.stringify(sharedHeadlinesPrefs?.column_widths || {}) &&
            JSON.stringify(headlinesPrefs?.column_order || []) === JSON.stringify(sharedHeadlinesPrefs?.column_order || []);
        const primaryMatch =
            JSON.stringify(primaryPrefs?.column_widths || {}) === JSON.stringify(sharedPrimaryPrefs?.column_widths || {}) &&
            JSON.stringify(primaryPrefs?.column_order || []) === JSON.stringify(sharedPrimaryPrefs?.column_order || []);
        const descriptionsMatch =
            JSON.stringify(descriptionsPrefs?.column_widths || {}) === JSON.stringify(sharedDescriptionsPrefs?.column_widths || {}) &&
            JSON.stringify(descriptionsPrefs?.column_order || []) === JSON.stringify(sharedDescriptionsPrefs?.column_order || []);

        return creativesMatch && headlinesMatch && primaryMatch && descriptionsMatch;
    }, [creativesPrefs, headlinesPrefs, primaryPrefs, descriptionsPrefs, sharedCreativesPrefs, sharedHeadlinesPrefs, sharedPrimaryPrefs, sharedDescriptionsPrefs]);

    // Click outside handler for team columns dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (teamColumnsDropdownRef.current && !teamColumnsDropdownRef.current.contains(event.target as Node)) {
                setShowTeamColumnsDropdown(false);
            }
        }
        if (showTeamColumnsDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showTeamColumnsDropdown]);

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

                // Load shared/team preferences for all tables
                const [sharedCreativesP, sharedHeadlinesP, sharedPrimaryP, sharedDescriptionsP] = await Promise.all([
                    getSharedViewPreferences('ad-creator-creatives'),
                    getSharedViewPreferences('ad-creator-headlines'),
                    getSharedViewPreferences('ad-creator-primary'),
                    getSharedViewPreferences('ad-creator-descriptions'),
                ]);

                if (sharedCreativesP) setSharedCreativesPrefs(sharedCreativesP);
                if (sharedHeadlinesP) setSharedHeadlinesPrefs(sharedHeadlinesP);
                if (sharedPrimaryP) setSharedPrimaryPrefs(sharedPrimaryP);
                if (sharedDescriptionsP) setSharedDescriptionsPrefs(sharedDescriptionsP);

                if (user?.id) {
                    setCurrentUserId(user.id);

                    // Load user view preferences for each DataTable
                    const [creativesP, headlinesP, primaryP, descriptionsP] = await Promise.all([
                        getUserViewPreferences(user.id, 'ad-creator-creatives'),
                        getUserViewPreferences(user.id, 'ad-creator-headlines'),
                        getUserViewPreferences(user.id, 'ad-creator-primary'),
                        getUserViewPreferences(user.id, 'ad-creator-descriptions'),
                    ]);

                    if (creativesP) setCreativesPrefs(creativesP);
                    if (headlinesP) setHeadlinesPrefs(headlinesP);
                    if (primaryP) setPrimaryPrefs(primaryP);
                    if (descriptionsP) setDescriptionsPrefs(descriptionsP);
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
            navigate('/ads');
        } catch (error) {
            console.error('Error creating ads:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to create ads: ${errorMessage}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Subproject options lookup
    const subprojectOptions = useMemo(() =>
        allSubprojects.map(s => ({ label: s.name, value: s.id })),
        [allSubprojects]
    );

    // Generate colorMaps for projects and subprojects (consistent with filter pills)
    const projectColorMap = useMemo(() =>
        projects.reduce((map, p, i) => {
            map[p.id] = colorPalette[i % colorPalette.length];
            return map;
        }, {} as Record<string, string>),
        [projects]
    );

    const subprojectColorMap = useMemo(() =>
        allSubprojects.reduce((map, s, i) => {
            map[s.id] = colorPalette[i % colorPalette.length];
            return map;
        }, {} as Record<string, string>),
        [allSubprojects]
    );

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
            width: 60,
            minWidth: 50,
            editable: false,
            type: 'thumbnail',
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
        {
            key: 'project_id',
            header: 'Project',
            width: 140,
            minWidth: 100,
            editable: false,
            type: 'select',
            options: projects.map(p => ({ label: p.name, value: p.id })),
            colorMap: projectColorMap,
        },
        {
            key: 'subproject_id',
            header: 'Subproject',
            width: 140,
            minWidth: 100,
            editable: false,
            type: 'select',
            options: subprojectOptions,
            colorMap: subprojectColorMap,
        },
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
        {
            key: 'project_id',
            header: 'Project',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'select',
            options: projects.map(p => ({ label: p.name, value: p.id })),
            colorMap: projectColorMap,
        },
        {
            key: 'subproject_id',
            header: 'Subproject',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'select',
            options: subprojectOptions,
            colorMap: subprojectColorMap,
        },
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
                        onClick={() => navigate('/ads')}
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

                {/* Spacer */}
                <div className="flex-1" />

                {/* Team Columns Dropdown */}
                <div ref={teamColumnsDropdownRef} className="relative">
                    {isMatchingTeamColumns ? (
                        /* Just show indicator when matching team columns */
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-700 whitespace-nowrap">
                            ✓ Team Columns
                        </span>
                    ) : (
                        /* Show dropdown button when not matching */
                        <>
                            <button
                                type="button"
                                onClick={() => setShowTeamColumnsDropdown(!showTeamColumnsDropdown)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap bg-gray-100 text-gray-600 hover:bg-gray-200"
                            >
                                Your Columns
                                <ChevronDown className="w-3 h-3" />
                            </button>

                            {/* Dropdown Menu */}
                            {showTeamColumnsDropdown && (
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] z-50">
                                    {/* Use Team Columns */}
                                    {(sharedCreativesPrefs?.column_widths || sharedCreativesPrefs?.column_order ||
                                      sharedHeadlinesPrefs?.column_widths || sharedHeadlinesPrefs?.column_order ||
                                      sharedPrimaryPrefs?.column_widths || sharedPrimaryPrefs?.column_order ||
                                      sharedDescriptionsPrefs?.column_widths || sharedDescriptionsPrefs?.column_order) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleUseTeamColumns();
                                                setShowTeamColumnsDropdown(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left"
                                        >
                                            Use Team Columns
                                        </button>
                                    )}

                                    {/* Save Columns for Team */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleSaveColumnsForTeam();
                                            setShowTeamColumnsDropdown(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left"
                                    >
                                        Save Columns for Team
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
                {/* Creatives Section */}
                <SelectionSection
                    title="Creatives"
                    icon={<Image className="w-4 h-4" />}
                    selectedCount={selectedCreatives.size}
                    totalCount={filteredCreatives.length}
                >
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
                        resizable={true}
                        sortable={true}
                        viewId="ad-creator-creatives"
                        userId={currentUserId || undefined}
                        initialPreferences={creativesPrefs || undefined}
                        onPreferencesChange={handleCreativesPrefsChange}
                    />
                </SelectionSection>

                {/* Headlines Section */}
                <SelectionSection
                    title="Headlines"
                    icon={<Type className="w-4 h-4" />}
                    selectedCount={selectedHeadlines.size}
                    totalCount={headlines.length}
                >
                    <DataTable
                        columns={adCopyColumns}
                        data={headlines}
                        getRowId={(row) => row.id}
                        isLoading={false}
                        emptyMessage="No headlines found"
                        selectable={true}
                        selectedIds={selectedHeadlines}
                        onSelectionChange={setSelectedHeadlines}
                        resizable={true}
                        sortable={true}
                        viewId="ad-creator-headlines"
                        userId={currentUserId || undefined}
                        initialPreferences={headlinesPrefs || undefined}
                        onPreferencesChange={handleHeadlinesPrefsChange}
                    />
                </SelectionSection>

                {/* Primary Text Section */}
                <SelectionSection
                    title="Primary Text"
                    icon={<FileText className="w-4 h-4" />}
                    selectedCount={selectedPrimary.size}
                    totalCount={primaryTexts.length}
                >
                    <DataTable
                        columns={adCopyColumns}
                        data={primaryTexts}
                        getRowId={(row) => row.id}
                        isLoading={false}
                        emptyMessage="No primary text found"
                        selectable={true}
                        selectedIds={selectedPrimary}
                        onSelectionChange={setSelectedPrimary}
                        resizable={true}
                        sortable={true}
                        viewId="ad-creator-primary"
                        userId={currentUserId || undefined}
                        initialPreferences={primaryPrefs || undefined}
                        onPreferencesChange={handlePrimaryPrefsChange}
                    />
                </SelectionSection>

                {/* Descriptions Section */}
                <SelectionSection
                    title="Descriptions"
                    icon={<AlignLeft className="w-4 h-4" />}
                    selectedCount={selectedDescriptions.size}
                    totalCount={descriptions.length}
                >
                    <DataTable
                        columns={adCopyColumns}
                        data={descriptions}
                        getRowId={(row) => row.id}
                        isLoading={false}
                        emptyMessage="No descriptions found"
                        selectable={true}
                        selectedIds={selectedDescriptions}
                        onSelectionChange={setSelectedDescriptions}
                        resizable={true}
                        sortable={true}
                        viewId="ad-creator-descriptions"
                        userId={currentUserId || undefined}
                        initialPreferences={descriptionsPrefs || undefined}
                        onPreferencesChange={handleDescriptionsPrefsChange}
                    />
                </SelectionSection>

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
