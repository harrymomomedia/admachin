/**
 * AI Context
 * Provides app-wide access to AI provider state and preferences
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AIProvider, AIProvidersResponse } from '../services/ai/types';
import { PROVIDER_INFO } from '../services/ai/types';
import { getAvailableProviders } from '../services/ai/api';

interface AIContextValue {
    // Available providers (ones with API keys configured)
    availableProviders: AIProvider[];

    // Currently selected provider
    selectedProvider: AIProvider | null;
    setSelectedProvider: (provider: AIProvider) => void;

    // Loading state
    isLoading: boolean;

    // Helper to check if a provider is available
    isProviderAvailable: (provider: AIProvider) => boolean;

    // Provider display info
    providerInfo: typeof PROVIDER_INFO;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
    const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadProviders() {
            try {
                const response: AIProvidersResponse = await getAvailableProviders();
                setAvailableProviders(response.availableProviders);

                // Set default provider if available
                if (response.defaultProvider) {
                    setSelectedProvider(response.defaultProvider);
                } else if (response.availableProviders.length > 0) {
                    setSelectedProvider(response.availableProviders[0]);
                }
            } catch (error) {
                console.error('[AIContext] Failed to load providers:', error);
            } finally {
                setIsLoading(false);
            }
        }

        loadProviders();
    }, []);

    const isProviderAvailable = (provider: AIProvider) => {
        return availableProviders.includes(provider);
    };

    const value: AIContextValue = {
        availableProviders,
        selectedProvider,
        setSelectedProvider,
        isLoading,
        isProviderAvailable,
        providerInfo: PROVIDER_INFO,
    };

    return (
        <AIContext.Provider value={value}>
            {children}
        </AIContext.Provider>
    );
}

export function useAI() {
    const context = useContext(AIContext);
    if (!context) {
        throw new Error('useAI must be used within an AIProvider');
    }
    return context;
}

export { AIContext };
