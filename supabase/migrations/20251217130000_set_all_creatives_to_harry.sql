-- Set all existing creatives to Harry's user
UPDATE creatives c
SET user_id = u.id,
    uploaded_by = TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
FROM users u
WHERE LOWER(u.first_name) = 'harry';
