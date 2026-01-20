-- Add 'questionnaire' status to lead_status enum between discovery and pre_qualification
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'questionnaire' AFTER 'discovery';