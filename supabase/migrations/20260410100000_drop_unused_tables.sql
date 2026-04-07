-- Phase: Drop unused empty tables (0 rows, 0 code references)
-- Verified against production on 2026-04-06

-- Invoice line items (invoice UI only uses invoices table, not items)
DROP TABLE IF EXISTS public.invoice_items CASCADE;

-- Marketing stats (0 rows, no code refs)
DROP TABLE IF EXISTS public.marketing_stats CASCADE;

-- Newsletter subscribers (newsletter pulls from leads table instead)
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;

-- Custom pipeline columns (superseded by localStorage in usePipelineColumns.ts)
DROP TABLE IF EXISTS public.pipeline_column_values CASCADE;
DROP TABLE IF EXISTS public.pipeline_columns CASCADE;

-- Email metadata (0 rows, only referenced by dead EmailActionBar.tsx)
DROP TABLE IF EXISTS public.email_metadata CASCADE;

-- Checklist templates (0 rows, unused)
DROP TABLE IF EXISTS public.checklist_template_items CASCADE;
DROP TABLE IF EXISTS public.checklist_templates CASCADE;

-- Feed comments (0 rows, unused)
DROP TABLE IF EXISTS public.feed_comments CASCADE;

-- Partner commissions (0 rows, unused — partner portal not live)
DROP TABLE IF EXISTS public.partner_commissions CASCADE;

-- Partner referral status history (0 rows, unused)
DROP TABLE IF EXISTS public.partner_referral_status_history CASCADE;

-- Task files (0 rows, unused)
DROP TABLE IF EXISTS public.task_files CASCADE;
