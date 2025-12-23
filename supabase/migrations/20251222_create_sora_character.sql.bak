-- Sora Character table for consistent character generation
-- Run this migration manually in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sora_character (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    row_number SERIAL,
    character_name TEXT,
    sora_character_id TEXT UNIQUE,
    source_video_url TEXT,
    video_output_id UUID REFERENCES video_output(id) ON DELETE SET NULL,
    avatar_url TEXT,
    description TEXT,
    restrictions TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    task_error TEXT,
    logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sora_character_status ON sora_character(status);
CREATE INDEX IF NOT EXISTS idx_sora_character_video_output ON sora_character(video_output_id);

-- Enable RLS
ALTER TABLE sora_character ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "sora_character_all_auth" ON sora_character FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sora_character_read_anon" ON sora_character FOR SELECT TO anon USING (true);
