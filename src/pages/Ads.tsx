import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Layers } from 'lucide-react';
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

export function Ads() {
    const navigate = useNavigate();
    const [ads, setAds] = useState<Ad[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [creatives, setCreatives] = useState<Creative[]>([]);
    const [adCopies, setAdCopies] = useState<AdCopy[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        creative_id: '',
        traffic: '',
        ad_type: '',
        project_id: '',
        subproject_id: '',
        headline_id: '',
        primary_id: '',
        description_id: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    // Create Handler
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const currentUser = await getCurrentUser();
            await createAd({
                creative_id: formData.creative_id || null,
                traffic: formData.traffic || null,
                ad_type: formData.ad_type || null,
                project_id: formData.project_id || null,
                subproject_id: formData.subproject_id || null,
                user_id: currentUser?.id || null,
                headline_id: formData.headline_id || null,
                primary_id: formData.primary_id || null,
                description_id: formData.description_id || null,
            });
            await loadData();
            setIsCreateModalOpen(false);
            setFormData({
                creative_id: '',
                traffic: '',
                ad_type: '',
                project_id: '',
                subproject_id: '',
                headline_id: '',
                primary_id: '',
                description_id: '',
            });
        } catch (error) {
            console.error('Failed to create ad:', error);
            alert('Failed to create ad. Please try again.');
        } finally {
            setIsSubmitting(false);
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

    // Filter ad copies by type for headline, primary, and description
    const headlineOptions = adCopies
        .filter(c => c.type === 'headline')
        .map(c => ({ label: c.text?.substring(0, 50) + (c.text && c.text.length > 50 ? '...' : '') || '(empty)', value: c.id }));

    const primaryOptions = adCopies
        .filter(c => c.type === 'primary_text')
        .map(c => ({ label: c.text?.substring(0, 50) + (c.text && c.text.length > 50 ? '...' : '') || '(empty)', value: c.id }));

    const descriptionOptions = adCopies
        .filter(c => c.type === 'description')
        .map(c => ({ label: c.text?.substring(0, 50) + (c.text && c.text.length > 50 ? '...' : '') || '(empty)', value: c.id }));

    // Creative options
    const creativeOptions = creatives.map(c => ({
        label: c.name || c.file_name || '(unnamed)',
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
            width: 200,
            minWidth: 120,
            editable: true,
            type: 'select',
            options: headlineOptions,
        },
        {
            key: 'primary_id',
            header: 'Primary',
            width: 200,
            minWidth: 120,
            editable: true,
            type: 'select',
            options: primaryOptions,
        },
        {
            key: 'description_id',
            header: 'Description',
            width: 200,
            minWidth: 120,
            editable: true,
            type: 'select',
            options: descriptionOptions,
        },
    ];

    return (
        <DataTablePageLayout
            title="Ads"
            onNewClick={() => setIsCreateModalOpen(true)}
            newButtonLabel="New"
            headerActions={
                <button
                    onClick={() => navigate('/ads/create')}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                    <Layers className="w-3 h-3" />
                    Create Ads
                </button>
            }
        >
            {/* Data Table */}
            <DataTable
                columns={columns}
                data={ads}
                isLoading={isLoading}
                emptyMessage="No ads found. Create one to get started!"
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
            />

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">New Ad</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label htmlFor="ad-creative" className="block text-sm font-medium text-gray-700 mb-1">Creative</label>
                                <select
                                    id="ad-creative"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.creative_id}
                                    onChange={e => setFormData({ ...formData, creative_id: e.target.value })}
                                >
                                    <option value="">Select Creative</option>
                                    {creatives.map(c => (
                                        <option key={c.id} value={c.id}>{c.name || c.file_name || '(unnamed)'}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="ad-traffic" className="block text-sm font-medium text-gray-700 mb-1">Traffic</label>
                                    <select
                                        id="ad-traffic"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.traffic}
                                        onChange={e => setFormData({ ...formData, traffic: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        <option value="FB">Facebook</option>
                                        <option value="IG">Instagram</option>
                                        <option value="All">All</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="ad-type" className="block text-sm font-medium text-gray-700 mb-1">Ad Type</label>
                                    <select
                                        id="ad-type"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.ad_type}
                                        onChange={e => setFormData({ ...formData, ad_type: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        <option value="Image">Image</option>
                                        <option value="Video">Video</option>
                                        <option value="Carousel">Carousel</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="ad-project" className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                                    <select
                                        id="ad-project"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.project_id}
                                        onChange={e => setFormData({ ...formData, project_id: e.target.value, subproject_id: '' })}
                                    >
                                        <option value="">Select Project</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="ad-subproject" className="block text-sm font-medium text-gray-700 mb-1">Subproject</label>
                                    <select
                                        id="ad-subproject"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.subproject_id}
                                        onChange={e => setFormData({ ...formData, subproject_id: e.target.value })}
                                    >
                                        <option value="">Select Subproject</option>
                                        {subprojects
                                            .filter(s => !formData.project_id || s.project_id === formData.project_id)
                                            .map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="ad-headline" className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                                <select
                                    id="ad-headline"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.headline_id}
                                    onChange={e => setFormData({ ...formData, headline_id: e.target.value })}
                                >
                                    <option value="">Select Headline</option>
                                    {adCopies.filter(c => c.type === 'headline').map(c => (
                                        <option key={c.id} value={c.id}>{c.text?.substring(0, 60) || '(empty)'}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="ad-primary" className="block text-sm font-medium text-gray-700 mb-1">Primary Text</label>
                                <select
                                    id="ad-primary"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.primary_id}
                                    onChange={e => setFormData({ ...formData, primary_id: e.target.value })}
                                >
                                    <option value="">Select Primary Text</option>
                                    {adCopies.filter(c => c.type === 'primary_text').map(c => (
                                        <option key={c.id} value={c.id}>{c.text?.substring(0, 60) || '(empty)'}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="ad-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <select
                                    id="ad-description"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.description_id}
                                    onChange={e => setFormData({ ...formData, description_id: e.target.value })}
                                >
                                    <option value="">Select Description</option>
                                    {adCopies.filter(c => c.type === 'description').map(c => (
                                        <option key={c.id} value={c.id}>{c.text?.substring(0, 60) || '(empty)'}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Ad'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </DataTablePageLayout>
    );
}
