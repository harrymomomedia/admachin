-- Add prompts column to AI tables for storing generation prompts
-- Migration: 20251222130000_add_prompts_column.sql

-- Add prompts column to ai_personas
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS prompts JSONB;
COMMENT ON COLUMN ai_personas.prompts IS 'Stores the system and user prompts used to generate this persona';

-- Add prompts column to ai_angles
ALTER TABLE ai_angles ADD COLUMN IF NOT EXISTS prompts JSONB;
COMMENT ON COLUMN ai_angles.prompts IS 'Stores the system and user prompts used to generate this angle';

-- Add prompts column to ai_generated_ads
ALTER TABLE ai_generated_ads ADD COLUMN IF NOT EXISTS prompts JSONB;
COMMENT ON COLUMN ai_generated_ads.prompts IS 'Stores the system and user prompts used to generate this ad';
