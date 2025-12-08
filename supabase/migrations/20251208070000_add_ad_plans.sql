-- Create AD PLANS table
create table "public"."ad_plans" (
    "id" uuid not null default gen_random_uuid() primary key,
    "ad_number" serial not null,
    "project_id" uuid,
    "user_id" uuid,
    "creative_id" uuid,
    "ad_type" text,
    "status" text default 'Draft',
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
);

-- Foreign Keys
alter table "public"."ad_plans" add constraint "ad_plans_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
alter table "public"."ad_plans" add constraint "ad_plans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL; -- Linking to public.users (Launchers)
alter table "public"."ad_plans" add constraint "ad_plans_creative_id_fkey" FOREIGN KEY (creative_id) REFERENCES public.creatives(id) ON DELETE SET NULL;

-- Enable RLS
alter table "public"."ad_plans" enable row level security;

-- Policies (Permissive for now as per other tables)
create policy "Enable read access for all users" on "public"."ad_plans" as permissive for select to public using (true);
create policy "Enable insert for all users" on "public"."ad_plans" as permissive for insert to public with check (true);
create policy "Enable update for all users" on "public"."ad_plans" as permissive for update to public using (true);
create policy "Enable delete for all users" on "public"."ad_plans" as permissive for delete to public using (true);

-- Grands
grant select, insert, update, delete on table "public"."ad_plans" to anon, authenticated, service_role;
