// Database type definitions for Supabase
// These types are generated based on our schema

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            ad_copies: {
                Row: {
                    id: string
                    user_id: string | null
                    text: string
                    type: string
                    project: string | null
                    project_id: string | null // Linked project
                    subproject_id: string | null
                    platform: string | null
                    name: string | null
                    source_angle: string | null
                    source_persona: string | null
                    ai_model: string | null
                    ad_page: string | null
                    notion: string | null
                    blocknote: string | null
                    created_at: string
                    updated_at: string
                    row_number: number
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    text: string
                    type: string
                    project?: string | null
                    project_id?: string | null
                    subproject_id?: string | null
                    platform?: string | null
                    name?: string | null
                    source_angle?: string | null
                    source_persona?: string | null
                    ai_model?: string | null
                    ad_page?: string | null
                    notion?: string | null
                    blocknote?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    text?: string
                    type?: string
                    project?: string | null
                    project_id?: string | null
                    subproject_id?: string | null
                    platform?: string | null
                    name?: string | null
                    source_angle?: string | null
                    source_persona?: string | null
                    ai_model?: string | null
                    ad_page?: string | null
                    notion?: string | null
                    blocknote?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "ad_copies_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            profiles: {
                Row: {
                    id: string
                    user_id: string | null
                    fb_user_id: string
                    fb_name: string
                    fb_email: string | null
                    access_token: string
                    token_expiry: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    fb_user_id: string
                    fb_name: string
                    fb_email?: string | null
                    access_token: string
                    token_expiry: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    fb_user_id?: string
                    fb_name?: string
                    fb_email?: string | null
                    access_token?: string
                    token_expiry?: string
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            ad_accounts: {
                Row: {
                    id: string
                    profile_id: string
                    fb_account_id: string
                    name: string
                    status: number
                    currency: string
                    timezone: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    profile_id: string
                    fb_account_id: string
                    name: string
                    status: number
                    currency: string
                    timezone?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    profile_id?: string
                    fb_account_id?: string
                    name?: string
                    status?: number
                    currency?: string
                    timezone?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "ad_accounts_profile_id_fkey"
                        columns: ["profile_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            creatives: {
                Row: {
                    id: string
                    user_id: string | null
                    name: string
                    type: 'image' | 'video'
                    storage_path: string
                    file_size: number
                    dimensions: Json | null
                    duration: number | null
                    uploaded_by: string
                    fb_hash: string | null
                    fb_video_id: string | null
                    created_at: string
                    project_id: string | null
                    subproject_id: string | null
                    row_number: number
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    name: string
                    type: 'image' | 'video'
                    storage_path: string
                    file_size: number
                    dimensions?: Json | null
                    duration?: number | null
                    uploaded_by: string
                    fb_hash?: string | null
                    fb_video_id?: string | null
                    created_at?: string
                    project_id?: string | null
                    subproject_id?: string | null
                    row_number?: number
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    name?: string
                    type?: 'image' | 'video'
                    storage_path?: string
                    file_size?: number
                    dimensions?: Json | null
                    duration?: number | null
                    uploaded_by?: string
                    fb_hash?: string | null
                    fb_video_id?: string | null
                    created_at?: string
                    project_id?: string | null
                    subproject_id?: string | null
                    row_number?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "creatives_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "creatives_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "creatives_subproject_id_fkey"
                        columns: ["subproject_id"]
                        isOneToOne: false
                        referencedRelation: "subprojects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            subprojects: {
                Row: {
                    id: string
                    project_id: string
                    name: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    name: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    name?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "subprojects_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            ai_copywriting_sessions: {
                Row: {
                    id: string
                    user_id: string | null
                    project_id: string | null
                    subproject_id: string | null
                    ai_model: string
                    product_description: string | null
                    persona_input: string | null
                    swipe_files: string | null
                    product_custom_prompt: string | null
                    personas: Json | null
                    personas_custom_prompt: string | null
                    angles: Json | null
                    angles_custom_prompt: string | null
                    ad_copies: Json | null
                    ad_copies_count: number
                    ad_copies_custom_prompt: string | null
                    exported: boolean
                    exported_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    project_id?: string | null
                    subproject_id?: string | null
                    ai_model?: string
                    product_description?: string | null
                    persona_input?: string | null
                    swipe_files?: string | null
                    product_custom_prompt?: string | null
                    personas?: Json | null
                    personas_custom_prompt?: string | null
                    angles?: Json | null
                    angles_custom_prompt?: string | null
                    ad_copies?: Json | null
                    ad_copies_count?: number
                    ad_copies_custom_prompt?: string | null
                    exported?: boolean
                    exported_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    project_id?: string | null
                    subproject_id?: string | null
                    ai_model?: string
                    product_description?: string | null
                    persona_input?: string | null
                    swipe_files?: string | null
                    product_custom_prompt?: string | null
                    personas?: Json | null
                    personas_custom_prompt?: string | null
                    angles?: Json | null
                    angles_custom_prompt?: string | null
                    ad_copies?: Json | null
                    ad_copies_count?: number
                    ad_copies_custom_prompt?: string | null
                    exported?: boolean
                    exported_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "ai_copywriting_sessions_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "ai_copywriting_sessions_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "ai_copywriting_sessions_subproject_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "subprojects"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type AdAccount = Database['public']['Tables']['ad_accounts']['Row'];
export type Creative = Database['public']['Tables']['creatives']['Row'];
export type Subproject = Database['public']['Tables']['subprojects']['Row'];
export type AICopywritingSession = Database['public']['Tables']['ai_copywriting_sessions']['Row'];
export type AdCopy = Database['public']['Tables']['ad_copies']['Row'];
