-- ========================================
-- Projects and Users Schema Migration
-- Run this in Supabase SQL Editor
-- ========================================

-- 1. Create the projects table
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text -- email or user identifier
);

-- 2. Create the users table (project assignments)
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  name text,
  role text default 'member', -- 'admin', 'member'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create project_user_assignments (many-to-many relationship)
create table if not exists public.project_user_assignments (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  assigned_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, user_id)
);

-- Enable Row Level Security
alter table public.projects enable row level security;
alter table public.users enable row level security;
alter table public.project_user_assignments enable row level security;

-- Policies for projects
create policy "Enable read access for all users" on public.projects for select using (true);
create policy "Enable insert for all users" on public.projects for insert with check (true);
create policy "Enable update for all users" on public.projects for update using (true);
create policy "Enable delete for all users" on public.projects for delete using (true);

-- Policies for users
create policy "Enable read access for all users" on public.users for select using (true);
create policy "Enable insert for all users" on public.users for insert with check (true);
create policy "Enable update for all users" on public.users for update using (true);
create policy "Enable delete for all users" on public.users for delete using (true);

-- Policies for project_user_assignments
create policy "Enable read access for all users" on public.project_user_assignments for select using (true);
create policy "Enable insert for all users" on public.project_user_assignments for insert with check (true);
create policy "Enable update for all users" on public.project_user_assignments for update using (true);
create policy "Enable delete for all users" on public.project_user_assignments for delete using (true);

-- Create indexes for better query performance
create index if not exists idx_project_user_assignments_project on public.project_user_assignments(project_id);
create index if not exists idx_project_user_assignments_user on public.project_user_assignments(user_id);
