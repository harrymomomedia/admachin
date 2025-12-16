-- Add project_id and subproject_id columns to creatives table
ALTER TABLE creatives
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_creatives_project_id ON creatives(project_id);
CREATE INDEX IF NOT EXISTS idx_creatives_subproject_id ON creatives(subproject_id);
