-- Add row_number SERIAL column to ad_copies for display ID
-- Similar to ad_plans.ad_number
ALTER TABLE public.ad_copies 
ADD COLUMN IF NOT EXISTS row_number SERIAL;
