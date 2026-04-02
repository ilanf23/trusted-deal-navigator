-- Phase 1: Add missing indexes for commonly queried columns
-- Zero-risk, additive only — no schema changes

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
CREATE INDEX IF NOT EXISTS idx_communications_lead_created ON public.communications(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lead_responses_lead_id ON public.lead_responses(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_member_id ON public.tasks(team_member_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_team_member_id ON public.appointments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON public.appointments(start_time);
