-- Link people to companies relationally (bug 040d7791 / ef733e9b).
--
-- people.company_id (FK -> companies) already exists but was never populated:
-- the UI only ever stored a free-text company_name on the person. The Add
-- Person flow now finds-or-creates a company row and sets company_id directly;
-- this migration backfills existing rows where the free-text name matches an
-- existing company (case-insensitive, trimmed). Ties on duplicate company
-- names resolve to the oldest company row.

UPDATE public.people p
SET company_id = (
  SELECT c.id
  FROM public.companies c
  WHERE lower(trim(c.company_name)) = lower(trim(p.company_name))
  ORDER BY c.created_at ASC
  LIMIT 1
)
WHERE p.company_id IS NULL
  AND nullif(trim(p.company_name), '') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE lower(trim(c.company_name)) = lower(trim(p.company_name))
  );

-- The FK has no automatic index; the company page now lists its people via
-- people.company_id, so index the lookup.
CREATE INDEX IF NOT EXISTS idx_people_company_id ON public.people (company_id);
