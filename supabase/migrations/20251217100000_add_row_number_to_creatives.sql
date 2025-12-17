-- Add row_number SERIAL column to creatives for display ID
-- Similar to ad_copies.row_number and ad_plans.ad_number
ALTER TABLE public.creatives
ADD COLUMN IF NOT EXISTS row_number SERIAL;
