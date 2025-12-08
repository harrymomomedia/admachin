-- Update AD PLANS table schema
alter table "public"."ad_plans"
add column "subproject" text,
add column "plan_type" text,
add column "creative_type" text,
add column "priority" integer,
add column "hj_rating" numeric,
add column "spy_url" text,
add column "title" text,
add column "reference_creative_id" uuid references public.creatives(id) on delete set null;

-- Rename ad_type to plan_type if we want to migrate data, but easier to just drop old if empty
-- or simpler: drop ad_type and use plan_type
alter table "public"."ad_plans" drop column "ad_type";
