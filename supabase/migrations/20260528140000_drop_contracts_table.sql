-- Drop the contracts feature entirely (admin Contracts page and routes removed).
-- The feature was a never-completed stub: contracts could be drafted and "sent",
-- but no client-facing view/sign flow ever existed (the portal half was removed),
-- so the signature columns were never populated. CASCADE drops dependent RLS
-- policies. The contract_status enum was used only by this table.

DROP TABLE IF EXISTS public.contracts CASCADE;
DROP TYPE IF EXISTS public.contract_status;
