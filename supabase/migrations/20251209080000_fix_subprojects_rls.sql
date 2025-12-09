-- Fix RLS policy for subprojects to allow insert without auth
-- The original policy required auth.role() = 'authenticated' but app uses anon key

-- Drop old restrictive policies
drop policy if exists "Enable insert for authenticated users only" on subprojects;
drop policy if exists "Enable delete for authenticated users only" on subprojects;

-- Create permissive policies (matching projects/users tables pattern)
create policy "Enable insert for all users"
on subprojects for insert
with check (true);

create policy "Enable delete for all users"
on subprojects for delete
using (true);

-- Also add update policy (was missing)
create policy "Enable update for all users"
on subprojects for update
using (true);
