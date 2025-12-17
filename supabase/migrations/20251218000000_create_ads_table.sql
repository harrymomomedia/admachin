-- Create ads table for complete ad combinations
-- Combines: Creative + Primary Text + Headline + Description
CREATE TABLE IF NOT EXISTS ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    row_number SERIAL,
    creative_id UUID REFERENCES creatives(id) ON DELETE SET NULL,
    traffic TEXT,
    ad_type TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    headline_id UUID REFERENCES ad_copies(id) ON DELETE SET NULL,
    primary_id UUID REFERENCES ad_copies(id) ON DELETE SET NULL,
    description_id UUID REFERENCES ad_copies(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can view all ads" ON ads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert ads" ON ads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update ads" ON ads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete ads" ON ads FOR DELETE TO authenticated USING (true);

-- Create index for common queries
CREATE INDEX idx_ads_project_id ON ads(project_id);
CREATE INDEX idx_ads_user_id ON ads(user_id);
CREATE INDEX idx_ads_creative_id ON ads(creative_id);
CREATE INDEX idx_ads_headline_id ON ads(headline_id);
CREATE INDEX idx_ads_primary_id ON ads(primary_id);
CREATE INDEX idx_ads_description_id ON ads(description_id);
