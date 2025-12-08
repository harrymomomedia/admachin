drop extension if exists "pg_net";


  create table "public"."ad_accounts" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "profile_id" uuid not null,
    "fb_account_id" text not null,
    "name" text not null,
    "status" integer not null default 1,
    "currency" text not null default 'USD'::text,
    "timezone" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."ad_copies" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "text" text not null,
    "type" text not null,
    "project" text,
    "platform" text,
    "name" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "project_id" uuid
      );


alter table "public"."ad_copies" enable row level security;


  create table "public"."creatives" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid,
    "name" text not null,
    "type" text not null,
    "storage_path" text not null,
    "file_size" integer not null,
    "dimensions" jsonb,
    "duration" integer,
    "uploaded_by" text not null,
    "fb_hash" text,
    "created_at" timestamp with time zone default now(),
    "fb_video_id" text
      );



  create table "public"."profiles" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid,
    "fb_user_id" text not null,
    "fb_name" text not null,
    "fb_email" text,
    "access_token" text not null,
    "token_expiry" timestamp with time zone not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."project_user_assignments" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid,
    "user_id" uuid,
    "assigned_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."project_user_assignments" enable row level security;


  create table "public"."projects" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "created_by" text
      );


alter table "public"."projects" enable row level security;


  create table "public"."users" (
    "id" uuid not null default gen_random_uuid(),
    "first_name" text not null,
    "last_name" text not null,
    "email" text not null,
    "password" text not null,
    "role" text default 'member'::text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."users" enable row level security;

CREATE UNIQUE INDEX ad_accounts_pkey ON public.ad_accounts USING btree (id);

CREATE UNIQUE INDEX ad_accounts_profile_id_fb_account_id_key ON public.ad_accounts USING btree (profile_id, fb_account_id);

CREATE UNIQUE INDEX ad_copies_pkey ON public.ad_copies USING btree (id);

CREATE UNIQUE INDEX creatives_pkey ON public.creatives USING btree (id);

CREATE INDEX idx_ad_copies_project_id ON public.ad_copies USING btree (project_id);

CREATE UNIQUE INDEX profiles_fb_user_id_key ON public.profiles USING btree (fb_user_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX project_user_assignments_pkey ON public.project_user_assignments USING btree (id);

CREATE UNIQUE INDEX project_user_assignments_project_id_user_id_key ON public.project_user_assignments USING btree (project_id, user_id);

CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

alter table "public"."ad_accounts" add constraint "ad_accounts_pkey" PRIMARY KEY using index "ad_accounts_pkey";

alter table "public"."ad_copies" add constraint "ad_copies_pkey" PRIMARY KEY using index "ad_copies_pkey";

alter table "public"."creatives" add constraint "creatives_pkey" PRIMARY KEY using index "creatives_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."project_user_assignments" add constraint "project_user_assignments_pkey" PRIMARY KEY using index "project_user_assignments_pkey";

alter table "public"."projects" add constraint "projects_pkey" PRIMARY KEY using index "projects_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."ad_accounts" add constraint "ad_accounts_profile_id_fb_account_id_key" UNIQUE using index "ad_accounts_profile_id_fb_account_id_key";

alter table "public"."ad_accounts" add constraint "ad_accounts_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."ad_accounts" validate constraint "ad_accounts_profile_id_fkey";

alter table "public"."ad_copies" add constraint "ad_copies_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) not valid;

alter table "public"."ad_copies" validate constraint "ad_copies_project_id_fkey";

alter table "public"."ad_copies" add constraint "ad_copies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."ad_copies" validate constraint "ad_copies_user_id_fkey";

alter table "public"."creatives" add constraint "creatives_type_check" CHECK ((type = ANY (ARRAY['image'::text, 'video'::text]))) not valid;

alter table "public"."creatives" validate constraint "creatives_type_check";

alter table "public"."creatives" add constraint "creatives_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."creatives" validate constraint "creatives_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_fb_user_id_key" UNIQUE using index "profiles_fb_user_id_key";

alter table "public"."profiles" add constraint "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_user_id_fkey";

alter table "public"."project_user_assignments" add constraint "project_user_assignments_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_user_assignments" validate constraint "project_user_assignments_project_id_fkey";

alter table "public"."project_user_assignments" add constraint "project_user_assignments_project_id_user_id_key" UNIQUE using index "project_user_assignments_project_id_user_id_key";

alter table "public"."project_user_assignments" add constraint "project_user_assignments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."project_user_assignments" validate constraint "project_user_assignments_user_id_fkey";

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

grant delete on table "public"."ad_accounts" to "anon";

grant insert on table "public"."ad_accounts" to "anon";

grant references on table "public"."ad_accounts" to "anon";

grant select on table "public"."ad_accounts" to "anon";

grant trigger on table "public"."ad_accounts" to "anon";

grant truncate on table "public"."ad_accounts" to "anon";

grant update on table "public"."ad_accounts" to "anon";

grant delete on table "public"."ad_accounts" to "authenticated";

grant insert on table "public"."ad_accounts" to "authenticated";

grant references on table "public"."ad_accounts" to "authenticated";

grant select on table "public"."ad_accounts" to "authenticated";

grant trigger on table "public"."ad_accounts" to "authenticated";

grant truncate on table "public"."ad_accounts" to "authenticated";

grant update on table "public"."ad_accounts" to "authenticated";

grant delete on table "public"."ad_accounts" to "service_role";

grant insert on table "public"."ad_accounts" to "service_role";

grant references on table "public"."ad_accounts" to "service_role";

grant select on table "public"."ad_accounts" to "service_role";

grant trigger on table "public"."ad_accounts" to "service_role";

grant truncate on table "public"."ad_accounts" to "service_role";

grant update on table "public"."ad_accounts" to "service_role";

grant delete on table "public"."ad_copies" to "anon";

grant insert on table "public"."ad_copies" to "anon";

grant references on table "public"."ad_copies" to "anon";

grant select on table "public"."ad_copies" to "anon";

grant trigger on table "public"."ad_copies" to "anon";

grant truncate on table "public"."ad_copies" to "anon";

grant update on table "public"."ad_copies" to "anon";

grant delete on table "public"."ad_copies" to "authenticated";

grant insert on table "public"."ad_copies" to "authenticated";

grant references on table "public"."ad_copies" to "authenticated";

grant select on table "public"."ad_copies" to "authenticated";

grant trigger on table "public"."ad_copies" to "authenticated";

grant truncate on table "public"."ad_copies" to "authenticated";

grant update on table "public"."ad_copies" to "authenticated";

grant delete on table "public"."ad_copies" to "service_role";

grant insert on table "public"."ad_copies" to "service_role";

grant references on table "public"."ad_copies" to "service_role";

grant select on table "public"."ad_copies" to "service_role";

grant trigger on table "public"."ad_copies" to "service_role";

grant truncate on table "public"."ad_copies" to "service_role";

grant update on table "public"."ad_copies" to "service_role";

grant delete on table "public"."creatives" to "anon";

grant insert on table "public"."creatives" to "anon";

grant references on table "public"."creatives" to "anon";

grant select on table "public"."creatives" to "anon";

grant trigger on table "public"."creatives" to "anon";

grant truncate on table "public"."creatives" to "anon";

grant update on table "public"."creatives" to "anon";

grant delete on table "public"."creatives" to "authenticated";

grant insert on table "public"."creatives" to "authenticated";

grant references on table "public"."creatives" to "authenticated";

grant select on table "public"."creatives" to "authenticated";

grant trigger on table "public"."creatives" to "authenticated";

grant truncate on table "public"."creatives" to "authenticated";

grant update on table "public"."creatives" to "authenticated";

grant delete on table "public"."creatives" to "service_role";

grant insert on table "public"."creatives" to "service_role";

grant references on table "public"."creatives" to "service_role";

grant select on table "public"."creatives" to "service_role";

grant trigger on table "public"."creatives" to "service_role";

grant truncate on table "public"."creatives" to "service_role";

grant update on table "public"."creatives" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."project_user_assignments" to "anon";

grant insert on table "public"."project_user_assignments" to "anon";

grant references on table "public"."project_user_assignments" to "anon";

grant select on table "public"."project_user_assignments" to "anon";

grant trigger on table "public"."project_user_assignments" to "anon";

grant truncate on table "public"."project_user_assignments" to "anon";

grant update on table "public"."project_user_assignments" to "anon";

grant delete on table "public"."project_user_assignments" to "authenticated";

grant insert on table "public"."project_user_assignments" to "authenticated";

grant references on table "public"."project_user_assignments" to "authenticated";

grant select on table "public"."project_user_assignments" to "authenticated";

grant trigger on table "public"."project_user_assignments" to "authenticated";

grant truncate on table "public"."project_user_assignments" to "authenticated";

grant update on table "public"."project_user_assignments" to "authenticated";

grant delete on table "public"."project_user_assignments" to "service_role";

grant insert on table "public"."project_user_assignments" to "service_role";

grant references on table "public"."project_user_assignments" to "service_role";

grant select on table "public"."project_user_assignments" to "service_role";

grant trigger on table "public"."project_user_assignments" to "service_role";

grant truncate on table "public"."project_user_assignments" to "service_role";

grant update on table "public"."project_user_assignments" to "service_role";

grant delete on table "public"."projects" to "anon";

grant insert on table "public"."projects" to "anon";

grant references on table "public"."projects" to "anon";

grant select on table "public"."projects" to "anon";

grant trigger on table "public"."projects" to "anon";

grant truncate on table "public"."projects" to "anon";

grant update on table "public"."projects" to "anon";

grant delete on table "public"."projects" to "authenticated";

grant insert on table "public"."projects" to "authenticated";

grant references on table "public"."projects" to "authenticated";

grant select on table "public"."projects" to "authenticated";

grant trigger on table "public"."projects" to "authenticated";

grant truncate on table "public"."projects" to "authenticated";

grant update on table "public"."projects" to "authenticated";

grant delete on table "public"."projects" to "service_role";

grant insert on table "public"."projects" to "service_role";

grant references on table "public"."projects" to "service_role";

grant select on table "public"."projects" to "service_role";

grant trigger on table "public"."projects" to "service_role";

grant truncate on table "public"."projects" to "service_role";

grant update on table "public"."projects" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


  create policy "Enable delete for all users"
  on "public"."ad_copies"
  as permissive
  for delete
  to public
using (true);



  create policy "Enable insert for all users"
  on "public"."ad_copies"
  as permissive
  for insert
  to public
with check (true);



  create policy "Enable read access for all users"
  on "public"."ad_copies"
  as permissive
  for select
  to public
using (true);



  create policy "Enable update for all users"
  on "public"."ad_copies"
  as permissive
  for update
  to public
using (true);



  create policy "Enable delete for all users"
  on "public"."project_user_assignments"
  as permissive
  for delete
  to public
using (true);



  create policy "Enable insert for all users"
  on "public"."project_user_assignments"
  as permissive
  for insert
  to public
with check (true);



  create policy "Enable read access for all users"
  on "public"."project_user_assignments"
  as permissive
  for select
  to public
using (true);



  create policy "Enable update for all users"
  on "public"."project_user_assignments"
  as permissive
  for update
  to public
using (true);



  create policy "Enable delete for all users"
  on "public"."projects"
  as permissive
  for delete
  to public
using (true);



  create policy "Enable insert for all users"
  on "public"."projects"
  as permissive
  for insert
  to public
with check (true);



  create policy "Enable read access for all users"
  on "public"."projects"
  as permissive
  for select
  to public
using (true);



  create policy "Enable update for all users"
  on "public"."projects"
  as permissive
  for update
  to public
using (true);



  create policy "Enable delete for all users"
  on "public"."users"
  as permissive
  for delete
  to public
using (true);



  create policy "Enable insert for all users"
  on "public"."users"
  as permissive
  for insert
  to public
with check (true);



  create policy "Enable read access for all users"
  on "public"."users"
  as permissive
  for select
  to public
using (true);



  create policy "Enable update for all users"
  on "public"."users"
  as permissive
  for update
  to public
using (true);



  create policy "allow_all_uploads 9wc4o4_0"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (true);



  create policy "allow_all_uploads 9wc4o4_1"
  on "storage"."objects"
  as permissive
  for select
  to public
using (true);



