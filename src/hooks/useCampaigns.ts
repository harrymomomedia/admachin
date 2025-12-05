// Hook for Facebook Campaigns

import { useState, useCallback, useEffect } from 'react';
import { useFacebook } from '../contexts/FacebookContext';
import {
    getCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaignInsights,
    type Campaign,
    type CreateCampaignParams,
    type CampaignInsights,
    type InsightParams,
} from '../services/facebook';

interface UseCampaignsReturn {
    campaigns: Campaign[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchCampaigns: () => Promise<void>;
    fetchCampaign: (id: string) => Promise<Campaign | null>;
    create: (params: CreateCampaignParams) => Promise<string | null>;
    update: (id: string, params: Partial<CreateCampaignParams>) => Promise<boolean>;
    remove: (id: string) => Promise<boolean>;
    getInsights: (id: string, datePreset?: string) => Promise<CampaignInsights[] | null>;
}

export function useCampaigns(): UseCampaignsReturn {
    const { connectedProfiles } = useFacebook();
    const isConnected = connectedProfiles.length > 0;
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCampaigns = useCallback(async () => {
        if (!isConnected) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await getCampaigns();
            setCampaigns(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
        } finally {
            setIsLoading(false);
        }
    }, [isConnected]);

    const fetchCampaign = useCallback(async (id: string): Promise<Campaign | null> => {
        try {
            return await getCampaign(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch campaign');
            return null;
        }
    }, []);

    const create = useCallback(async (params: CreateCampaignParams): Promise<string | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await createCampaign(params);
            await fetchCampaigns(); // Refresh list
            return result.id;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create campaign');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [fetchCampaigns]);

    const update = useCallback(async (
        id: string,
        params: Partial<CreateCampaignParams>
    ): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await updateCampaign(id, params);
            if (result.success) {
                await fetchCampaigns();
            }
            return result.success;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update campaign');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [fetchCampaigns]);

    const remove = useCallback(async (id: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await deleteCampaign(id);
            if (result.success) {
                setCampaigns(prev => prev.filter(c => c.id !== id));
            }
            return result.success;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete campaign');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getInsights = useCallback(async (
        id: string,
        datePreset = 'last_30d'
    ): Promise<CampaignInsights[] | null> => {
        try {
            return await getCampaignInsights(id, { date_preset: datePreset as InsightParams['date_preset'] });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch insights');
            return null;
        }
    }, []);

    // Auto-fetch on mount if connected
    useEffect(() => {
        if (isConnected) {
            fetchCampaigns();
        }
    }, [isConnected, fetchCampaigns]);

    return {
        campaigns,
        isLoading,
        error,
        fetchCampaigns,
        fetchCampaign,
        create,
        update,
        remove,
        getInsights,
    };
}

export default useCampaigns;
