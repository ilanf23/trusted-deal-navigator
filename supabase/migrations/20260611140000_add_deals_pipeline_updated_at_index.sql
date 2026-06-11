-- Perf: the pipeline pages (Potential / Underwriting / Lender Management) all
-- load deals with `WHERE pipeline = $1 ORDER BY updated_at DESC`
-- (src/hooks/usePipelineLeads.ts). The `pipeline` column was added in
-- 20260528220100_consolidate_deal_tables.sql without an index, so every page
-- load seq-scans the whole deals table and re-sorts it.
--
-- Composite index serves both the filter and the sort in one pass.
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_updated_at
  ON public.deals (pipeline, updated_at DESC);
