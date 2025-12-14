-- AI Copywriting Presets - Team Level Storage
-- This allows all team members to share presets

CREATE TABLE IF NOT EXISTS ai_copywriting_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    product_description TEXT,
    persona_input TEXT,
    swipe_files TEXT,
    custom_prompt TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
    ai_model VARCHAR(50) DEFAULT 'claude-sonnet',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_copywriting_presets ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read presets (team-level access)
CREATE POLICY "Team members can read all presets" ON ai_copywriting_presets
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow all authenticated users to create presets
CREATE POLICY "Team members can create presets" ON ai_copywriting_presets
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow all authenticated users to update presets (team-level)
CREATE POLICY "Team members can update presets" ON ai_copywriting_presets
    FOR UPDATE
    TO authenticated
    USING (true);

-- Allow all authenticated users to delete presets (team-level)
CREATE POLICY "Team members can delete presets" ON ai_copywriting_presets
    FOR DELETE
    TO authenticated
    USING (true);

-- Index for faster lookups
CREATE INDEX idx_ai_copywriting_presets_name ON ai_copywriting_presets(name);
CREATE INDEX idx_ai_copywriting_presets_project ON ai_copywriting_presets(project_id);
