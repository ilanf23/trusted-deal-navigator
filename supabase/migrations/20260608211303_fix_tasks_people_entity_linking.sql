-- Fix bug 30: "Task creation does not work" on person profiles.
--
-- Two root causes, both fixed here:
--  1. The legacy task_type CHECK constraint (evan_tasks_task_type_check) only
--     allowed call|email|internal, but the task dialog offers to_do (default),
--     phone_call, meeting, email, follow_up. Four of five options were rejected
--     by Postgres, so every default "To Do" task failed to insert.
--  2. tasks.lead_id is a FK to deals, so person tasks (lead_id = a people id)
--     violated the FK. Tasks had an entity_type enum (incl. 'people') but no
--     entity_id column, so there was no valid way to link a task to a person.

-- 1. Replace the stale task_type CHECK with the vocabulary the app actually uses.
--    Keep legacy 'call' and 'internal' for the 28 existing rows that use them.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS evan_tasks_task_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (
    task_type IS NULL
    OR task_type IN ('to_do', 'phone_call', 'meeting', 'email', 'follow_up', 'call', 'internal')
  );

-- 2. Add a polymorphic entity_id so a task can link to a person (or any entity),
--    mirroring the entity_id + entity_type pattern used by activities,
--    entity_emails, entity_phones, etc. Nullable and unconstrained by FK because
--    it is polymorphic across people/companies/deals (entity_type discriminates).
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS entity_id uuid;

CREATE INDEX IF NOT EXISTS idx_tasks_entity ON public.tasks (entity_type, entity_id);
