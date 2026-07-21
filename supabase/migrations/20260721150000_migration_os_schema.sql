-- Migration OS Architecture Evolution

CREATE TYPE migration_mode AS ENUM ('merge', 'replace', 'clean', 'dry_run', 'compare_only');

CREATE TABLE IF NOT EXISTS migration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
    target_store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    mode migration_mode NOT NULL DEFAULT 'merge',
    progress JSONB NOT NULL DEFAULT '{}',
    report JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_preparations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_job_id UUID REFERENCES migration_jobs(id) ON DELETE CASCADE,
    target_store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    health_score INTEGER NOT NULL,
    objects_detected JSONB NOT NULL DEFAULT '{}',
    objects_to_delete JSONB NOT NULL DEFAULT '{}',
    objects_to_merge JSONB NOT NULL DEFAULT '{}',
    protected_objects JSONB NOT NULL DEFAULT '{}',
    shopify_limitations JSONB NOT NULL DEFAULT '[]',
    estimated_duration_seconds INTEGER,
    risk_score INTEGER,
    warnings JSONB NOT NULL DEFAULT '[]',
    merchant_approval_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conflict_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_job_id UUID REFERENCES migration_jobs(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    source_id TEXT,
    target_id TEXT,
    conflict_type TEXT NOT NULL, -- 'Already Exists', 'Permission Limitation', 'Dependency Missing', etc.
    recommendation TEXT NOT NULL,
    fatal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deep_compare_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_job_id UUID REFERENCES migration_jobs(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    match_percentage NUMERIC(5,2),
    migration_percentage NUMERIC(5,2),
    integrity_percentage NUMERIC(5,2),
    store_a_snapshot JSONB,
    store_b_snapshot JSONB,
    differences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE deep_compare_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for service role" ON migration_jobs USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON store_preparations USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON conflict_intelligence USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON deep_compare_results USING (true) WITH CHECK (true);

-- User Policies
CREATE POLICY "Users access own migration jobs" ON migration_jobs FOR ALL 
  USING (target_store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Users access own preparations" ON store_preparations FOR ALL 
  USING (target_store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Users access own conflicts" ON conflict_intelligence FOR ALL 
  USING (migration_job_id IN (
    SELECT id FROM migration_jobs WHERE target_store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users access own deep compare" ON deep_compare_results FOR ALL 
  USING (migration_job_id IN (
    SELECT id FROM migration_jobs WHERE target_store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  ));

