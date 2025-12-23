-- Add project_id and subproject_id columns to AI tables
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS subproject_id UUID REFERENCES subprojects(id);
ALTER TABLE ai_angles ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE ai_angles ADD COLUMN IF NOT EXISTS subproject_id UUID REFERENCES subprojects(id);
ALTER TABLE ai_generated_ads ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE ai_generated_ads ADD COLUMN IF NOT EXISTS subproject_id UUID REFERENCES subprojects(id);
ALTER TABLE creative_concepts ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE creative_concepts ADD COLUMN IF NOT EXISTS subproject_id UUID REFERENCES subprojects(id);
