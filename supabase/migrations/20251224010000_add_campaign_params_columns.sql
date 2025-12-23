-- Add new columns to campaign_parameters table
-- These columns help capture key marketing/legal context for ad campaigns

-- Key Qualifying Criteria: What makes someone eligible (e.g., legal criteria for settlements)
ALTER TABLE campaign_parameters ADD COLUMN IF NOT EXISTS key_qualifying_criteria TEXT;

-- Offer Flow: What happens when they click - the conversion process (fill form, get call, etc.)
ALTER TABLE campaign_parameters ADD COLUMN IF NOT EXISTS offer_flow TEXT;

-- Proof Points: Concrete facts, settlement amounts, statistics that build credibility
ALTER TABLE campaign_parameters ADD COLUMN IF NOT EXISTS proof_points TEXT;

-- Primary Objections/Barriers: Common objections and friction points to address
ALTER TABLE campaign_parameters ADD COLUMN IF NOT EXISTS primary_objections TEXT;
