-- =============================================================================
-- Add deal_outcome column to deal pipeline tables
-- =============================================================================
-- Introduces a new `deal_outcome` enum (open | won | lost | abandoned) that is
-- independent of the existing `status` (stage) column. The ExpandedLeftColumn
-- "Status" dropdown now writes to this column so deal-outcome tracking is
-- decoupled from pipeline-stage tracking.
--
-- Applied to: potential, underwriting, lender_management
-- Default for existing rows: 'open', except rows where status already reflects
-- 'won' or 'lost' — those are backfilled to match.
-- =============================================================================

-- 1. Create the deal_outcome enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_outcome') THEN
    CREATE TYPE public.deal_outcome AS ENUM ('open', 'won', 'lost', 'abandoned');
  END IF;
END
$$;

-- 2. Add deal_outcome column to each deal pipeline table (idempotent)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['potential', 'underwriting', 'lender_management'] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deal_outcome public.deal_outcome NOT NULL DEFAULT ''open''',
      tbl
    );
  END LOOP;
END
$$;

-- 3. Backfill deal_outcome from existing status values where possible
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['potential', 'underwriting', 'lender_management'] LOOP
    EXECUTE format(
      'UPDATE public.%I SET deal_outcome = ''won''::public.deal_outcome WHERE status = ''won''::public.lead_status AND deal_outcome = ''open''::public.deal_outcome',
      tbl
    );
    EXECUTE format(
      'UPDATE public.%I SET deal_outcome = ''lost''::public.deal_outcome WHERE status = ''lost''::public.lead_status AND deal_outcome = ''open''::public.deal_outcome',
      tbl
    );
  END LOOP;
END
$$;
