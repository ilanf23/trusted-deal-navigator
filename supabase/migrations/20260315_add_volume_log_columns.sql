-- Phase 1: Add Volume Log columns to leads table + supporting tables

-- ── New columns on leads ──
ALTER TABLE leads ADD COLUMN IF NOT EXISTS target_closing_date date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS clx_agreement boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loan_category text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS wu_date date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loan_stage text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS won boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lender_type text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lender_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loss_reason text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fee_percent numeric(5,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS potential_revenue numeric(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rs_fee_percent numeric(5,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rs_revenue numeric(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS net_revenue numeric(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS invoice_amount numeric(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS actual_net_revenue numeric(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS volume_log_status text DEFAULT 'Active';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sheets_row_index integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sheets_last_synced_at timestamptz;

-- ── lead_signals table ──
CREATE TABLE IF NOT EXISTS lead_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_signals_lead_id ON lead_signals(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_signals_severity ON lead_signals(severity);

-- ── volume_log_sync_config table ──
CREATE TABLE IF NOT EXISTS volume_log_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id text NOT NULL,
  sheet_name text,
  column_mapping jsonb NOT NULL DEFAULT '{}',
  header_row jsonb,
  last_pull_at timestamptz,
  last_push_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE lead_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE volume_log_sync_config ENABLE ROW LEVEL SECURITY;

-- RLS policies: admins can do everything
CREATE POLICY "Admins can manage lead_signals" ON lead_signals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage volume_log_sync_config" ON volume_log_sync_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
