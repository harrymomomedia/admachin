// FB Ads Library Service Functions - appending to supabase-service.ts

import { createClient } from '@supabase/supabase-js';

// Untyped client for new tables not yet in database.types.ts
const supabaseUntyped = createClient(
    import.meta.env.VITE_SUPABASE_URL || '',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
);

// ============================================
// FB ADS LIBRARY
// ============================================

export interface FBAdLibrarySaved {
    id: string;
    fb_ad_id: string;
    page_name: string | null;
    page_id: string | null;
    ad_snapshot_url: string | null;
    ad_creative_body: string | null;
    ad_creative_link_title: string | null;
    ad_creative_link_description: string | null;
    ad_creative_link_caption: string | null;
    images: unknown | null;
    videos: unknown | null;
    ad_creation_time: string | null;
    ad_delivery_start_time: string | null;
    ad_delivery_stop_time: string | null;
    spend: unknown | null;
    impressions: unknown | null;
    demographic_distribution: unknown | null;
    region_distribution: unknown | null;
    publisher_platforms: string[] | null;
    search_terms: string | null;
    search_country: string | null;
    saved_by: string | null;
    saved_at: string;
    notes: string | null;
    tags: string[] | null;
    created_at: string;
    updated_at: string;
}

/**
 * Get all saved FB Ad Library ads
 */
export async function getSavedFBAds(): Promise<FBAdLibrarySaved[]> {
    const { data, error } = await supabaseUntyped
        .from('fb_ads_library')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching saved FB ads:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get a single saved FB ad by ID
 */
export async function getSavedFBAd(id: string): Promise<FBAdLibrarySaved | null> {
    const { data, error } = await supabaseUntyped
        .from('fb_ads_library')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('[Supabase] Error fetching saved FB ad:', error);
        throw error;
    }

    return data;
}

/**
 * Check if an ad is already saved
 */
export async function isFBAdSaved(fbAdId: string): Promise<boolean> {
    const { data, error } = await supabaseUntyped
        .from('fb_ads_library')
        .select('id')
        .eq('fb_ad_id', fbAdId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('[Supabase] Error checking if FB ad is saved:', error);
        return false;
    }

    return !!data;
}

/**
 * Save a FB Ad Library ad to database
 */
export async function saveFBAd(ad: {
    fb_ad_id: string;
    page_name?: string;
    page_id?: string;
    ad_snapshot_url?: string;
    ad_creative_body?: string;
    ad_creative_link_title?: string;
    ad_creative_link_description?: string;
    ad_creative_link_caption?: string;
    images?: unknown;
    videos?: unknown;
    ad_creation_time?: string;
    ad_delivery_start_time?: string;
    ad_delivery_stop_time?: string;
    spend?: unknown;
    impressions?: unknown;
    demographic_distribution?: unknown;
    region_distribution?: unknown;
    publisher_platforms?: string[];
    search_terms?: string;
    search_country?: string;
    notes?: string;
    tags?: string[];
}): Promise<FBAdLibrarySaved> {
    const { data: { user } } = await supabaseUntyped.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const { data, error } = await supabaseUntyped
        .from('fb_ads_library')
        .insert({
            ...ad,
            saved_by: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error saving FB ad:', error);
        throw error;
    }

    return data;
}

/**
 * Update notes and tags for a saved ad
 */
export async function updateFBAdNotes(
    id: string,
    updates: {
        notes?: string;
        tags?: string[];
    }
): Promise<FBAdLibrarySaved> {
    const { data, error } = await supabaseUntyped
        .from('fb_ads_library')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating FB ad notes:', error);
        throw error;
    }

    return data;
}

/**
 * Delete a saved FB ad
 */
export async function deleteSavedFBAd(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('fb_ads_library')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting saved FB ad:', error);
        throw error;
    }
}

/**
 * Search saved ads by terms or tags
 */
export async function searchSavedFBAds(query: string): Promise<FBAdLibrarySaved[]> {
    const { data, error } = await supabaseUntyped
        .from('fb_ads_library')
        .select('*')
        .or(`page_name.ilike.%${query}%,ad_creative_body.ilike.%${query}%,notes.ilike.%${query}%`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error searching saved FB ads:', error);
        throw error;
    }

    return data || [];
}
