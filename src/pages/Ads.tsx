import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { DataTablePageLayout } from '../components/DataTablePageLayout';
import {
    getAds,
    createAd,
    updateAd,
    deleteAd,
    getProjects,
    getSubprojects,
    getUsers,
    getCreatives,
    getAdCopies,
    getUserViewPreferences,
    saveUserViewPreferences,
    deleteUserViewPreferences,
    getSharedViewPreferences,
    saveSharedViewPreferences,
    saveRowOrder,
    type Ad,
    type Project,
    type Subproject,
    type User,
    type Creative,
    type AdCopy,
    type ViewPreferencesConfig
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { AdPreviewCard } from '../components/AdPreviewCard';

export function Ads() {
    const navigate = useNavigate();
    const [ads, setAds] = useState<Ad[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [creatives, setCreatives] = useState<Creative[]>([]);
    const [adCopies, setAdCopies] = useState<AdCopy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // View preferences state
    const [userPreferences, setUserPreferences] = useState<ViewPreferencesConfig | null>(null);
    const [sharedPreferences, setSharedPreferences] = useState<ViewPreferencesConfig | null>(null);

    // Handle view preferences change (auto-save per user)
    const handlePreferencesChange = async (preferences: ViewPreferencesConfig) => {
        if (!currentUserId) return;
        try {
            await saveUserViewPreferences(currentUserId, 'ads', preferences);
        } catch (error) {
            console.error('Failed to save view preferences:', error);
        }
    };

    // Handle save for everyone
    const handleSaveForEveryone = async (preferences: ViewPreferencesConfig) => {
        try {
            const rowOrder = ads.map(a => a.id);
            await saveSharedViewPreferences('ads', {
                ...preferences,
                row_order: rowOrder
            });
            setSharedPreferences({
                ...preferences,
                row_order: rowOrder
            });
        } catch (error) {
            console.error('Failed to save shared preferences:', error);
        }
    };

    // Handle reset to shared preferences
    const handleResetPreferences = async () => {
        if (!currentUserId) return;
        try {
            await deleteUserViewPreferences(currentUserId, 'ads');
            setUserPreferences(null);
        } catch (error) {
            console.error('Failed to reset preferences:', error);
        }
    };

    // Load Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [adsData, projectsData, subprojectsData, usersData, creativesData, adCopiesData, user, sharedPrefs] = await Promise.all([
                getAds(),
                getProjects(),
                getSubprojects(),
                getUsers(),
                getCreatives(),
                getAdCopies(),
                getCurrentUser(),
                getSharedViewPreferences('ads')
            ]);

            // Store shared preferences
            if (sharedPrefs) {
                setSharedPreferences({
                    sort_config: sharedPrefs.sort_config,
                    filter_config: sharedPrefs.filter_config,
                    group_config: sharedPrefs.group_config,
                    wrap_config: sharedPrefs.wrap_config,
                    row_order: sharedPrefs.row_order,
                    column_widths: sharedPrefs.column_widths,
                    column_order: sharedPrefs.column_order
                });
            }

            if (user?.id) {
                setCurrentUserId(user.id);
                const prefs = await getUserViewPreferences(user.id, 'ads');

                if (prefs) {
                    setUserPreferences({
                        sort_config: prefs.sort_config,
                        filter_config: prefs.filter_config,
                        group_config: prefs.group_config,
                        wrap_config: prefs.wrap_config,
                        row_order: prefs.row_order,
                        column_widths: prefs.column_widths,
                        column_order: prefs.column_order
                    });
                }

                // Load row order
                const rowOrder = prefs?.row_order || sharedPrefs?.row_order;
                if (rowOrder && rowOrder.length > 0) {
                    const orderMap = new Map(rowOrder.map((id, index) => [id, index]));
                    const ordered = [...adsData].sort((a, b) => {
                        const aIndex = orderMap.get(a.id) ?? Infinity;
                        const bIndex = orderMap.get(b.id) ?? Infinity;
                        return aIndex - bIndex;
                    });
                    setAds(ordered);
                } else {
                    setAds(adsData);
                }
            } else {
                setAds(adsData);
            }
            setProjects(projectsData);
            setSubprojects(subprojectsData);
            setUsers(usersData);
            setCreatives(creativesData);
            setAdCopies(adCopiesData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Quick inline row creation
    const handleQuickCreate = async (defaults?: Record<string, unknown>) => {
        const newAd = await createAd({
            creative_id: (defaults?.creative_id as string) || null,
            traffic: (defaults?.traffic as string) || null,
            ad_type: (defaults?.ad_type as string) || null,
            project_id: (defaults?.project_id as string) || null,
            subproject_id: (defaults?.subproject_id as string) || null,
            user_id: currentUserId,
            headline_id: (defaults?.headline_id as string) || null,
            primary_id: (defaults?.primary_id as string) || null,
            description_id: (defaults?.description_id as string) || null,
        });

        setAds(prev => [...prev, newAd]);
        return newAd;
    };

    // Update Handler
    const handleUpdate = async (id: string, field: string, value: unknown) => {
        const original = ads.find(a => a.id === id);
        if (!original) return;

        const updates: Partial<Ad> = {};

        if (field === 'creative_id') {
            updates.creative_id = value ? String(value) : null;
        } else if (field === 'traffic') {
            updates.traffic = value ? String(value) : null;
        } else if (field === 'ad_type') {
            updates.ad_type = value ? String(value) : null;
        } else if (field === 'project_id') {
            updates.project_id = value ? String(value) : null;
            // Clear subproject if project changes
            const currentSubprojectId = original.subproject_id;
            if (currentSubprojectId && value) {
                const subBelongsToNewProject = subprojects.some(
                    s => s.id === currentSubprojectId && s.project_id === value
                );
                if (!subBelongsToNewProject) {
                    updates.subproject_id = null;
                }
            } else if (!value) {
                updates.subproject_id = null;
            }
        } else if (field === 'subproject_id') {
            updates.subproject_id = value ? String(value) : null;
            // Auto-set project if subproject's project differs from current
            if (value) {
                const sub = subprojects.find(s => s.id === value);
                if (sub && sub.project_id !== original.project_id) {
                    updates.project_id = sub.project_id;
                }
            }
        } else if (field === 'user_id') {
            updates.user_id = value ? String(value) : null;
        } else if (field === 'headline_id') {
            updates.headline_id = value ? String(value) : null;
        } else if (field === 'primary_id') {
            updates.primary_id = value ? String(value) : null;
        } else if (field === 'description_id') {
            updates.description_id = value ? String(value) : null;
        }

        if (Object.keys(updates).length === 0) return;

        // Optimistic update
        setAds(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));

        try {
            await updateAd(id, updates);
        } catch (error) {
            console.error('Failed to update ad:', error);
            setAds(prev => prev.map(a => a.id === id ? original : a));
            const errorMessage = (error as { message?: string })?.message || 'Unknown error';
            alert(`Failed to save changes: ${errorMessage}`);
        }
    };

    // Delete Handler
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this ad?')) return;
        try {
            await deleteAd(id);
            setAds(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error('Failed to delete ad:', error);
        }
    };

    // Reorder Handler
    const handleReorder = async (newOrder: string[]) => {
        const reordered = newOrder.map(id => ads.find(a => a.id === id)!).filter(Boolean);
        setAds(reordered);

        if (currentUserId) {
            try {
                await saveRowOrder(currentUserId, 'ads', newOrder);
            } catch (error) {
                console.error('Failed to save row order:', error);
            }
        }
    };

    // Color palette for dynamic colorMaps
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

    // Generate colorMap for projects
    const projectColorMap = projects.reduce((map, project, index) => {
        map[project.id] = colorPalette[index % colorPalette.length];
        return map;
    }, {} as Record<string, string>);

    // Generate colorMap for subprojects
    const subprojectColorMap = subprojects.reduce((map, subproject, index) => {
        map[subproject.id] = colorPalette[index % colorPalette.length];
        return map;
    }, {} as Record<string, string>);

    // Lookup maps for gallery view
    const creativeMap = new Map(creatives.map(c => [c.id, c]));
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const subprojectMap = new Map(subprojects.map(s => [s.id, s]));
    const adCopyMap = new Map(adCopies.map(c => [c.id, c]));

    // Gallery card renderer
    const renderGalleryCard = ({ item, isSelected, onToggle, selectable }: {
        item: Ad;
        isSelected: boolean;
        onToggle: () => void;
        selectable: boolean;
    }) => {
        const creative = item.creative_id ? creativeMap.get(item.creative_id) : null;
        const project = item.project_id ? projectMap.get(item.project_id) : null;
        const subproject = item.subproject_id ? subprojectMap.get(item.subproject_id) : null;
        const headline = item.headline_id ? adCopyMap.get(item.headline_id) : null;
        const primaryText = item.primary_id ? adCopyMap.get(item.primary_id) : null;
        const description = item.description_id ? adCopyMap.get(item.description_id) : null;

        return (
            <AdPreviewCard
                ad={item}
                creative={creative}
                headline={headline}
                primaryText={primaryText}
                description={description}
                project={project}
                subproject={subproject}
                isSelected={isSelected}
                onToggle={onToggle}
                selectable={selectable}
                projectColor={item.project_id ? projectColorMap[item.project_id] : undefined}
                subprojectColor={item.subproject_id ? subprojectColorMap[item.subproject_id] : undefined}
            />
        );
    };

    // Creative options
    const creativeOptions = creatives.map(c => ({
        label: c.name || '(unnamed)',
        value: c.id
    }));

    // Column Definitions
    const columns: ColumnDef<Ad>[] = [
        {
            key: 'row_number',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            type: 'id',
        },
        {
            key: 'creative_id',
            header: 'Creative',
            width: 180,
            minWidth: 120,
            editable: true,
            type: 'select',
            options: creativeOptions,
        },
        {
            key: 'traffic',
            header: 'Traffic',
            width: 90,
            minWidth: 70,
            editable: true,
            type: 'select',
            options: [
                { label: 'None', value: '' },
                { label: 'FB', value: 'FB' },
                { label: 'IG', value: 'IG' },
                { label: 'All', value: 'All' },
            ],
            colorMap: {
                'FB': 'bg-teal-500 text-white',
                'IG': 'bg-rose-500 text-white',
                'All': 'bg-indigo-500 text-white',
            },
        },
        {
            key: 'ad_type',
            header: 'Ad Type',
            width: 100,
            minWidth: 80,
            editable: true,
            type: 'select',
            options: [
                { label: 'None', value: '' },
                { label: 'Image', value: 'Image' },
                { label: 'Video', value: 'Video' },
                { label: 'Carousel', value: 'Carousel' },
            ],
            colorMap: {
                'Image': 'bg-blue-500 text-white',
                'Video': 'bg-purple-500 text-white',
                'Carousel': 'bg-amber-500 text-white',
            },
        },
        {
            key: 'project_id',
            header: 'Project',
            width: 140,
            minWidth: 100,
            editable: true,
            type: 'select',
            options: projects.map(p => ({ label: p.name, value: p.id })),
            colorMap: projectColorMap,
        },
        {
            key: 'subproject_id',
            header: 'Subproject',
            width: 140,
            minWidth: 100,
            editable: true,
            type: 'select',
            options: (row) => {
                if (!row.project_id) {
                    return subprojects.map(s => ({ label: s.name, value: s.id }));
                }
                return subprojects
                    .filter(s => s.project_id === row.project_id)
                    .map(s => ({ label: s.name, value: s.id }));
            },
            filterOptions: subprojects.map(s => ({ label: s.name, value: s.id })),
            colorMap: subprojectColorMap,
            dependsOn: {
                parentKey: 'project_id',
                getParentValue: (subprojectId) => {
                    const sub = subprojects.find(s => s.id === subprojectId);
                    return sub?.project_id ?? null;
                },
            },
        },
        {
            key: 'user_id',
            header: 'Created By',
            width: 130,
            minWidth: 100,
            editable: true,
            type: 'people',
            users: users,
        },
        {
            key: 'headline_id',
            header: 'Headline',
            width: 280,
            minWidth: 180,
            editable: true,
            type: 'adcopy',
            adCopyType: 'headline',
        },
        {
            key: 'primary_id',
            header: 'Primary',
            width: 280,
            minWidth: 180,
            editable: true,
            type: 'adcopy',
            adCopyType: 'primary_text',
        },
        {
            key: 'description_id',
            header: 'Description',
            width: 280,
            minWidth: 180,
            editable: true,
            type: 'adcopy',
            adCopyType: 'description',
        },
    ];

    return (
        <DataTablePageLayout>
            {/* Data Table */}
            <DataTable
                columns={columns}
                data={ads}
                isLoading={isLoading}
                emptyMessage="No ads found. Create one to get started!"
                title="Ads"
                headerActions={
                    <button
                        onClick={() => navigate('/ads/create')}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                        <Layers className="w-3 h-3" />
                        Create Ads
                    </button>
                }
                getRowId={(ad) => ad.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateRow={handleQuickCreate}
                sortable={true}
                onReorder={handleReorder}
                resizable={true}
                fullscreen={true}
                quickFilters={['project_id', 'subproject_id', 'ad_type']}
                viewId="ads"
                userId={currentUserId || undefined}
                initialPreferences={userPreferences || undefined}
                sharedPreferences={sharedPreferences || undefined}
                onPreferencesChange={handlePreferencesChange}
                onSaveForEveryone={handleSaveForEveryone}
                onResetPreferences={handleResetPreferences}
                adCopies={adCopies}
                renderGalleryCard={renderGalleryCard}
            />
        </DataTablePageLayout>
    );
}
