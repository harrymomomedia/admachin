-- Create subprojects table
create table if not exists subprojects (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add subproject_id to ad_plans
alter table ad_plans 
add column if not exists subproject_id uuid references subprojects(id) on delete set null;

-- Enable RLS for subprojects (optional, mirroring other tables)
alter table subprojects enable row level security;

create policy "Enable read access for all users"
on subprojects for select
using (true);

create policy "Enable insert for authenticated users only"
on subprojects for insert
with check (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users only"
on subprojects for delete
using (auth.role() = 'authenticated');
