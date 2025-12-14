-- Add row_order column to user_view_preferences table
ALTER TABLE user_view_preferences 
ADD COLUMN IF NOT EXISTS row_order JSONB DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN user_view_preferences.row_order IS 'Array of row IDs representing user-specific ordering for the view';
