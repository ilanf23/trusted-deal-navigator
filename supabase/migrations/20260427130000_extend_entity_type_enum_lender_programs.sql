-- Extend entity_type_enum to include 'lender_programs' so the new
-- LenderExpandedView can write follows, activities, comments, and
-- satellite-table rows with entity_type = 'lender_programs'. This
-- mirrors how 'companies' and 'people' are handled by the polymorphic
-- entity tables (entity_followers, activities, activity_comments,
-- entity_emails, entity_phones, entity_addresses, etc.).
--
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is idempotent on Postgres 9.6+
-- so this migration is safe to re-run.

ALTER TYPE public.entity_type_enum ADD VALUE IF NOT EXISTS 'lender_programs';
