-- Create ID Mappings table for V2 Migration
CREATE TABLE IF NOT EXISTS public.id_mappings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    migration_id uuid NOT NULL REFERENCES public.restore_jobs(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resource_type text NOT NULL,
    source_id text NOT NULL,
    destination_id text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(migration_id, resource_type, source_id)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_id_mappings_migration ON public.id_mappings(migration_id);
CREATE INDEX IF NOT EXISTS idx_id_mappings_lookup ON public.id_mappings(migration_id, resource_type, source_id);
CREATE INDEX IF NOT EXISTS idx_id_mappings_user ON public.id_mappings(user_id);

-- RLS Policies
ALTER TABLE public.id_mappings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.id_mappings TO service_role;
