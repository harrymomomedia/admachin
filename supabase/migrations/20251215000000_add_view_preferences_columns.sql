-- Add filter_config and wrap_config columns to user_view_preferences
ALTER TABLE user_view_preferences
ADD COLUMN IF NOT EXISTS filter_config JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS wrap_config JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS group_config JSONB DEFAULT '[]';

-- Add filter_config and wrap_config columns to shared_view_preferences
ALTER TABLE shared_view_preferences
ADD COLUMN IF NOT EXISTS filter_config JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS wrap_config JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS group_config JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS row_order JSONB DEFAULT '[]';

-- Add comments for documentation
COMMENT ON COLUMN user_view_preferences.filter_config IS 'Array of filter rules for the view';
COMMENT ON COLUMN user_view_preferences.wrap_config IS 'Array of column wrap rules for the view';
COMMENT ON COLUMN user_view_preferences.group_config IS 'Array of group rules for the view (supports multiple grouping)';

COMMENT ON COLUMN shared_view_preferences.filter_config IS 'Array of filter rules shared for everyone';
COMMENT ON COLUMN shared_view_preferences.wrap_config IS 'Array of column wrap rules shared for everyone';
COMMENT ON COLUMN shared_view_preferences.group_config IS 'Array of group rules shared for everyone';
COMMENT ON COLUMN shared_view_preferences.row_order IS 'Array of row IDs representing shared ordering for the view';
