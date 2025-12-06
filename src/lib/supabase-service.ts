// Supabase Service Layer for AdMachin
// Provides typed functions for database operations

import { supabase } from './supabase';
import type { Database, Profile, AdAccount, Creative } from './database.types';

// ============================================
// PROFILES
// ============================================

export interface ProfileWithAccounts extends Profile {
    ad_accounts: AdAccount[];
}

/**
 * Get all Facebook profiles with their ad accounts
 */
export async function getProfiles(): Promise<ProfileWithAccounts[]> {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
            *,
            ad_accounts (*)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching profiles:', error);
        throw error;
    }

    return profiles || [];
}

/**
 * Get a single profile by Facebook user ID
 */
export async function getProfileByFbUserId(fbUserId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('fb_user_id', fbUserId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('[Supabase] Error fetching profile:', error);
        throw error;
    }

    return data;
}

/**
 * Create or update a Facebook profile
 */
export async function upsertProfile(profile: {
    fb_user_id: string;
    fb_name: string;
    fb_email?: string | null;
    access_token: string;
    token_expiry: Date;
}): Promise<Profile> {
    const { data, error } = await supabase
        .from('profiles')
        .upsert({
            fb_user_id: profile.fb_user_id,
            fb_name: profile.fb_name,
            fb_email: profile.fb_email,
            access_token: profile.access_token,
            token_expiry: profile.token_expiry.toISOString(),
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'fb_user_id',
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error upserting profile:', error);
        throw error;
    }

    return data;
}

/**
 * Delete a profile and all its ad accounts
 */
export async function deleteProfile(profileId: string): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

    if (error) {
        console.error('[Supabase] Error deleting profile:', error);
        throw error;
    }
}

// ============================================
// AD ACCOUNTS
// ============================================

/**
 * Add ad accounts for a profile
 */
export async function addAdAccounts(profileId: string, accounts: Array<{
    fb_account_id: string;
    name: string;
    status: number;
    currency: string;
    timezone?: string | null;
}>): Promise<AdAccount[]> {
    const accountsToInsert = accounts.map(acc => ({
        profile_id: profileId,
        fb_account_id: acc.fb_account_id,
        name: acc.name,
        status: acc.status,
        currency: acc.currency,
        timezone: acc.timezone,
    }));

    const { data, error } = await supabase
        .from('ad_accounts')
        .upsert(accountsToInsert, {
            onConflict: 'profile_id,fb_account_id',
        })
        .select();

    if (error) {
        console.error('[Supabase] Error adding ad accounts:', error);
        throw error;
    }

    return data || [];
}

/**
 * Delete a specific ad account
 */
export async function deleteAdAccount(accountId: string): Promise<void> {
    const { error } = await supabase
        .from('ad_accounts')
        .delete()
        .eq('id', accountId);

    if (error) {
        console.error('[Supabase] Error deleting ad account:', error);
        throw error;
    }
}

/**
 * Get all ad accounts across all profiles
 */
export async function getAllAdAccounts(): Promise<(AdAccount & { profile: Profile })[]> {
    const { data, error } = await supabase
        .from('ad_accounts')
        .select(`
            *,
            profile:profiles (*)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching ad accounts:', error);
        throw error;
    }

    return data || [];
}

// ============================================
// CREATIVES
// ============================================

/**
 * Get all creatives
 */
export async function getCreatives(): Promise<Creative[]> {
    const { data, error } = await supabase
        .from('creatives')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching creatives:', error);
        throw error;
    }

    return data || [];
}

/**
 * Add a creative record
 */
export async function addCreative(creative: {
    name: string;
    type: 'image' | 'video';
    storage_path: string;
    file_size: number;
    dimensions?: { width: number; height: number } | null;
    duration?: number | null;
    uploaded_by: string;
    fb_hash?: string | null;
}): Promise<Creative> {
    const { data, error } = await supabase
        .from('creatives')
        .insert({
            name: creative.name,
            type: creative.type,
            storage_path: creative.storage_path,
            file_size: creative.file_size,
            dimensions: creative.dimensions as Database['public']['Tables']['creatives']['Insert']['dimensions'],
            duration: creative.duration,
            uploaded_by: creative.uploaded_by,
            fb_hash: creative.fb_hash,
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error adding creative:', error);
        throw error;
    }

    return data;
}

/**
 * Delete a creative
 */
export async function deleteCreative(creativeId: string): Promise<void> {
    // First get the creative to get its storage path
    const { data: creative } = await supabase
        .from('creatives')
        .select('storage_path')
        .eq('id', creativeId)
        .single();

    // Delete from storage if path exists
    if (creative?.storage_path) {
        await supabase.storage
            .from('creatives')
            .remove([creative.storage_path]);
    }

    // Delete from database
    const { error } = await supabase
        .from('creatives')
        .delete()
        .eq('id', creativeId);

    if (error) {
        console.error('[Supabase] Error deleting creative:', error);
        throw error;
    }
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadCreativeFile(
    file: File,
    onProgress?: (progress: number) => void
): Promise<{ path: string; url: string }> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { data, error } = await supabase.storage
        .from('creatives')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        console.error('[Supabase] Error uploading file:', error);
        throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('creatives')
        .getPublicUrl(data.path);

    return {
        path: data.path,
        url: urlData.publicUrl,
    };
}

/**
 * Get public URL for a storage path
 */
export function getCreativeUrl(storagePath: string): string {
    const { data } = supabase.storage
        .from('creatives')
        .getPublicUrl(storagePath);

    return data.publicUrl;
}
