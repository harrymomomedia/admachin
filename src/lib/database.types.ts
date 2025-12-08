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
                    platform: string | null
                    name: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    text: string
                    type: string
                    project?: string | null
                    project_id?: string | null
                    platform?: string | null
                    name?: string | null
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
                    platform?: string | null
                    name?: string | null
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
                }
                Relationships: [
                    {
                        foreignKeyName: "creatives_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
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
