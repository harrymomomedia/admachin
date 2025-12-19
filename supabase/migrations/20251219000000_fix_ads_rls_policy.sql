-- Fix RLS policies for ads table to allow both authenticated and anon users
-- This is needed because development mode uses mock users without actual auth sessions

-- Drop ALL existing policies (including any variants)
DROP POLICY IF EXISTS "Users can view all ads" ON ads;
DROP POLICY IF EXISTS "Users can insert ads" ON ads;
DROP POLICY IF EXISTS "Users can update ads" ON ads;
DROP POLICY IF EXISTS "Users can delete ads" ON ads;
DROP POLICY IF EXISTS "Anyone can view ads" ON ads;
DROP POLICY IF EXISTS "Anyone can insert ads" ON ads;
DROP POLICY IF EXISTS "Anyone can update ads" ON ads;
DROP POLICY IF EXISTS "Anyone can delete ads" ON ads;

-- Create new policies that allow both authenticated and anon users
CREATE POLICY "ads_select_policy" ON ads FOR SELECT USING (true);
CREATE POLICY "ads_insert_policy" ON ads FOR INSERT WITH CHECK (true);
CREATE POLICY "ads_update_policy" ON ads FOR UPDATE USING (true);
CREATE POLICY "ads_delete_policy" ON ads FOR DELETE USING (true);
