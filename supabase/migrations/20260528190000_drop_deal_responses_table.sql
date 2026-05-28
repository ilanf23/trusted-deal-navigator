-- Drop the deal_responses (loan-intake questionnaire) table.
--
-- Context: the public-facing intake questionnaire form (src/pages/Questionnaire.tsx)
-- and the send-prequalification-email edge function were removed in the same
-- change. The deal_responses table held questionnaire submissions and was
-- empty in production. The "Send Questionnaire" auto-trigger on stage
-- transitions was removed from CRMBoard and EmployeePipeline.
--
-- The `questionnaire` value in the lead_status enum is intentionally left in
-- place — it represents a pipeline stage (waiting on borrower info) that
-- exists independently of the form, and dropping enum values is destructive.

drop table if exists public.deal_responses cascade;
