-- Add Store B Companion App and Extended Telemetry Fields
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS partner_app_id text,
ADD COLUMN IF NOT EXISTS client_id text,
ADD COLUMN IF NOT EXISTS webhook_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS installation_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS migration_status text DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS connection_health text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS runtime_telemetry jsonb,
ADD COLUMN IF NOT EXISTS last_verification timestamptz,
ADD COLUMN IF NOT EXISTS recovery_intelligence jsonb,
ADD COLUMN IF NOT EXISTS is_destination boolean DEFAULT false;

-- Add Source and Destination Tracking to Reports and Backups
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS source_app text,
ADD COLUMN IF NOT EXISTS destination_app text,
ADD COLUMN IF NOT EXISTS source_store_id uuid REFERENCES public.stores(id),
ADD COLUMN IF NOT EXISTS destination_store_id uuid REFERENCES public.stores(id),
ADD COLUMN IF NOT EXISTS partner_app_ids text[],
ADD COLUMN IF NOT EXISTS client_ids text[],
ADD COLUMN IF NOT EXISTS authentication_status text,
ADD COLUMN IF NOT EXISTS runtime_verification jsonb,
ADD COLUMN IF NOT EXISTS migration_progress int,
ADD COLUMN IF NOT EXISTS api_health jsonb,
ADD COLUMN IF NOT EXISTS permission_matrix jsonb,
ADD COLUMN IF NOT EXISTS connection_matrix jsonb;
