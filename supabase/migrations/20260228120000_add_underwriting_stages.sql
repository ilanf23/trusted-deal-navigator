-- Add new underwriting sub-stages to lead_status enum
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'review_kill_keep';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'waiting_on_needs_list';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'waiting_on_client';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'complete_files_for_review';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'need_structure_from_brad';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'maura_underwriting';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'brad_underwriting';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'uw_paused';
