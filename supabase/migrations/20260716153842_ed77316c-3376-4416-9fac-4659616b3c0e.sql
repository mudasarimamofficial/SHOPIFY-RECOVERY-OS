
-- STORES
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_domain text NOT NULL,
  name text,
  plan text,
  country text,
  currency text,
  email text,
  api_version text,
  scopes text[],
  access_token_ciphertext text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, shop_domain)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stores" ON public.stores FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- BACKUPS
CREATE TABLE public.backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label text,
  status text NOT NULL DEFAULT 'pending',
  progress int NOT NULL DEFAULT 0,
  current_stage text,
  recovery_score int,
  resources_total int NOT NULL DEFAULT 0,
  resources_completed int NOT NULL DEFAULT 0,
  errors_count int NOT NULL DEFAULT 0,
  warnings_count int NOT NULL DEFAULT 0,
  size_bytes bigint,
  manifest jsonb,
  package_data jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own backups" ON public.backups FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX backups_store_idx ON public.backups(store_id, created_at DESC);

-- BACKUP RESOURCES
CREATE TABLE public.backup_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id uuid NOT NULL REFERENCES public.backups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  count int NOT NULL DEFAULT 0,
  bytes bigint NOT NULL DEFAULT 0,
  recoverability text NOT NULL DEFAULT 'full',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_resources TO authenticated;
GRANT ALL ON public.backup_resources TO service_role;
ALTER TABLE public.backup_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own backup resources" ON public.backup_resources FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX backup_resources_backup_idx ON public.backup_resources(backup_id);

-- RESTORE JOBS
CREATE TABLE public.restore_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  backup_id uuid NOT NULL REFERENCES public.backups(id) ON DELETE CASCADE,
  target_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  progress int NOT NULL DEFAULT 0,
  plan jsonb,
  report jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restore_jobs TO authenticated;
GRANT ALL ON public.restore_jobs TO service_role;
ALTER TABLE public.restore_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own restore jobs" ON public.restore_jobs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ACTIVITY LOG
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity" ON public.activity_log FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX activity_log_user_idx ON public.activity_log(user_id, created_at DESC);
