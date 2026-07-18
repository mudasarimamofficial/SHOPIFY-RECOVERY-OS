-- Covering indexes for unindexed foreign keys (clears advisor 0001_unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS activity_log_store_id_idx        ON public.activity_log (store_id);
CREATE INDEX IF NOT EXISTS backup_resources_user_id_idx     ON public.backup_resources (user_id);
CREATE INDEX IF NOT EXISTS backups_user_id_idx              ON public.backups (user_id);
CREATE INDEX IF NOT EXISTS restore_jobs_backup_id_idx       ON public.restore_jobs (backup_id);
CREATE INDEX IF NOT EXISTS restore_jobs_target_store_id_idx ON public.restore_jobs (target_store_id);
CREATE INDEX IF NOT EXISTS restore_jobs_user_id_idx         ON public.restore_jobs (user_id);

-- Optimize RLS policies: wrap auth.uid() in a scalar subquery so it is evaluated once
-- per statement instead of once per row (clears advisor 0003_auth_rls_initplan).
ALTER POLICY "own activity"          ON public.activity_log
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "own backup resources"  ON public.backup_resources
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "own backups"           ON public.backups
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "own restore jobs"      ON public.restore_jobs
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "own stores"            ON public.stores
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
