// Hook for Facebook Analytics/Insights

import { useState, useCallback } from 'react';
import { useFacebook } from '../contexts/FacebookContext';
import {
    getAccountInsights,
    getInsightsOverTime,
    type CampaignInsights,
    type InsightParams,
} from '../services/facebook';

interface UseInsightsReturn {
    insights: CampaignInsights[];
    timeSeriesData: CampaignInsights[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchInsights: (params?: InsightParams) => Promise<void>;
    fetchTimeSeries: (datePreset?: string, increment?: 1 | 7 | 28) => Promise<void>;

    // Computed metrics
    totals: {
        impressions: number;
        clicks: number;
        spend: number;
        reach: number;
        ctr: number;
        cpc: number;
    } | null;
}

export function useInsights(): UseInsightsReturn {
    const { connectedProfiles } = useFacebook();
    const isConnected = connectedProfiles.length > 0;
    const [insights, setInsights] = useState<CampaignInsights[]>([]);
    const [timeSeriesData, setTimeSeriesData] = useState<CampaignInsights[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchInsights = useCallback(async (params: InsightParams = {}) => {
        if (!isConnected) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await getAccountInsights(params);
            setInsights(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch insights');
        } finally {
            setIsLoading(false);
        }
    }, [isConnected]);

    const fetchTimeSeries = useCallback(async (
        datePreset = 'last_30d',
        increment: 1 | 7 | 28 = 1
    ) => {
        if (!isConnected) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await getInsightsOverTime({
                date_preset: datePreset as InsightParams['date_preset'],
                increment,
            });
            setTimeSeriesData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch time series');
        } finally {
            setIsLoading(false);
        }
    }, [isConnected]);

    // Calculate totals from insights
    const totals = insights.length > 0
        ? {
            impressions: insights.reduce((sum, i) => sum + parseInt(i.impressions || '0'), 0),
            clicks: insights.reduce((sum, i) => sum + parseInt(i.clicks || '0'), 0),
            spend: insights.reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0),
            reach: insights.reduce((sum, i) => sum + parseInt(i.reach || '0'), 0),
            ctr: insights.reduce((sum, i) => sum + parseFloat(i.ctr || '0'), 0) / insights.length,
            cpc: insights.reduce((sum, i) => sum + parseFloat(i.cpc || '0'), 0) / insights.length,
        }
        : null;

    return {
        insights,
        timeSeriesData,
        isLoading,
        error,
        fetchInsights,
        fetchTimeSeries,
        totals,
    };
}

export default useInsights;
