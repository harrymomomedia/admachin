-- AI Copywriting Sessions table
-- Stores the workflow state for generating ad copies through personas and angles
create table "public"."ai_copywriting_sessions" (
    "id" uuid not null default gen_random_uuid() primary key,
    "user_id" uuid,
    "project_id" uuid,
    "subproject_id" uuid,

    -- AI Model Configuration
    "ai_model" text not null default 'claude', -- 'gpt', 'gemini', 'claude'

    -- Step 1: Product Info
    "product_description" text,
    "persona_input" text, -- Optional user-provided personas
    "swipe_files" text, -- Headlines/swipe file content
    "product_custom_prompt" text, -- User guardrails for product step

    -- Step 2: Generated Personas (JSON array)
    "personas" jsonb, -- [{ id, name, age, description, selected: boolean }, ...]
    "personas_custom_prompt" text,

    -- Step 3: Generated Angles (JSON array)
    "angles" jsonb, -- [{ id, angle, persona_id, pain_point, why_now, selected: boolean }, ...]
    "angles_custom_prompt" text,

    -- Step 4: Generated Ad Copies (JSON array)
    "ad_copies" jsonb, -- [{ id, copy, angle_ids: [], selected: boolean }, ...]
    "ad_copies_count" integer default 5, -- How many copies to generate
    "ad_copies_custom_prompt" text,

    -- Export Status
    "exported" boolean default false,
    "exported_at" timestamp with time zone,

    -- Timestamps
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
);

-- Foreign Keys
alter table "public"."ai_copywriting_sessions"
    add constraint "ai_copywriting_sessions_user_id_fkey"
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

alter table "public"."ai_copywriting_sessions"
    add constraint "ai_copywriting_sessions_project_id_fkey"
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

alter table "public"."ai_copywriting_sessions"
    add constraint "ai_copywriting_sessions_subproject_id_fkey"
    FOREIGN KEY (subproject_id) REFERENCES public.subprojects(id) ON DELETE SET NULL;

-- Enable RLS
alter table "public"."ai_copywriting_sessions" enable row level security;

-- Policies
create policy "Enable read access for all users"
    on "public"."ai_copywriting_sessions"
    as permissive for select to public using (true);

create policy "Enable insert for all users"
    on "public"."ai_copywriting_sessions"
    as permissive for insert to public with check (true);

create policy "Enable update for all users"
    on "public"."ai_copywriting_sessions"
    as permissive for update to public using (true);

create policy "Enable delete for all users"
    on "public"."ai_copywriting_sessions"
    as permissive for delete to public using (true);

-- Grants
grant select, insert, update, delete on table "public"."ai_copywriting_sessions"
    to anon, authenticated, service_role;

-- Add index for user lookups
create index ai_copywriting_sessions_user_id_idx
    on public.ai_copywriting_sessions(user_id);

-- Add index for project lookups
create index ai_copywriting_sessions_project_id_idx
    on public.ai_copywriting_sessions(project_id);

-- Add subproject_id column to ad_copies table if not exists
-- This allows exported ad copies to reference subprojects
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='ad_copies' AND column_name='subproject_id'
    ) THEN
        ALTER TABLE "public"."ad_copies"
        ADD COLUMN "subproject_id" uuid;

        ALTER TABLE "public"."ad_copies"
        ADD CONSTRAINT "ad_copies_subproject_id_fkey"
        FOREIGN KEY (subproject_id) REFERENCES public.subprojects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add angle and persona tracking to ad_copies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='ad_copies' AND column_name='source_angle'
    ) THEN
        ALTER TABLE "public"."ad_copies"
        ADD COLUMN "source_angle" text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='ad_copies' AND column_name='source_persona'
    ) THEN
        ALTER TABLE "public"."ad_copies"
        ADD COLUMN "source_persona" text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='ad_copies' AND column_name='ai_model'
    ) THEN
        ALTER TABLE "public"."ad_copies"
        ADD COLUMN "ai_model" text;
    END IF;
END $$;
