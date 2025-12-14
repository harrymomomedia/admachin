-- Fix RLS policies to allow public access (team app without auth)
-- Drop existing policies
DROP POLICY IF EXISTS "Team members can read all presets" ON ai_copywriting_presets;
DROP POLICY IF EXISTS "Team members can create presets" ON ai_copywriting_presets;
DROP POLICY IF EXISTS "Team members can update presets" ON ai_copywriting_presets;
DROP POLICY IF EXISTS "Team members can delete presets" ON ai_copywriting_presets;

-- Create new policies that allow both authenticated and anon roles
CREATE POLICY "Public read access" ON ai_copywriting_presets
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public insert access" ON ai_copywriting_presets
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Public update access" ON ai_copywriting_presets
    FOR UPDATE
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public delete access" ON ai_copywriting_presets
    FOR DELETE
    TO anon, authenticated
    USING (true);
