-- Supabase Database Schema for AdMachin
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (Facebook connected profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    fb_user_id TEXT NOT NULL UNIQUE,
    fb_name TEXT NOT NULL,
    fb_email TEXT,
    access_token TEXT NOT NULL,
    token_expiry TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_fb_user_id ON public.profiles(fb_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- ============================================
-- AD ACCOUNTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ad_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    fb_account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'USD',
    timezone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, fb_account_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ad_accounts_profile_id ON public.ad_accounts(profile_id);

-- ============================================
-- CREATIVES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.creatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    storage_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    dimensions JSONB,
    duration INTEGER, -- for videos, in seconds
    uploaded_by TEXT NOT NULL,
    fb_hash TEXT, -- Facebook image/video hash for ad creation
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_creatives_user_id ON public.creatives(user_id);
CREATE INDEX IF NOT EXISTS idx_creatives_type ON public.creatives(type);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles (for now, no auth required)
CREATE POLICY "Allow public read access to profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert to profiles" ON public.profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to profiles" ON public.profiles
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete from profiles" ON public.profiles
    FOR DELETE USING (true);

-- Ad Accounts: Public access for now
CREATE POLICY "Allow public read access to ad_accounts" ON public.ad_accounts
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert to ad_accounts" ON public.ad_accounts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to ad_accounts" ON public.ad_accounts
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete from ad_accounts" ON public.ad_accounts
    FOR DELETE USING (true);

-- Creatives: Public access for now
CREATE POLICY "Allow public read access to creatives" ON public.creatives
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert to creatives" ON public.creatives
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to creatives" ON public.creatives
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete from creatives" ON public.creatives
    FOR DELETE USING (true);

-- ============================================
-- STORAGE BUCKET FOR CREATIVES
-- ============================================
-- Note: Run this in Supabase Dashboard > Storage > Create bucket
-- Bucket name: creatives
-- Public bucket: Yes (for now, to allow direct URL access)
