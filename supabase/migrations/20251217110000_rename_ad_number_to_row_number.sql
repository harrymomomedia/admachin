-- Rename ad_number to row_number in ad_plans for consistency
-- All tables now use row_number: ad_copies, ad_plans, creatives
ALTER TABLE public.ad_plans
RENAME COLUMN ad_number TO row_number;
