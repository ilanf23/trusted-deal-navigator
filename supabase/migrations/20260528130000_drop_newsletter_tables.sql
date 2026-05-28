-- Drop newsletter feature tables (admin Newsletter page and edge functions removed)
-- The `questionnaires.newsletter_signup` column is intentionally preserved — it
-- powers a public "sign up for news and updates" checkbox on the Questionnaire
-- form and is unrelated to the campaign management tables removed here.

DROP TABLE IF EXISTS public.newsletter_campaign_events CASCADE;
DROP TABLE IF EXISTS public.newsletter_campaigns CASCADE;
DROP TABLE IF EXISTS public.newsletter_templates CASCADE;
