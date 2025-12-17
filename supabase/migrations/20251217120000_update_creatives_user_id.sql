-- Update existing creatives to set user_id based on uploaded_by name
-- First, we need to change the foreign key to reference public.users instead of auth.users

-- Drop the existing foreign key constraint (references auth.users)
ALTER TABLE public.creatives DROP CONSTRAINT IF EXISTS creatives_user_id_fkey;

-- Clear any existing invalid user_ids
UPDATE creatives SET user_id = NULL WHERE user_id IS NOT NULL;

-- Add new foreign key constraint referencing public.users
ALTER TABLE public.creatives
ADD CONSTRAINT creatives_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Update creatives where uploaded_by matches a user's name
UPDATE creatives c
SET user_id = u.id
FROM users u
WHERE c.user_id IS NULL
  AND (
    -- Match full name (first_name + space + last_name)
    LOWER(TRIM(c.uploaded_by)) = LOWER(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')))
    -- Or match just first name (for cases like 'Harry')
    OR LOWER(TRIM(c.uploaded_by)) = LOWER(TRIM(u.first_name))
    -- Or match email
    OR LOWER(TRIM(c.uploaded_by)) = LOWER(TRIM(u.email))
  );

-- Log how many were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM creatives WHERE user_id IS NOT NULL;
  RAISE NOTICE 'Creatives with user_id populated: %', updated_count;
END $$;
