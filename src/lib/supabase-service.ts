// Supabase Service Layer for AdMachin
// Provides typed functions for database operations

import { supabase, supabaseUntyped } from './supabase';
import type { Database } from './database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type AdAccount = Database['public']['Tables']['ad_accounts']['Row'];
export type Creative = Database['public']['Tables']['creatives']['Row'];
export type AdCopy = Database['public']['Tables']['ad_copies']['Row'];
export type Subproject = Database['public']['Tables']['subprojects']['Row'];

// Persona interface for AI Copywriting workflow - simplified to single paragraph
export interface Persona {
    id: string;
    name: string;           // Short name/label (e.g., "Recent Survivor", "Long-term Victim")
    description: string;    // Single paragraph, max 100 words describing the persona
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
    user_id?: string | null;
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
            user_id: creative.user_id,
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
 * Update a creative
 */
export async function updateCreative(
    creativeId: string,
    updates: Partial<Pick<Creative, 'name' | 'project_id' | 'subproject_id'>>
): Promise<Creative> {
    const { data, error } = await supabase
        .from('creatives')
        .update(updates)
        .eq('id', creativeId)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating creative:', error);
        throw error;
    }

    return data;
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
// AVATARS
// ============================================

/**
 * Upload an avatar image to Supabase Storage
 * @param file - The image file (should be cropped JPEG blob)
 * @param userId - The user's ID for organizing storage
 * @returns The public URL of the uploaded avatar
 */
export async function uploadAvatar(file: Blob, userId: string): Promise<string> {
    const fileName = `${userId}/${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg',
        });

    if (error) {
        console.error('[Supabase] Error uploading avatar:', error);
        throw new Error(error.message || 'Failed to upload avatar');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

    return urlData.publicUrl;
}

/**
 * Delete old avatar files for a user (cleanup)
 * @param userId - The user's ID
 * @param keepUrl - Optional URL to keep (the current avatar)
 */
export async function deleteOldAvatars(userId: string, keepUrl?: string): Promise<void> {
    try {
        // List all files in the user's avatar folder
        const { data: files, error } = await supabase.storage
            .from('avatars')
            .list(userId);

        if (error || !files) return;

        // Filter out the current avatar if keepUrl is provided
        const filesToDelete = files
            .filter(file => {
                if (!keepUrl) return true;
                return !keepUrl.includes(file.name);
            })
            .map(file => `${userId}/${file.name}`);

        if (filesToDelete.length > 0) {
            await supabase.storage
                .from('avatars')
                .remove(filesToDelete);
        }
    } catch (err) {
        console.warn('[Supabase] Error cleaning up old avatars:', err);
        // Don't throw - this is a cleanup operation
    }
}

/**
 * Get public URL for an avatar path
 */
export function getAvatarUrl(storagePath: string): string {
    const { data } = supabase.storage
        .from('avatars')
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
 * NOTE: subproject_id is accepted but not inserted until column is added to database
 * Run: ALTER TABLE ad_copies ADD COLUMN subproject_id UUID REFERENCES subprojects(id);
 */
export async function createAdCopy(copy: {
    user_id?: string | null;
    text: string;
    type: string;
    project?: string | null;
    project_id?: string | null;
    subproject_id?: string | null; // TODO: Enable once column exists in database
    platform?: string | null;
    name?: string | null;
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
    first_name: string;
    last_name: string;
    email: string;
    password?: string;
    role: string;
    avatar_url?: string | null;
    created_at: string;
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
    const { data, error } = await supabaseUntyped
        .from('users')
        .insert({ first_name: firstName, last_name: lastName, email, role })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating user:', error);
        throw new Error(error.message || 'Failed to create user');
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
export async function updateUser(id: string, updates: { first_name?: string; last_name?: string; email?: string; password?: string; role?: string; avatar_url?: string | null }): Promise<User> {
    if (!supabaseUntyped) throw new Error('Supabase client not initialized');

    // Build update object with only allowed fields
    const dbUpdates: any = {};
    if (updates.first_name !== undefined) dbUpdates.first_name = updates.first_name;
    if (updates.last_name !== undefined) dbUpdates.last_name = updates.last_name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.avatar_url !== undefined) dbUpdates.avatar_url = updates.avatar_url;
    // Note: password not stored in users table

    const { data, error } = await supabaseUntyped
        .from('users')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating user:', error);
        throw new Error(error.message || 'Failed to update user');
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
    row_number: number;
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
        .order('row_number', { ascending: false });

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
    project_id?: string | null;
    user_id?: string | null;
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
            project_id: plan.project_id || null,
            user_id: plan.user_id || null,
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

// ============================================
// USER VIEW PREFERENCES (Row Order, Sort, Group)
// ============================================

export interface ViewPreferencesConfig {
    sort_config?: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
    filter_config?: Array<{ id: string; field: string; operator: string; value: string; conjunction: 'and' | 'or' }>;
    group_config?: Array<{ id: string; key: string; direction: 'asc' | 'desc' }>;
    wrap_config?: Array<{ columnKey: string; lines: '1' | '3' | 'full' }>;
    thumbnail_size_config?: Array<{ columnKey: string; size: 'small' | 'medium' | 'large' | 'xl' }>;
    row_order?: string[];
    column_widths?: Record<string, number>;
    column_order?: string[];
}

export interface UserViewPreferences extends ViewPreferencesConfig {
    id?: string;
    user_id: string;
    view_id: string;
    group_by?: string | null; // Legacy field
    created_at?: string;
    updated_at?: string;
}

export interface SharedViewPreferences extends ViewPreferencesConfig {
    id?: string;
    view_id: string;
    group_by?: string | null; // Legacy field
    created_at?: string;
    updated_at?: string;
}

/**
 * Get user's view preferences (sort, group, row order)
 */
export async function getUserViewPreferences(userId: string, viewId: string): Promise<UserViewPreferences | null> {
    const { data, error } = await supabaseUntyped
        .from('user_view_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('view_id', viewId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] Error fetching view preferences:', error);
        throw error;
    }

    return data || null;
}

/**
 * Save user's row order for a specific view
 */
export async function saveRowOrder(userId: string, viewId: string, rowOrder: string[]): Promise<void> {
    const { error } = await supabaseUntyped
        .from('user_view_preferences')
        .upsert({
            user_id: userId,
            view_id: viewId,
            row_order: rowOrder,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,view_id'
        });

    if (error) {
        console.error('[Supabase] Error saving row order:', error);
        throw error;
    }
}

/**
 * Save user's full view preferences (sort, group, row order)
 */
export async function saveUserViewPreferences(
    userId: string,
    viewId: string,
    preferences: Partial<Omit<UserViewPreferences, 'id' | 'user_id' | 'view_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
    const { error } = await supabaseUntyped
        .from('user_view_preferences')
        .upsert({
            user_id: userId,
            view_id: viewId,
            ...preferences,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,view_id'
        });

    if (error) {
        console.error('[Supabase] Error saving view preferences:', error);
        throw error;
    }
}

/**
 * Delete user's view preferences (reset to shared/default)
 */
export async function deleteUserViewPreferences(userId: string, viewId: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('user_view_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('view_id', viewId);

    if (error) {
        console.error('[Supabase] Error deleting view preferences:', error);
        throw error;
    }
}

// ============================================
// SHARED VIEW PREFERENCES (Save for Everyone)
// ============================================

/**
 * Get shared view preferences (default for everyone)
 * Returns null gracefully on any error (table may not exist in all environments)
 */
export async function getSharedViewPreferences(viewId: string): Promise<SharedViewPreferences | null> {
    try {
        const { data, error } = await supabaseUntyped
            .from('shared_view_preferences')
            .select('*')
            .eq('view_id', viewId)
            .single();

        // PGRST116 = no rows found, which is fine
        if (error && error.code !== 'PGRST116') {
            console.warn('[Supabase] Shared view preferences unavailable:', error.message);
            return null;
        }

        return data || null;
    } catch (err) {
        // Table might not exist - fail gracefully
        console.warn('[Supabase] Shared view preferences table may not exist');
        return null;
    }
}

/**
 * Save shared view preferences (save for everyone)
 * Fails silently if table doesn't exist
 */
export async function saveSharedViewPreferences(
    viewId: string,
    preferences: Partial<Omit<SharedViewPreferences, 'id' | 'view_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
    try {
        const { error } = await supabaseUntyped
            .from('shared_view_preferences')
            .upsert({
                view_id: viewId,
                ...preferences,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'view_id'
            });

        if (error) {
            console.warn('[Supabase] Could not save shared view preferences:', error.message);
        }
    } catch (err) {
        // Table might not exist - fail gracefully
        console.warn('[Supabase] Shared view preferences table may not exist');
    }
}

// ============================================
// ADS
// ============================================

export interface Ad {
    id: string;
    row_number: number;
    creative_id: string | null;
    traffic: string | null;
    ad_type: string | null;
    project_id: string | null;
    subproject_id: string | null;
    user_id: string | null;
    headline_id: string | null;
    primary_id: string | null;
    description_id: string | null;
    created_at: string;
    updated_at: string;
    // Joined relations
    creative?: Creative;
    project?: Project;
    subproject?: Subproject;
    user?: User;
    headline?: AdCopy;
    primary?: AdCopy;
    description?: AdCopy;
}

/**
 * Get all Ads with related data
 */
export async function getAds(): Promise<Ad[]> {
    const { data: ads, error } = await supabaseUntyped
        .from('ads')
        .select(`
            *,
            creative:creatives (*),
            project:projects (*),
            subproject:subprojects (*),
            user:users (*),
            headline:ad_copies!ads_headline_id_fkey (*),
            primary:ad_copies!ads_primary_id_fkey (*),
            description:ad_copies!ads_description_id_fkey (*)
        `)
        .order('row_number', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching ads:', error);
        throw error;
    }

    return ads || [];
}

/**
 * Create a new Ad
 */
export async function createAd(ad: {
    creative_id?: string | null;
    traffic?: string | null;
    ad_type?: string | null;
    project_id?: string | null;
    subproject_id?: string | null;
    user_id?: string | null;
    headline_id?: string | null;
    primary_id?: string | null;
    description_id?: string | null;
}): Promise<Ad> {
    const { data, error } = await supabaseUntyped
        .from('ads')
        .insert({
            creative_id: ad.creative_id || null,
            traffic: ad.traffic || null,
            ad_type: ad.ad_type || null,
            project_id: ad.project_id || null,
            subproject_id: ad.subproject_id || null,
            user_id: ad.user_id || null,
            headline_id: ad.headline_id || null,
            primary_id: ad.primary_id || null,
            description_id: ad.description_id || null,
        })
        .select(`
            *,
            creative:creatives (*),
            project:projects (*),
            subproject:subprojects (*),
            user:users (*),
            headline:ad_copies!ads_headline_id_fkey (*),
            primary:ad_copies!ads_primary_id_fkey (*),
            description:ad_copies!ads_description_id_fkey (*)
        `)
        .single();

    if (error) {
        console.error('[Supabase] Error creating ad:', error);
        throw error;
    }

    return data;
}

/**
 * Update an existing Ad
 */
export async function updateAd(id: string, updates: Partial<Ad>): Promise<Ad> {
    // Remove relation fields before update
    const { creative, project, subproject, user, headline, primary, description, ...updateData } = updates;

    const { data, error } = await supabaseUntyped
        .from('ads')
        .update({
            ...updateData,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
            *,
            creative:creatives (*),
            project:projects (*),
            subproject:subprojects (*),
            user:users (*),
            headline:ad_copies!ads_headline_id_fkey (*),
            primary:ad_copies!ads_primary_id_fkey (*),
            description:ad_copies!ads_description_id_fkey (*)
        `)
        .single();

    if (error) {
        console.error('[Supabase] Error updating ad:', error);
        throw error;
    }

    return data;
}

/**
 * Delete an Ad
 */
export async function deleteAd(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('ads')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting ad:', error);
        throw error;
    }
}

/**
 * Batch create multiple Ads at once
 */
export async function createAds(ads: Array<{
    creative_id?: string | null;
    headline_id?: string | null;
    primary_id?: string | null;
    description_id?: string | null;
    user_id?: string | null;
    project_id?: string | null;
    subproject_id?: string | null;
}>): Promise<Ad[]> {
    if (ads.length === 0) return [];

    const { data, error } = await supabaseUntyped
        .from('ads')
        .insert(ads.map(ad => ({
            creative_id: ad.creative_id || null,
            headline_id: ad.headline_id || null,
            primary_id: ad.primary_id || null,
            description_id: ad.description_id || null,
            user_id: ad.user_id || null,
            project_id: ad.project_id || null,
            subproject_id: ad.subproject_id || null,
        })))
        .select('*');

    if (error) {
        console.error('[Supabase] Error batch creating ads:', error);
        throw error;
    }

    return data || [];
}

// ============================================
// VIDEO GENERATOR
// ============================================

export interface VideoGenerator {
    id: string;
    row_number: number;
    project_id: string | null;
    subproject_id: string | null;
    owner_id: string | null;
    image_storage_path: string | null;
    video_prompt: string | null;
    model: 'sora-2-text-to-video' | 'sora-2-web-t2v';
    duration: 10 | 15;  // kie.ai Sora 2 API supports 10 or 15 seconds
    aspect_ratio: 'landscape' | 'portrait';  // Sora 2 only supports landscape and portrait
    status: 'pending' | 'generating' | 'completed' | 'failed';
    middle_frame_path: string | null;
    transcript: string | null;
    created_at: string;
    updated_at: string;
}

export interface VideoOutputLogEntry {
    id: number;
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
}

export interface VideoOutput {
    id: string;
    row_number: number;
    video_generator_id: string | null;
    output_storage_path: string | null;
    final_video_url: string | null;
    sora_url: string | null;
    new_url: string | null;
    transcript: string | null;
    task_id: string | null;
    task_status: 'pending' | 'processing' | 'completed' | 'failed';
    task_error: string | null;
    duration_seconds: number | null;
    file_size: number | null;
    metadata: Record<string, unknown> | null;
    logs: VideoOutputLogEntry[];
    created_at: string;
    updated_at: string;
}

export interface VideoGeneratorWithDetails extends VideoGenerator {
    project?: Project;
    subproject?: Subproject;
    owner?: User;
    video_outputs?: VideoOutput[];
}

export interface VideoOutputWithDetails extends VideoOutput {
    video_generator?: VideoGenerator;
}

/**
 * Get all video generator entries with relations
 */
export async function getVideoGenerators(): Promise<VideoGeneratorWithDetails[]> {
    const { data, error } = await supabaseUntyped
        .from('video_generator')
        .select(`
            *,
            project:projects (*),
            subproject:subprojects (*),
            owner:users (*),
            video_outputs:video_output (*)
        `)
        .order('row_number', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching video generators:', error);
        throw error;
    }
    return data || [];
}

/**
 * Get a single video generator by ID
 */
export async function getVideoGeneratorById(id: string): Promise<VideoGeneratorWithDetails | null> {
    const { data, error } = await supabaseUntyped
        .from('video_generator')
        .select(`
            *,
            project:projects (*),
            subproject:subprojects (*),
            owner:users (*),
            video_outputs:video_output (*)
        `)
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] Error fetching video generator:', error);
        throw error;
    }
    return data || null;
}

/**
 * Create a new video generator entry
 */
export async function createVideoGenerator(entry: {
    project_id?: string | null;
    subproject_id?: string | null;
    owner_id?: string | null;
    image_storage_path?: string | null;
    video_prompt?: string | null;
}): Promise<VideoGenerator> {
    const { data, error } = await supabaseUntyped
        .from('video_generator')
        .insert({
            project_id: entry.project_id || null,
            subproject_id: entry.subproject_id || null,
            owner_id: entry.owner_id || null,
            image_storage_path: entry.image_storage_path || null,
            video_prompt: entry.video_prompt || null,
            status: 'pending'
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating video generator:', error);
        throw error;
    }
    return data;
}

/**
 * Update a video generator entry
 */
export async function updateVideoGenerator(
    id: string,
    updates: Partial<Omit<VideoGenerator, 'id' | 'row_number' | 'created_at'>>
): Promise<VideoGenerator> {
    const { data, error } = await supabaseUntyped
        .from('video_generator')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating video generator:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a video generator entry
 */
export async function deleteVideoGenerator(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('video_generator')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting video generator:', error);
        throw error;
    }
}

// ============================================
// VIDEO OUTPUT
// ============================================

/**
 * Get all video outputs with relations
 */
export async function getVideoOutputs(): Promise<VideoOutputWithDetails[]> {
    const { data, error } = await supabaseUntyped
        .from('video_output')
        .select(`
            *,
            video_generator:video_generator (
                *,
                project:projects (*),
                subproject:subprojects (*),
                owner:users (*)
            )
        `)
        .order('row_number', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching video outputs:', error);
        throw error;
    }
    return data || [];
}

/**
 * Get video outputs for a specific generator
 */
export async function getVideoOutputsByGeneratorId(generatorId: string): Promise<VideoOutput[]> {
    const { data, error } = await supabaseUntyped
        .from('video_output')
        .select('*')
        .eq('video_generator_id', generatorId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching video outputs:', error);
        throw error;
    }
    return data || [];
}

/**
 * Create a new video output entry
 */
export async function createVideoOutput(entry: {
    video_generator_id: string;
    task_id?: string;
    task_status?: string;
    output_storage_path?: string;
    final_video_url?: string;
    transcript?: string | null;
    metadata?: Record<string, unknown>;
}): Promise<VideoOutput> {
    const { data, error } = await supabaseUntyped
        .from('video_output')
        .insert({
            video_generator_id: entry.video_generator_id,
            task_id: entry.task_id || null,
            task_status: entry.task_status || 'pending',
            output_storage_path: entry.output_storage_path || null,
            final_video_url: entry.final_video_url || null,
            transcript: entry.transcript || null,
            metadata: entry.metadata || null,
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating video output:', error);
        throw error;
    }
    return data;
}

/**
 * Update a video output entry
 */
export async function updateVideoOutput(
    id: string,
    updates: Partial<Omit<VideoOutput, 'id' | 'row_number' | 'created_at'>>
): Promise<VideoOutput> {
    const { data, error } = await supabaseUntyped
        .from('video_output')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating video output:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a video output entry
 */
export async function deleteVideoOutput(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('video_output')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting video output:', error);
        throw error;
    }
}

/**
 * Save all logs to video output (replaces existing logs)
 */
export async function saveVideoOutputLogs(
    id: string,
    logs: VideoOutputLogEntry[]
): Promise<void> {
    const { error } = await supabaseUntyped
        .from('video_output')
        .update({ logs })
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error saving video output logs:', error);
        throw error;
    }
}

/**
 * Get video output by id with logs
 */
export async function getVideoOutput(id: string): Promise<VideoOutput | null> {
    const { data, error } = await supabaseUntyped
        .from('video_output')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('[Supabase] Error fetching video output:', error);
        return null;
    }
    return data;
}

/**
 * Upload a video file to the video-generator bucket
 * @param buffer - The video file as ArrayBuffer or Uint8Array
 * @param videoOutputId - The video output ID for organizing storage
 * @param filename - Optional filename (defaults to timestamp.mp4)
 * @returns Object with storage path and public URL
 */
export async function uploadVideoFile(
    buffer: ArrayBuffer | Uint8Array,
    videoOutputId: string,
    filename?: string
): Promise<{ path: string; url: string }> {
    const finalFilename = filename || `${Date.now()}.mp4`;
    const filePath = `videos/${videoOutputId}/${finalFilename}`;

    const { data, error } = await supabase.storage
        .from('video-generator')
        .upload(filePath, buffer, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'video/mp4',
        });

    if (error) {
        console.error('[Supabase] Error uploading video:', error);
        throw new Error(error.message || 'Failed to upload video');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('video-generator')
        .getPublicUrl(data.path);

    return {
        path: data.path,
        url: urlData.publicUrl,
    };
}

/**
 * Get public URL for a video generator storage path
 */
export function getVideoGeneratorStorageUrl(storagePath: string): string {
    const { data } = supabase.storage
        .from('video-generator')
        .getPublicUrl(storagePath);
    return data.publicUrl;
}

// ============================================
// SORA CHARACTER
// ============================================

export interface SoraCharacterLogEntry {
    id: number;
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
}

export interface SoraCharacter {
    id: string;
    row_number: number;
    character_name: string | null;
    sora_character_id: string | null;  // URL slug like "expadz.mayalandma"
    source_video_url: string | null;
    video_output_id: string | null;
    avatar_url: string | null;
    description: string | null;
    restrictions: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    task_error: string | null;
    logs: SoraCharacterLogEntry[];
    created_at: string;
    updated_at: string;
}

export interface SoraCharacterWithDetails extends SoraCharacter {
    video_output?: VideoOutput;
}

/**
 * Get all sora characters
 */
export async function getSoraCharacters(): Promise<SoraCharacterWithDetails[]> {
    const { data, error } = await supabaseUntyped
        .from('sora_character')
        .select(`
            *,
            video_output:video_output (*)
        `)
        .order('row_number', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching sora characters:', error);
        throw error;
    }
    return data || [];
}

/**
 * Get a single sora character by ID
 */
export async function getSoraCharacterById(id: string): Promise<SoraCharacterWithDetails | null> {
    const { data, error } = await supabaseUntyped
        .from('sora_character')
        .select(`
            *,
            video_output:video_output (*)
        `)
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] Error fetching sora character:', error);
        throw error;
    }
    return data;
}

/**
 * Create a new sora character
 */
export async function createSoraCharacter(character: {
    source_video_url?: string | null;
    video_output_id?: string | null;
    character_name?: string | null;
    sora_character_id?: string | null;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
}): Promise<SoraCharacter> {
    const { data, error } = await supabaseUntyped
        .from('sora_character')
        .insert({
            source_video_url: character.source_video_url || null,
            video_output_id: character.video_output_id || null,
            character_name: character.character_name || null,
            sora_character_id: character.sora_character_id || null,
            status: character.status || 'pending',
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating sora character:', error);
        throw error;
    }
    return data;
}

/**
 * Update a sora character
 */
export async function updateSoraCharacter(
    id: string,
    updates: Partial<Omit<SoraCharacter, 'id' | 'row_number' | 'created_at'>>
): Promise<SoraCharacter> {
    const { data, error } = await supabaseUntyped
        .from('sora_character')
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating sora character:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a sora character
 */
export async function deleteSoraCharacter(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('sora_character')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting sora character:', error);
        throw error;
    }
}

/**
 * Save logs to a sora character record
 */
export async function saveSoraCharacterLogs(
    id: string,
    logs: SoraCharacterLogEntry[]
): Promise<void> {
    const { error } = await supabaseUntyped
        .from('sora_character')
        .update({ logs })
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error saving sora character logs:', error);
        throw error;
    }
}

// ============================================
// AI COPY - CAMPAIGN PARAMETERS
// ============================================

// Refinement round for iterative feedback
export interface RefinementRound {
    timestamp: string;
    output: Array<{ name: string; description: string }>;
    feedback: string;
}

// Auto-fill refinement round
export interface AutoFillRefinementRound {
    round: number;
    timestamp: string;
    output: {
        productDescription: string;
        personaInput: string;
        keyQualifyingCriteria?: string;
        offerFlow?: string;
        proofPoints?: string;
        primaryObjections?: string;
        swipeFiles: string;
        // customPrompt intentionally not tracked - always left empty
    };
    feedback: string;
}

// Refinement history stored in campaign_parameters
export interface RefinementHistory {
    personas: RefinementRound[];
    angles: RefinementRound[];
    ads: RefinementRound[];
    autofill?: AutoFillRefinementRound[];
}

export interface CampaignParameter {
    id: string;
    row_number?: number;
    name: string;
    description: string | null;
    persona_input: string | null;
    swipe_files: string | null;
    custom_prompt: string | null;
    key_qualifying_criteria: string | null;
    offer_flow: string | null;
    proof_points: string | null;
    primary_objections: string | null;
    project_id: string | null;
    subproject_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    refinement_history: RefinementHistory | null;
}

export async function getCampaignParameters(): Promise<CampaignParameter[]> {
    const { data, error } = await supabaseUntyped
        .from('campaign_parameters')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching campaign parameters:', error);
        throw error;
    }

    return data || [];
}

export async function getCampaignParameter(id: string): Promise<CampaignParameter | null> {
    const { data, error } = await supabaseUntyped
        .from('campaign_parameters')
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] Error fetching campaign parameter:', error);
        throw error;
    }

    return data;
}

export async function createCampaignParameter(params: Omit<CampaignParameter, 'id' | 'created_at' | 'updated_at'>): Promise<CampaignParameter> {
    const { data, error } = await supabaseUntyped
        .from('campaign_parameters')
        .insert(params)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating campaign parameter:', error);
        throw error;
    }

    return data;
}

export async function updateCampaignParameter(id: string, updates: Partial<CampaignParameter>): Promise<CampaignParameter> {
    const { data, error } = await supabaseUntyped
        .from('campaign_parameters')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating campaign parameter:', error);
        throw error;
    }

    return data;
}

export async function deleteCampaignParameter(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('campaign_parameters')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting campaign parameter:', error);
        throw error;
    }
}

// Update refinement history for a specific section (personas, angles, or ads)
export async function updateRefinementHistory(
    campaignParameterId: string,
    section: 'personas' | 'angles' | 'ads',
    history: RefinementRound[]
): Promise<void> {
    // First get current history
    const current = await getCampaignParameter(campaignParameterId);
    if (!current) {
        throw new Error('Campaign parameter not found');
    }

    const currentHistory = current.refinement_history || { personas: [], angles: [], ads: [] };
    const updatedHistory = { ...currentHistory, [section]: history };

    const { error } = await supabaseUntyped
        .from('campaign_parameters')
        .update({
            refinement_history: updatedHistory,
            updated_at: new Date().toISOString()
        })
        .eq('id', campaignParameterId);

    if (error) {
        console.error('[Supabase] Error updating refinement history:', error);
        throw error;
    }
}

// Clear refinement history for a specific section
export async function clearRefinementHistory(
    campaignParameterId: string,
    section: 'personas' | 'angles' | 'ads'
): Promise<void> {
    await updateRefinementHistory(campaignParameterId, section, []);
}

// Update auto-fill refinement history
export async function updateAutoFillHistory(
    campaignParameterId: string,
    history: AutoFillRefinementRound[]
): Promise<void> {
    // First get current history
    const current = await getCampaignParameter(campaignParameterId);
    if (!current) {
        throw new Error('Campaign parameter not found');
    }

    const currentHistory = current.refinement_history || { personas: [], angles: [], ads: [], autofill: [] };
    const updatedHistory = { ...currentHistory, autofill: history };

    const { error } = await supabaseUntyped
        .from('campaign_parameters')
        .update({
            refinement_history: updatedHistory,
            updated_at: new Date().toISOString()
        })
        .eq('id', campaignParameterId);

    if (error) {
        console.error('[Supabase] Error updating auto-fill history:', error);
        throw error;
    }
}

// Clear auto-fill refinement history
export async function clearAutoFillHistory(
    campaignParameterId: string
): Promise<void> {
    await updateAutoFillHistory(campaignParameterId, []);
}

// Get auto-fill history for a campaign parameter
export async function getAutoFillHistory(
    campaignParameterId: string
): Promise<AutoFillRefinementRound[]> {
    const current = await getCampaignParameter(campaignParameterId);
    if (!current) {
        return [];
    }
    return current.refinement_history?.autofill || [];
}

// ============================================
// AI COPY - PERSONA FRAMEWORKS
// ============================================

export interface PersonaFramework {
    id: string;
    row_number?: number;
    title: string;
    content: string | null;
    project_id: string | null;
    subproject_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export async function getPersonaFrameworks(): Promise<PersonaFramework[]> {
    const { data, error } = await supabaseUntyped
        .from('persona_frameworks')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Error fetching persona frameworks:', error);
        throw error;
    }

    return data || [];
}

export async function createPersonaFramework(
    framework: Omit<PersonaFramework, 'id' | 'created_at' | 'updated_at'>
): Promise<PersonaFramework> {
    const { data, error } = await supabaseUntyped
        .from('persona_frameworks')
        .insert(framework)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating persona framework:', error);
        throw error;
    }

    return data;
}

export async function updatePersonaFramework(
    id: string,
    updates: Partial<Omit<PersonaFramework, 'id' | 'created_at' | 'updated_at'>>
): Promise<void> {
    const { error } = await supabaseUntyped
        .from('persona_frameworks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error updating persona framework:', error);
        throw error;
    }
}

export async function deletePersonaFramework(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('persona_frameworks')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting persona framework:', error);
        throw error;
    }
}

export async function createPersonaFrameworksBatch(
    frameworks: Array<Omit<PersonaFramework, 'id' | 'created_at' | 'updated_at'>>
): Promise<PersonaFramework[]> {
    if (frameworks.length === 0) return [];

    const { data, error } = await supabaseUntyped
        .from('persona_frameworks')
        .insert(frameworks)
        .select();

    if (error) {
        console.error('[Supabase] Error creating persona frameworks batch:', error);
        throw error;
    }

    return data || [];
}

// ============================================
// AI COPY - CREATIVE CONCEPTS
// ============================================

export interface CreativeConcept {
    id: string;
    row_number?: number;
    name: string;
    description: string | null;
    example: string | null;
    project_id: string | null;
    subproject_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export async function getCreativeConcepts(): Promise<CreativeConcept[]> {
    const { data, error } = await supabaseUntyped
        .from('creative_concepts')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('[Supabase] Error fetching creative concepts:', error);
        throw error;
    }

    return data || [];
}

export async function createCreativeConcept(params: Omit<CreativeConcept, 'id' | 'created_at' | 'updated_at'>): Promise<CreativeConcept> {
    const { data, error } = await supabaseUntyped
        .from('creative_concepts')
        .insert(params)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating creative concept:', error);
        throw error;
    }

    return data;
}

export async function updateCreativeConcept(id: string, updates: Partial<CreativeConcept>): Promise<CreativeConcept> {
    const { data, error } = await supabaseUntyped
        .from('creative_concepts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating creative concept:', error);
        throw error;
    }

    return data;
}

export async function deleteCreativeConcept(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('creative_concepts')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting creative concept:', error);
        throw error;
    }
}

// ============================================
// AI COPY - PERSONAS
// ============================================

export interface AIPrompts {
    system: string;
    user: string;
    model: string;
}

export interface AIPersona {
    id: string;
    row_number?: number;
    campaign_parameter_id: string | null;
    content: string;
    prompts: AIPrompts | null;
    project_id: string | null;
    subproject_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export async function getAIPersonas(campaignParameterId?: string): Promise<AIPersona[]> {
    let query = supabaseUntyped
        .from('ai_personas')
        .select('*')
        .order('created_at', { ascending: false });

    if (campaignParameterId) {
        query = query.eq('campaign_parameter_id', campaignParameterId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Supabase] Error fetching AI personas:', error);
        throw error;
    }

    return data || [];
}

export async function createAIPersona(params: Omit<AIPersona, 'id' | 'created_at' | 'updated_at'>): Promise<AIPersona> {
    const { data, error } = await supabaseUntyped
        .from('ai_personas')
        .insert(params)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating AI persona:', error);
        throw error;
    }

    return data;
}

export async function createAIPersonasBatch(personas: Omit<AIPersona, 'id' | 'created_at' | 'updated_at'>[]): Promise<AIPersona[]> {
    const { data, error } = await supabaseUntyped
        .from('ai_personas')
        .insert(personas)
        .select();

    if (error) {
        console.error('[Supabase] Error creating AI personas batch:', error);
        throw error;
    }

    return data || [];
}

export async function updateAIPersona(id: string, updates: Partial<AIPersona>): Promise<AIPersona> {
    const { data, error } = await supabaseUntyped
        .from('ai_personas')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating AI persona:', error);
        throw error;
    }

    return data;
}

export async function deleteAIPersona(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('ai_personas')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting AI persona:', error);
        throw error;
    }
}

// ============================================
// AI COPY - ANGLES
// ============================================

export interface AIAngle {
    id: string;
    row_number?: number;
    campaign_parameter_id: string | null;
    persona_id: string | null;
    creative_concept_id: string | null;
    content: string;
    prompts: AIPrompts | null;
    project_id: string | null;
    subproject_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export async function getAIAngles(filters?: { campaignParameterId?: string; personaId?: string }): Promise<AIAngle[]> {
    let query = supabaseUntyped
        .from('ai_angles')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters?.campaignParameterId) {
        query = query.eq('campaign_parameter_id', filters.campaignParameterId);
    }
    if (filters?.personaId) {
        query = query.eq('persona_id', filters.personaId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Supabase] Error fetching AI angles:', error);
        throw error;
    }

    return data || [];
}

export async function createAIAngle(params: Omit<AIAngle, 'id' | 'created_at' | 'updated_at'>): Promise<AIAngle> {
    const { data, error } = await supabaseUntyped
        .from('ai_angles')
        .insert(params)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating AI angle:', error);
        throw error;
    }

    return data;
}

export async function createAIAnglesBatch(angles: Omit<AIAngle, 'id' | 'created_at' | 'updated_at'>[]): Promise<AIAngle[]> {
    const { data, error } = await supabaseUntyped
        .from('ai_angles')
        .insert(angles)
        .select();

    if (error) {
        console.error('[Supabase] Error creating AI angles batch:', error);
        throw error;
    }

    return data || [];
}

export async function updateAIAngle(id: string, updates: Partial<AIAngle>): Promise<AIAngle> {
    const { data, error } = await supabaseUntyped
        .from('ai_angles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating AI angle:', error);
        throw error;
    }

    return data;
}

export async function deleteAIAngle(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('ai_angles')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting AI angle:', error);
        throw error;
    }
}

// ============================================
// AI COPY - GENERATED ADS
// ============================================

export interface AIGeneratedAd {
    id: string;
    row_number?: number;
    campaign_parameter_id: string | null;
    persona_id: string | null;
    angle_id: string | null;
    creative_concept_id: string | null;
    content: string;
    ad_type: string;
    prompts: AIPrompts | null;
    project_id: string | null;
    subproject_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export async function getAIGeneratedAds(filters?: { campaignParameterId?: string; angleId?: string }): Promise<AIGeneratedAd[]> {
    let query = supabaseUntyped
        .from('ai_generated_ads')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters?.campaignParameterId) {
        query = query.eq('campaign_parameter_id', filters.campaignParameterId);
    }
    if (filters?.angleId) {
        query = query.eq('angle_id', filters.angleId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Supabase] Error fetching AI generated ads:', error);
        throw error;
    }

    return data || [];
}

export async function createAIGeneratedAd(params: Omit<AIGeneratedAd, 'id' | 'created_at' | 'updated_at'>): Promise<AIGeneratedAd> {
    const { data, error } = await supabaseUntyped
        .from('ai_generated_ads')
        .insert(params)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error creating AI generated ad:', error);
        throw error;
    }

    return data;
}

export async function createAIGeneratedAdsBatch(ads: Omit<AIGeneratedAd, 'id' | 'created_at' | 'updated_at'>[]): Promise<AIGeneratedAd[]> {
    const { data, error } = await supabaseUntyped
        .from('ai_generated_ads')
        .insert(ads)
        .select();

    if (error) {
        console.error('[Supabase] Error creating AI generated ads batch:', error);
        throw error;
    }

    return data || [];
}

export async function updateAIGeneratedAd(id: string, updates: Partial<AIGeneratedAd>): Promise<AIGeneratedAd> {
    const { data, error } = await supabaseUntyped
        .from('ai_generated_ads')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Error updating AI generated ad:', error);
        throw error;
    }

    return data;
}

export async function deleteAIGeneratedAd(id: string): Promise<void> {
    const { error } = await supabaseUntyped
        .from('ai_generated_ads')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Supabase] Error deleting AI generated ad:', error);
        throw error;
    }
}

