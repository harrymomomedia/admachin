// Supabase Client Configuration
// 
// This file provides typed Supabase clients for both browser and server use.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing environment variables. Some features may not work.');
}

// Browser client (uses anon key, respects RLS)
// Single instance to avoid "Multiple GoTrueClient instances" warning
export const supabase: SupabaseClient<Database> = createClient<Database>(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    }
);

// Untyped client for tables not yet in database.types.ts
// Uses the same instance to avoid multiple GoTrueClient warnings
export const supabaseUntyped = supabase as unknown as SupabaseClient;

// Helper to get the current user
// In development, defaults to Harry Jung if no Supabase auth session
export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        // Return mock Harry Jung user for development
        if (import.meta.env.DEV) {
            return {
                id: '807f4cb3-fd03-4e02-8828-44436a6d00e5', // harry@momomedia.io
                email: 'harry@momomedia.io',
            };
        }
        console.error('[Supabase] Error getting user:', error);
        return null;
    }
    return user;
}

// Helper to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
    const user = await getCurrentUser();
    return user !== null;
}

// Export types
export type { Database };
