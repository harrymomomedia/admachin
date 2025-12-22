-- AI Copy Feature Tables
-- Migration: 20251222120000_create_ai_copy_tables.sql

-- Campaign Parameters (base table)
CREATE TABLE IF NOT EXISTS campaign_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  persona_input TEXT,
  swipe_files TEXT,
  custom_prompt TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creative Concepts (base table, pre-seeded)
CREATE TABLE IF NOT EXISTS creative_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  example TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personas (depends on campaign)
CREATE TABLE IF NOT EXISTS ai_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_parameter_id UUID REFERENCES campaign_parameters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Angles (depends on campaign + persona + creative concept)
CREATE TABLE IF NOT EXISTS ai_angles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_parameter_id UUID REFERENCES campaign_parameters(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES ai_personas(id) ON DELETE SET NULL,
  creative_concept_id UUID REFERENCES creative_concepts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Ads (depends on all)
CREATE TABLE IF NOT EXISTS ai_generated_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_parameter_id UUID REFERENCES campaign_parameters(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES ai_personas(id) ON DELETE SET NULL,
  angle_id UUID REFERENCES ai_angles(id) ON DELETE SET NULL,
  creative_concept_id UUID REFERENCES creative_concepts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  ad_type TEXT NOT NULL DEFAULT 'FB Ad Text',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_ai_personas_campaign ON ai_personas(campaign_parameter_id);
CREATE INDEX IF NOT EXISTS idx_ai_angles_campaign ON ai_angles(campaign_parameter_id);
CREATE INDEX IF NOT EXISTS idx_ai_angles_persona ON ai_angles(persona_id);
CREATE INDEX IF NOT EXISTS idx_ai_angles_concept ON ai_angles(creative_concept_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_ads_campaign ON ai_generated_ads(campaign_parameter_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_ads_angle ON ai_generated_ads(angle_id);

-- Seed Creative Concepts
INSERT INTO creative_concepts (name, description, example) VALUES
  ('Testimonial', 'First-person account from a customer or user', 'I never thought I''d find a solution until I tried...'),
  ('Listicle', 'Numbered list of benefits, reasons, or tips', '5 Reasons Why Smart Homeowners Are Switching...'),
  ('Problem-Solution', 'Present pain point, then offer the solution', 'Tired of [problem]? Here''s how to fix it...'),
  ('Exposé', 'Reveal hidden truth or industry secret', 'What [industry] doesn''t want you to know...'),
  ('Before/After', 'Show transformation from problem to result', 'From struggling to thriving: How [product] changed everything'),
  ('How-To', 'Step-by-step guide or tutorial approach', 'How to [achieve result] in 3 simple steps'),
  ('Comparison', 'Compare against alternatives or competitors', 'Why [product] beats [alternative] every time'),
  ('Story/Narrative', 'Tell a relatable story that leads to product', 'When Sarah first discovered [product], she was skeptical...'),
  ('Question Hook', 'Open with provocative question', 'What if you could [desired outcome] without [pain point]?'),
  ('Statistic Lead', 'Lead with surprising data or research', '87% of [audience] don''t know this simple trick...')
ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE campaign_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_angles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_ads ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (team-level access)
CREATE POLICY "Allow all for authenticated users" ON campaign_parameters FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON creative_concepts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON ai_personas FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON ai_angles FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON ai_generated_ads FOR ALL USING (true);
