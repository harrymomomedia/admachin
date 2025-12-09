-- Create user view preferences table (per-user state)
CREATE TABLE IF NOT EXISTS user_view_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  view_id TEXT NOT NULL,  -- e.g., 'ad_planning', 'ad_copies'
  group_by TEXT,
  sort_config JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, view_id)
);

-- Create shared view preferences table (save for everyone)
CREATE TABLE IF NOT EXISTS shared_view_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id TEXT UNIQUE NOT NULL,
  group_by TEXT,
  sort_config JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_view_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_view_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_view_preferences
CREATE POLICY "Users can read own preferences"
ON user_view_preferences FOR SELECT
USING (true);

CREATE POLICY "Users can insert own preferences"
ON user_view_preferences FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update own preferences"
ON user_view_preferences FOR UPDATE
USING (true);

CREATE POLICY "Users can delete own preferences"
ON user_view_preferences FOR DELETE
USING (true);

-- RLS policies for shared_view_preferences
CREATE POLICY "Anyone can read shared preferences"
ON shared_view_preferences FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert shared preferences"
ON shared_view_preferences FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update shared preferences"
ON shared_view_preferences FOR UPDATE
USING (true);

-- Create indexes
CREATE INDEX idx_user_view_preferences_user_id ON user_view_preferences(user_id);
CREATE INDEX idx_user_view_preferences_view_id ON user_view_preferences(view_id);
CREATE INDEX idx_shared_view_preferences_view_id ON shared_view_preferences(view_id);
