-- ========================================
-- Fix ad_copies.user_id foreign key
-- Points to public.users instead of auth.users
-- Run this in Supabase SQL Editor
-- ========================================

-- Drop the existing constraint (might reference auth.users)
ALTER TABLE public.ad_copies DROP CONSTRAINT IF EXISTS ad_copies_user_id_fkey;

-- Add new constraint pointing to our custom public.users table
ALTER TABLE public.ad_copies 
ADD CONSTRAINT ad_copies_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Verify the constraint was added
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'ad_copies'
    AND kcu.column_name = 'user_id';
