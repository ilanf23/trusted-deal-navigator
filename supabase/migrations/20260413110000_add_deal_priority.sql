-- =============================================================================
-- Convert priority on deal pipeline tables to a deal_priority enum
-- =============================================================================
-- Constrains the existing `priority` column on potential, underwriting, and
-- lender_management to low | medium | high (NULL = "none"). The ExpandedLeftColumn
-- "Priority" dropdown writes to this column using a fixed four-option list.
-- =============================================================================

-- 1. Create the deal_priority enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_priority') THEN
    CREATE TYPE public.deal_priority AS ENUM ('low', 'medium', 'high');
  END IF;
END
$$;

-- 2. Normalize existing priority values (lowercase; unrecognized → NULL)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['potential', 'underwriting', 'lender_management'] LOOP
    EXECUTE format(
      'UPDATE public.%I SET priority = LOWER(priority) WHERE priority IS NOT NULL AND priority <> LOWER(priority)',
      tbl
    );
    EXECUTE format(
      'UPDATE public.%I SET priority = NULL WHERE priority IS NOT NULL AND priority NOT IN (''low'',''medium'',''high'')',
      tbl
    );
  END LOOP;
END
$$;

-- 3. Convert column type from text to deal_priority
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['potential', 'underwriting', 'lender_management'] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN priority TYPE public.deal_priority USING priority::public.deal_priority',
      tbl
    );
  END LOOP;
END
$$;
