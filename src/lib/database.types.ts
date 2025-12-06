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
                    created_at?: string
                }
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
    }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type AdAccount = Database['public']['Tables']['ad_accounts']['Row'];
export type Creative = Database['public']['Tables']['creatives']['Row'];
