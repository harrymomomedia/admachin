-- Add project_id to ad_copies table
ALTER TABLE public.ad_copies 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ad_copies_project_id ON public.ad_copies(project_id);
