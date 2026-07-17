-- ENTERPRISE QUEUE ENGINE
-- Provides a robust, PostgreSQL-backed job queue for async processing.

CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE public.jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name text NOT NULL DEFAULT 'default',
    job_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status job_status NOT NULL DEFAULT 'queued',
    priority integer NOT NULL DEFAULT 0,
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    last_error text,
    run_at timestamptz NOT NULL DEFAULT now(),
    locked_at timestamptz,
    locked_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for polling the queue efficiently (fetch highest priority, unlocked, ready jobs)
CREATE INDEX idx_jobs_poll ON public.jobs (queue_name, status, priority DESC, run_at) WHERE status = 'queued';

-- Job Logs for tracing and observability
CREATE TABLE public.job_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    level text NOT NULL DEFAULT 'info',
    message text NOT NULL,
    meta jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_logs_job_id ON public.job_logs(job_id);

-- Secure access (Only service role should process jobs; authenticated users can insert jobs via server functions)
GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.job_logs TO service_role;

-- Allow users to see their own triggered jobs if we link user_id (optional, but for now we keep it server-only)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access jobs" ON public.jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access logs" ON public.job_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
