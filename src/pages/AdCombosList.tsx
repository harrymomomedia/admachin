import { useState, useEffect, useMemo } from 'react';
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
    saveRowOrder,
    type Ad,
    type Project,
    type Subproject,
    type User,
    type Creative,
    type AdCopy,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';
import { DataTable, type ColumnDef } from '../components/datatable';
import { AdPreviewCard } from '../components/AdPreviewCard';
import {
    generateColorMap,
    createProjectColumn,
    createSubprojectColumn,
    TRAFFIC_PLATFORM_COLORS,
} from '../lib/datatable-defaults';

export function AdCombosList() {
    const navigate = useNavigate();
    const [ads, setAds] = useState<Ad[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [creatives, setCreatives] = useState<Creative[]>([]);
    const [adCopies, setAdCopies] = useState<AdCopy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Load Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [adsData, projectsData, subprojectsData, usersData, creativesData, adCopiesData, user] = await Promise.all([
                getAds(),
                getProjects(),
                getSubprojects(),
                getUsers(),
                getCreatives(),
                getAdCopies(),
                getCurrentUser(),
            ]);

            if (user?.id) {
                setCurrentUserId(user.id);
            }

            setAds(adsData);
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
    // NOTE: Project/subproject dependency logic is handled by DataTable's dependsOn config.
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
            // NOTE: Clearing subproject is handled by DataTable's dependsOn
        } else if (field === 'subproject_id') {
            updates.subproject_id = value ? String(value) : null;
            // NOTE: Auto-setting project is handled by DataTable's dependsOn
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

    // Generate colorMaps using shared utility - memoized to prevent re-renders
    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(subprojects), [subprojects]);

    // Lookup maps for gallery view - memoized
    const creativeMap = useMemo(() => new Map(creatives.map(c => [c.id, c])), [creatives]);
    const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
    const subprojectMap = useMemo(() => new Map(subprojects.map(s => [s.id, s])), [subprojects]);
    const adCopyMap = useMemo(() => new Map(adCopies.map(c => [c.id, c])), [adCopies]);

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

    // Creative options - memoized
    const creativeOptions = useMemo(() => creatives.map(c => ({
        label: c.name || '(unnamed)',
        value: c.id
    })), [creatives]);

    // Column Definitions - memoized to prevent re-renders on every state change
    const columns: ColumnDef<Ad>[] = useMemo(() => [
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
            colorMap: TRAFFIC_PLATFORM_COLORS,
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
        createProjectColumn<Ad>({ projects, subprojects, projectColorMap }),
        createSubprojectColumn<Ad>({ projects, subprojects, subprojectColorMap }),
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
    ], [creativeOptions, projects, subprojects, users, projectColorMap, subprojectColorMap]);

    return (
        <DataTablePageLayout>
            {/* Data Table */}
            <DataTable
                columns={columns}
                data={ads}
                isLoading={isLoading}
                emptyMessage="No ad combos found. Create one to get started!"
                title="Ad Combos"
                headerActions={
                    <button
                        onClick={() => navigate('/ad-combos/create')}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                        <Layers className="w-3 h-3" />
                        Create Ad Combo
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
                layout="fullPage"
                quickFilters={['project_id', 'subproject_id', 'ad_type']}
                viewId="ads"
                adCopies={adCopies}
                renderGalleryCard={renderGalleryCard}
            />
        </DataTablePageLayout>
    );
}
