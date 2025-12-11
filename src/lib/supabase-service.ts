// Supabase Service Layer for AdMachin
// Provides typed functions for database operations

import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Untyped client for new tables not yet in database.types.ts
const supabaseUntyped = createClient(
    import.meta.env.VITE_SUPABASE_URL || '',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
);

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type AdAccount = Database['public']['Tables']['ad_accounts']['Row'];
export type Creative = Database['public']['Tables']['creatives']['Row'];
export type AdCopy = Database['public']['Tables']['ad_copies']['Row'];
export type Subproject = Database['public']['Tables']['subprojects']['Row'];

// Persona interface for AI Copywriting workflow
export interface Persona {
    id: string;
    name: string;
    age: number;
    role: string;
    tagline: string;
    background: string;
    current_situation: string;
    pain_points: string[];
    goals: string[];
    motivations: string[];
    objections: string[];
    messaging_angles: string[];
    selected?: boolean;
}

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
 * Delete an ad account by Profile ID and FB Account ID
 */
export async function deleteAdAccountByFbId(profileId: string, fbAccountId: string): Promise<void> {
    const { error } = await supabase
        .from('ad_accounts')
        .delete()
        .eq('profile_id', profileId)
        .eq('fb_account_id', fbAccountId);

    if (error) {
        console.error('[Supabase] Error deleting ad account by FB ID:', error);
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
    dimensions?: { width: number; height: number } | { thumbnail: string } | null;
    duration?: number | null;
    uploaded_by: string;
    fb_hash?: string | null;
    fb_video_id?: string | null;
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
            fb_video_id: creative.fb_video_id,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _onProgress?: (progress: number) => void
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

// ============================================
// AD COPIES
// ============================================

/**
 * Get all Ad Copies
 */
export async function getAdCopies(): Promise<AdCopy[]> {
    const { data: copies, error } = await supabase
        .from('ad_copies')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching ad copies:', error);
        throw error;
    }

    return copies || [];
}

/**
 * Create a new Ad Copy
 */
export async function createAdCopy(copy: {
    user_id?: string | null;
    text: string;
    type: string;
    project?: string;
    project_id?: string | null;
    subproject_id?: string | null;
    platform?: string | null;
    name?: string;
    source_angle?: string | null;
    source_persona?: string | null;
    ai_model?: string | null;
}): Promise<AdCopy> {
    const { data, error } = await supabase
        .from('ad_copies')
        .insert({
            user_id: copy.user_id || null,
            text: copy.text,
            type: copy.type,
            project: copy.project || null,
            project_id: copy.project_id || null,
            subproject_id: copy.subproject_id || null,
            platform: copy.platform || null,
            name: copy.name || null,
            source_angle: copy.source_angle || null,
            source_persona: copy.source_persona || null,
            ai_model: copy.ai_model || null,
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating ad copy:', error);
        throw error;
    }

    return data;
}

/**
 * Update an Ad Copy
 */
export async function updateAdCopy(id: string, updates: Partial<AdCopy>): Promise<AdCopy> {
    const { data, error } = await supabase
        .from('ad_copies')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating ad copy:', error);
        throw error;
    }

    return data;
}

/**
 * Delete an Ad Copy
 */
export async function deleteAdCopy(id: string): Promise<void> {
    const { error } = await supabase
        .from('ad_copies')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting ad copy:', error);
        throw error;
    }
}

// ============================================
// PROJECTS
// ============================================

export interface Project {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    created_by: string | null;
}

export interface User {
    id: string;
    name: string;
    email: string;
    password?: string;
    role: string;
    created_at: string;
    // Legacy fields for compatibility during migration (optional)
    first_name?: string;
    last_name?: string;
}

export interface ProjectUserAssignment {
    id: string;
    project_id: string;
    user_id: string;
    assigned_at: string;
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<Project[]> {
    if (!supabaseUntyped) return [];
    const { data, error } = await supabaseUntyped
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching projects:', error);
        throw error;
    }

    return data || [];
}

/**
 * Create a new project
 */
export async function createProject(name: string, description?: string): Promise<Project> {
    if (!supabaseUntyped) throw new Error('Supabase client not initialized');
    const { data, error } = await supabaseUntyped
        .from('projects')
        .insert({ name, description: description || null })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating project:', error);
        throw error;
    }

    return data;
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
    if (!supabaseUntyped) throw new Error('Supabase client not initialized');
    const { error } = await supabaseUntyped
        .from('projects')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting project:', error);
        throw error;
    }
}

// ============================================
// USERS
// ============================================

/**
 * Get all users
 */
export async function getUsers(): Promise<User[]> {
    if (!supabaseUntyped) return [];
    const { data, error } = await supabaseUntyped
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching users:', error);
        throw error;
    }

    return data || [];
}

/**
 * Create a new user
 */
export async function createUser(firstName: string, lastName: string, email: string, _password: string, role: string = 'member'): Promise<User> {
    if (!supabaseUntyped) throw new Error('Supabase client not initialized');
    const name = `${firstName} ${lastName}`.trim();
    const { data, error } = await supabaseUntyped
        .from('users')
        .insert({ name, email, role }) // Note: password handling omitted for simplicity as per existing pattern
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating user:', error);
        throw error;
    }

    return data;
}

/**
 * Delete a user
 */
export async function deleteUser(id: string): Promise<void> {
    if (!supabaseUntyped) throw new Error('Supabase client not initialized');
    const { error } = await supabaseUntyped
        .from('users')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting user:', error);
        throw error;
    }
}

/**
 * Update a user
 */
export async function updateUser(id: string, updates: { first_name?: string; last_name?: string; name?: string; email?: string; password?: string; role?: string }): Promise<User> {
    if (!supabaseUntyped) throw new Error('Supabase client not initialized');
    // Map legacy first/last to name if needed
    const dbUpdates: any = { ...updates };
    if (updates.first_name || updates.last_name) {
        dbUpdates.name = `${updates.first_name || ''} ${updates.last_name || ''}`.trim();
        delete dbUpdates.first_name;
        delete dbUpdates.last_name;
    }

    const { data, error } = await supabaseUntyped
        .from('users')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating user:', error);
        throw error;
    }

    return data;
}

// ============================================
// PROJECT USER ASSIGNMENTS
// ============================================

/**
 * Get users assigned to a project
 */
export async function getProjectUsers(projectId: string): Promise<User[]> {
    if (!supabaseUntyped) return [];
    const { data, error } = await supabaseUntyped
        .from('project_user_assignments')
        .select(`
            user_id,
            users (*)
        `)
        .eq('project_id', projectId);

    if (error) {
        console.error('[Supabase] Error fetching project users:', error);
        throw error;
    }

    // Extract the user objects from the join
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((item: any) => item.users as User);
}

/**
 * Assign a user to a project
 */
export async function assignUserToProject(projectId: string, userId: string): Promise<void> {
    if (!supabaseUntyped) throw new Error('Supabase client not initialized');
    const { error } = await supabaseUntyped
        .from('project_user_assignments')
        .insert({ project_id: projectId, user_id: userId, assigned_at: new Date().toISOString() });

    if (error) {
        console.error('[Supabase] Error assigning user to project:', error);
        throw error;
    }
}

/**
 * Remove a user from a project
 */
export async function removeUserFromProject(projectId: string, userId: string): Promise<void> {
    if (!supabaseUntyped) throw new Error('Supabase client not initialized');
    const { error } = await supabaseUntyped
        .from('project_user_assignments')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

    if (error) {
        console.error('[Supabase] Error removing user from project:', error);
        throw error;
    }
}

// ============================================
// AD PLANS
// ============================================

export interface AdPlan {
    id: string;
    ad_number: number;
    project_id: string | null;
    user_id: string | null;
    creative_id: string | null;
    reference_creative_id: string | null;
    subproject: string | null;
    subproject_id: string | null;
    plan_type: string | null;
    creative_type: string | null;
    priority: number | null;
    hj_rating: number | null;
    spy_url: string | null;
    description: string | null;
    status: string | null;
    created_at: string;
    project?: Project;
    user?: User;
    creative?: Creative; // Final Creative
    reference_creative?: Creative; // Reference Media
}

export interface AdPlanWithDetails extends AdPlan {
    project: Project;
    user: User;
    creative: Creative; // Final Creative
    reference_creative: Creative; // Reference Media
}

/**
 * Get all Ad Plans
 */
export async function getAdPlans(): Promise<AdPlan[]> {
    const { data: plans, error } = await supabaseUntyped
        .from('ad_plans')
        .select(`
            *,
            project:projects (*),
            user:users (*),
            creative:creatives!ad_plans_creative_id_fkey (*),
            reference_creative:creatives!ad_plans_reference_creative_id_fkey (*)
        `)
        .order('ad_number', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching ad plans:', error);
        throw error;
    }

    return plans || [];
}

/**
 * Create a new Ad Plan
 */
export async function createAdPlan(plan: {
    project_id: string;
    user_id: string;
    subproject?: string;
    plan_type?: string;
    creative_type?: string;
    priority?: number;
    hj_rating?: number;
    spy_url?: string;
    description?: string;
    status?: string;
    creative_id?: string;
    reference_creative_id?: string;
}): Promise<AdPlan> {
    const { data, error } = await supabaseUntyped
        .from('ad_plans')
        .insert({
            project_id: plan.project_id,
            user_id: plan.user_id,
            subproject: plan.subproject || null,
            plan_type: plan.plan_type || null,
            creative_type: plan.creative_type || null,
            priority: plan.priority || null,
            hj_rating: plan.hj_rating || null,
            spy_url: plan.spy_url || null,
            description: plan.description || null,
            status: plan.status || 'not started',
            creative_id: plan.creative_id || null,
            reference_creative_id: plan.reference_creative_id || null
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating ad plan:', error);
        throw error;
    }

    return data;
}

/**
 * Update an Ad Plan
 */
export async function updateAdPlan(id: string, updates: Partial<AdPlan>): Promise<AdPlan> {
    const { data, error } = await supabaseUntyped
        .from('ad_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating ad plan:', error);
        throw error;
    }

    return data;
}

/**
 * Delete an Ad Plan
 */
export async function deleteAdPlan(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('ad_plans')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting ad plan:', error);
        throw error;
    }
}

// ============================================
// SUBPROJECTS
// ============================================

/**
 * Get all subprojects, optionally filtered by project_id
 */
export async function getSubprojects(projectId?: string): Promise<Subproject[]> {
    let query = (supabase as any)
        .from('subprojects')
        .select('*')
        .order('created_at', { ascending: false });

    if (projectId) {
        query = query.eq('project_id', projectId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subprojects, error } = await query as any;

    if (error) {
        console.warn('[Supabase] Warning fetching subprojects (table might not exist yet):', error);
        return [];
    }

    return subprojects || [];
}

/**
 * Create a new subproject
 */
export async function createSubproject(projectId: string, name: string): Promise<Subproject> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from('subprojects')
        .insert({
            project_id: projectId,
            name,
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating subproject:', error);
        throw error;
    }

    return data;
}

/**
 * Delete a subproject
 */
export async function deleteSubproject(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('subprojects')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting subproject:', error);
        throw error;
    }
}
