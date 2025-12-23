-- Add thumbnail_size_config column to user_view_preferences
ALTER TABLE user_view_preferences
ADD COLUMN IF NOT EXISTS thumbnail_size_config JSONB DEFAULT '{}';

-- Add thumbnail_size_config column to shared_view_preferences
ALTER TABLE shared_view_preferences
ADD COLUMN IF NOT EXISTS thumbnail_size_config JSONB DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN user_view_preferences.thumbnail_size_config IS 'Map of column keys to their thumbnail sizes';
COMMENT ON COLUMN shared_view_preferences.thumbnail_size_config IS 'Map of column keys to their thumbnail sizes shared for everyone';
