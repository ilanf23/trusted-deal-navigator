-- Drop unused entity_checklists + entity_checklist_items tables.
--
-- These tables were created by 20260412100000_platform_migration_readiness.sql
-- as a polymorphic replacement for underwriting_checklists, but the cutover
-- never happened. Zero application code references them. Underwriting still
-- uses underwriting_checklists + underwriting_checklist_items.
--
-- The cleanup_deal_polymorphic_children() trigger function still references
-- entity_checklists; we patch it here before dropping the tables, otherwise
-- deal deletion would fail at runtime.

-- 1. Patch the trigger function to remove its dependency on entity_checklists.
--    Every other DELETE block is preserved verbatim from the original
--    definition in 20260412100000_platform_migration_readiness.sql.
CREATE OR REPLACE FUNCTION public.cleanup_deal_polymorphic_children()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entity_type_val public.entity_type_enum;
BEGIN
  entity_type_val := TG_ARGV[0]::public.entity_type_enum;

  DELETE FROM public.activities
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.activity_comments
    WHERE lead_id = OLD.id;
  DELETE FROM public.entity_contacts
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_files
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_projects
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.notes
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_emails
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_phones
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_addresses
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;

  RETURN OLD;
END $$;

-- 2. Drop the child table first (FK to entity_checklists).
DROP TABLE IF EXISTS public.entity_checklist_items;

-- 3. Drop the parent table.
DROP TABLE IF EXISTS public.entity_checklists;
