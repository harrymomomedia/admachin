-- Create table for storing saved ads from Facebook Ad Library
create table if not exists public.fb_ads_library (
    id uuid primary key default extensions.uuid_generate_v4(),
    
    -- FB Ad Library Data
    fb_ad_id text unique not null,
    page_name text,
    page_id text,
    
    -- Creative Content
    ad_snapshot_url text,
    ad_creative_body text,
    ad_creative_link_title text,
    ad_creative_link_description text,
    ad_creative_link_caption text,
    
    -- Media (stored locally in Supabase storage)
    images jsonb, -- Array of {original_url, storage_path, public_url}
    videos jsonb, -- Array of {original_url, storage_path, public_url, thumbnail}
    
    -- Metadata
    ad_creation_time timestamp,
    ad_delivery_start_time timestamp,
    ad_delivery_stop_time timestamp,
    
    -- Spend & Reach (if available)
    spend jsonb,
    impressions jsonb,
    
    -- Demographics & Targeting
    demographic_distribution jsonb,
    region_distribution jsonb,
    publisher_platforms text[],
    
    -- Search Context
    search_terms text,
    search_country text,
    
    -- User Management
    saved_by uuid references auth.users(id) on delete cascade,
    saved_at timestamp default now(),
    notes text,
    tags text[],
    
    -- Timestamps
    created_at timestamp default now(),
    updated_at timestamp default now()
);

-- Indexes
create index fb_ads_library_fb_ad_id_idx on public.fb_ads_library(fb_ad_id);
create index fb_ads_library_page_name_idx on public.fb_ads_library(page_name);
create index fb_ads_library_saved_by_idx on public.fb_ads_library(saved_by);
create index fb_ads_library_created_at_idx on public.fb_ads_library(created_at desc);
create index fb_ads_library_tags_idx on public.fb_ads_library using gin(tags);

-- RLS Policies
alter table public.fb_ads_library enable row level security;

create policy "Users can view all saved ads"
    on public.fb_ads_library for select
    using (true);

create policy "Users can save ads"
    on public.fb_ads_library for insert
    with check (auth.uid() = saved_by);

create policy "Users can update their saved ads"
    on public.fb_ads_library for update
    using (auth.uid() = saved_by);

create policy "Users can delete their saved ads"
    on public.fb_ads_library for delete
    using (auth.uid() = saved_by);

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger set_updated_at
    before update on public.fb_ads_library
    for each row
    execute function public.handle_updated_at();
