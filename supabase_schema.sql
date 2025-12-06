-- Create the ad_copies table
create table if not exists public.ad_copies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  text text not null,
  type text not null, -- 'primary_text', 'headline', 'description'
  project text,
  platform text,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.ad_copies enable row level security;

-- Create Policies
-- 1. Allow everyone to read ad copies (adjust if you want privacy)
create policy "Enable read access for all users"
on public.ad_copies for select
using (true);

-- 2. Allow all users to insert (authenticated or anonymous)
create policy "Enable insert for all users"
on public.ad_copies for insert
with check (true);

-- 3. Allow users to update their own copies (or all if open team)
create policy "Enable update for all users"
on public.ad_copies for update
using (true);

-- 4. Allow users to delete their own copies (or all if open team)
create policy "Enable delete for all users"
on public.ad_copies for delete
using (true);
