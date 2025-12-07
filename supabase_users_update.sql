-- ========================================
-- Update Users Table Schema
-- Run this in Supabase SQL Editor
-- ========================================

-- First, drop the old users table if it exists and has no data
-- If you have data, use ALTER TABLE instead

-- Drop the old table (only if no data or you want to start fresh)
DROP TABLE IF EXISTS public.project_user_assignments;
DROP TABLE IF EXISTS public.users;

-- Recreate the users table with all fields
CREATE TABLE public.users (
  id uuid default gen_random_uuid() primary key,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  password text not null,
  role text default 'member', -- 'admin', 'member'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Recreate project_user_assignments table
CREATE TABLE IF NOT EXISTS public.project_user_assignments (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  assigned_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_user_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for users
CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.users FOR DELETE USING (true);

-- Policies for project_user_assignments
CREATE POLICY "Enable read access for all users" ON public.project_user_assignments FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.project_user_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.project_user_assignments FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.project_user_assignments FOR DELETE USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_user_assignments_project ON public.project_user_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_user_assignments_user ON public.project_user_assignments(user_id);
