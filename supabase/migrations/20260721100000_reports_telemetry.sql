-- Create telemetry table
CREATE TABLE IF NOT EXISTS public.telemetry (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id text NOT NULL,
    type text NOT NULL,
    duration_ms integer,
    cpu_usage numeric,
    peak_heap_mb numeric,
    total_resources integer,
    api_cost numeric,
    created_at timestamp with time zone DEFAULT now()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_id text NOT NULL,
    restore_id text NOT NULL,
    store_a text NOT NULL,
    store_b text NOT NULL,
    type text NOT NULL,
    format text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS policies
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON public.reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all authenticated users" ON public.telemetry FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON public.telemetry FOR INSERT WITH CHECK (auth.role() = 'authenticated');
