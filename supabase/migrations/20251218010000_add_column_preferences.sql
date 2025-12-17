-- Add column_widths and column_order to user_view_preferences
ALTER TABLE user_view_preferences
ADD COLUMN IF NOT EXISTS column_widths JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS column_order JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS row_order JSONB DEFAULT '[]';

-- Add column_widths and column_order to shared_view_preferences
ALTER TABLE shared_view_preferences
ADD COLUMN IF NOT EXISTS column_widths JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS column_order JSONB DEFAULT '[]';

-- Add comments for documentation
COMMENT ON COLUMN user_view_preferences.column_widths IS 'Map of column keys to their widths';
COMMENT ON COLUMN user_view_preferences.column_order IS 'Array of column keys in display order';
COMMENT ON COLUMN user_view_preferences.row_order IS 'Array of row IDs representing user-specific ordering';

COMMENT ON COLUMN shared_view_preferences.column_widths IS 'Map of column keys to their widths shared for everyone';
COMMENT ON COLUMN shared_view_preferences.column_order IS 'Array of column keys in display order shared for everyone';
