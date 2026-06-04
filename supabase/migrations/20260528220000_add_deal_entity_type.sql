-- Add a single canonical 'deal' discriminator to entity_type_enum (#97).
--
-- Polymorphic child tables currently tag deals with pipeline-specific values
-- ('pipeline'/'potential'/'underwriting'/'lender_management'). After the
-- consolidation in 20260528181000_consolidate_deal_tables.sql, a deal has one
-- stable id regardless of pipeline, so its children use one value: 'deal'.
--
-- This MUST be a separate migration from the consolidation: Postgres forbids
-- using a newly-added enum value in the same transaction that adds it.
ALTER TYPE public.entity_type_enum ADD VALUE IF NOT EXISTS 'deal';
