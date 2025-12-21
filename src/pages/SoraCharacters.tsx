import { useState, useCallback, useEffect } from "react";
import { DataTable } from "../components/DataTable";
import type { ColumnDef } from "../components/DataTable";
import { DataTablePageLayout } from "../components/DataTablePageLayout";
import {
    getSoraCharacters,
    createSoraCharacter,
    updateSoraCharacter,
    deleteSoraCharacter,
    getUserViewPreferences,
    saveUserViewPreferences,
    getSharedViewPreferences,
    saveSharedViewPreferences,
    deleteUserViewPreferences,
    saveRowOrder,
} from "../lib/supabase-service";
import type { ViewPreferencesConfig, SoraCharacterWithDetails } from "../lib/supabase-service";
import { useAuth } from "../contexts/AuthContext";
import { ExternalLink, User as UserIcon } from "lucide-react";

interface SoraCharacterRow {
    id: string;
    row_number: number;
    character_name: string | null;
    sora_character_id: string | null;
    sora_profile_url: string | null;  // Computed from sora_character_id
    source_video_url: string | null;
    video_output_id: string | null;
    avatar_url: string | null;
    description: string | null;
    restrictions: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    task_error: string | null;
    created_at: string;
    updated_at: string;
}

export function SoraCharacters() {
    const { user } = useAuth();
    const currentUserId = user?.id;

    const [characters, setCharacters] = useState<SoraCharacterRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // View preferences
    const [userPreferences, setUserPreferences] = useState<ViewPreferencesConfig | null>(null);
    const [sharedPreferences, setSharedPreferences] = useState<ViewPreferencesConfig | null>(null);

    // Status color map
    const statusColorMap: Record<string, string> = {
        'pending': 'bg-gray-100 text-gray-600',
        'processing': 'bg-blue-100 text-blue-600',
        'completed': 'bg-green-100 text-green-600',
        'failed': 'bg-red-100 text-red-600',
    };

    // Load data
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            try {
                const [charactersData, userPrefs, sharedPrefs] = await Promise.all([
                    getSoraCharacters(),
                    currentUserId ? getUserViewPreferences(currentUserId, 'sora-characters') : null,
                    getSharedViewPreferences('sora-characters'),
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

                // Store user view preferences
                if (userPrefs) {
                    setUserPreferences({
                        sort_config: userPrefs.sort_config,
                        filter_config: userPrefs.filter_config,
                        group_config: userPrefs.group_config,
                        wrap_config: userPrefs.wrap_config,
                        row_order: userPrefs.row_order,
                        column_widths: userPrefs.column_widths,
                        column_order: userPrefs.column_order
                    });
                }

                // Compute profile URLs from sora_character_id
                const charactersWithUrls = charactersData.map(char => ({
                    ...char,
                    sora_profile_url: char.sora_character_id
                        ? `https://sora.chatgpt.com/profile/${char.sora_character_id}`
                        : null,
                })) as SoraCharacterRow[];

                // Apply row order (user's or shared)
                const rowOrder = userPrefs?.row_order || sharedPrefs?.row_order;
                let finalCharacters = charactersWithUrls;
                if (rowOrder && rowOrder.length > 0) {
                    const orderMap = new Map(rowOrder.map((id, index) => [id, index]));
                    finalCharacters = [...finalCharacters].sort((a, b) => {
                        const aIndex = orderMap.get(a.id) ?? Infinity;
                        const bIndex = orderMap.get(b.id) ?? Infinity;
                        return aIndex - bIndex;
                    });
                }

                setCharacters(finalCharacters);
            } catch (error) {
                console.error('[SoraCharacters] Failed to load:', error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [currentUserId]);

    // View persistence handlers
    const handlePreferencesChange = async (preferences: ViewPreferencesConfig) => {
        if (!currentUserId) return;
        try {
            await saveUserViewPreferences(currentUserId, 'sora-characters', preferences);
        } catch (error) {
            console.error('Failed to save view preferences:', error);
        }
    };

    const handleSaveForEveryone = async (preferences: ViewPreferencesConfig) => {
        try {
            const rowOrder = characters.map(c => c.id);
            await saveSharedViewPreferences('sora-characters', {
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

    const handleResetPreferences = async () => {
        if (!currentUserId) return;
        try {
            await deleteUserViewPreferences(currentUserId, 'sora-characters');
            setUserPreferences(null);
        } catch (error) {
            console.error('Failed to reset preferences:', error);
        }
    };

    // Create new row
    const handleCreateRow = useCallback(async () => {
        try {
            const newCharacter = await createSoraCharacter({});
            setCharacters(prev => [newCharacter as SoraCharacterRow, ...prev]);
            return newCharacter;
        } catch (error) {
            console.error('[SoraCharacters] Failed to create:', error);
            throw error;
        }
    }, []);

    // Delete row
    const handleDelete = useCallback(async (id: string) => {
        setCharacters(prev => prev.filter(c => c.id !== id));
        try {
            await deleteSoraCharacter(id);
        } catch (err) {
            console.error('[SoraCharacters] Failed to delete:', err);
        }
    }, []);

    // Update row
    const handleUpdate = useCallback(async (id: string, field: string, value: unknown) => {
        // Update local state
        setCharacters(prev =>
            prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
        );

        // Update in database
        try {
            await updateSoraCharacter(id, { [field]: value as string });
        } catch (err) {
            console.error('[SoraCharacters] Failed to update:', err);
        }
    }, []);

    // Reorder handler
    const handleReorder = async (newOrder: string[]) => {
        const reordered = newOrder.map(id => characters.find(c => c.id === id)!).filter(Boolean);
        setCharacters(reordered);

        if (currentUserId) {
            try {
                await saveRowOrder(currentUserId, 'sora-characters', newOrder);
            } catch (error) {
                console.error('Failed to save row order:', error);
            }
        }
    };

    // Column definitions
    const columns: ColumnDef<SoraCharacterRow>[] = [
        {
            key: 'row_number',
            header: 'ID',
            width: 50,
            minWidth: 40,
            editable: false,
            type: 'id',
        },
        {
            key: 'avatar_url',
            header: 'Avatar',
            width: 70,
            minWidth: 60,
            editable: false,
            type: 'custom',
            render: (value) => {
                const avatarUrl = value as string | null;
                return avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt="Character avatar"
                        className="w-10 h-10 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-gray-400" />
                    </div>
                );
            },
        },
        {
            key: 'character_name',
            header: 'Character Name',
            width: 180,
            minWidth: 140,
            editable: true,
            type: 'text',
        },
        {
            key: 'sora_character_id',
            header: 'Sora ID',
            width: 160,
            minWidth: 120,
            editable: true,
            type: 'text',
        },
        {
            key: 'sora_profile_url',
            header: 'Profile URL',
            width: 150,
            minWidth: 120,
            editable: true,
            type: 'custom',
            render: (value) => {
                const url = value as string | null;
                if (!url) return '-';
                return (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="truncate">{url.replace('https://sora.chatgpt.com/profile/', '')}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                );
            },
        },
        {
            key: 'source_video_url',
            header: 'Source Video',
            width: 150,
            minWidth: 120,
            editable: true,
            type: 'url',
        },
        {
            key: 'description',
            header: 'Description',
            width: 250,
            minWidth: 180,
            editable: true,
            type: 'textarea',
        },
        {
            key: 'status',
            header: 'Status',
            width: 110,
            minWidth: 90,
            editable: false,
            type: 'select',
            options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Processing', value: 'processing' },
                { label: 'Completed', value: 'completed' },
                { label: 'Failed', value: 'failed' },
            ],
            colorMap: statusColorMap,
        },
        {
            key: 'task_error',
            header: 'Error',
            width: 150,
            minWidth: 100,
            editable: false,
            type: 'text',
        },
        {
            key: 'created_at',
            header: 'Created',
            width: 120,
            minWidth: 100,
            editable: false,
            type: 'date',
        },
    ];

    return (
        <DataTablePageLayout>
            <DataTable
                columns={columns}
                data={characters}
                isLoading={isLoading}
                emptyMessage="No Sora characters found. Create one from an AI-generated video!"
                title="Sora Characters"
                newButtonLabel="New"
                getRowId={(row) => row.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateRow={handleCreateRow}
                sortable={true}
                onReorder={handleReorder}
                resizable={true}
                fullscreen={true}
                quickFilters={['status']}
                showRowActions={true}
                // View persistence
                viewId="sora-characters"
                userId={currentUserId || undefined}
                initialPreferences={userPreferences || undefined}
                sharedPreferences={sharedPreferences || undefined}
                onPreferencesChange={handlePreferencesChange}
                onSaveForEveryone={handleSaveForEveryone}
                onResetPreferences={handleResetPreferences}
            />
        </DataTablePageLayout>
    );
}
