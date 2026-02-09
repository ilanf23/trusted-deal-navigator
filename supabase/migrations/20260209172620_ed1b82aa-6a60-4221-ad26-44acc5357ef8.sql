
-- Create partner_referrals table
CREATE TABLE public.partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  company_name text,
  loan_amount numeric,
  loan_type text,
  property_address text,
  urgency text DEFAULT 'Standard',
  notes text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own referrals"
  ON public.partner_referrals FOR SELECT
  USING (auth.uid() = partner_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can insert own referrals"
  ON public.partner_referrals FOR INSERT
  WITH CHECK (auth.uid() = partner_id AND has_role(auth.uid(), 'partner'::app_role));

CREATE POLICY "Admins can manage all referrals"
  ON public.partner_referrals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can update own referrals"
  ON public.partner_referrals FOR UPDATE
  USING (auth.uid() = partner_id AND has_role(auth.uid(), 'partner'::app_role));

-- Create partner_referral_status_history table
CREATE TABLE public.partner_referral_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.partner_referrals(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.partner_referral_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own referral history"
  ON public.partner_referral_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_referrals pr
      WHERE pr.id = partner_referral_status_history.referral_id
        AND (pr.partner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Admins can manage all referral history"
  ON public.partner_referral_status_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create partner_commissions table
CREATE TABLE public.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  referral_id uuid REFERENCES public.partner_referrals(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own commissions"
  ON public.partner_commissions FOR SELECT
  USING (auth.uid() = partner_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all commissions"
  ON public.partner_commissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION public.log_partner_referral_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.partner_referral_status_history (referral_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_partner_referral_status_change
  AFTER UPDATE ON public.partner_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_partner_referral_status_change();

-- Insert initial status on creation
CREATE OR REPLACE FUNCTION public.log_partner_referral_initial_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.partner_referral_status_history (referral_id, old_status, new_status)
  VALUES (NEW.id, NULL, NEW.status);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_partner_referral_initial_status
  AFTER INSERT ON public.partner_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_partner_referral_initial_status();

-- Updated_at trigger
CREATE TRIGGER update_partner_referrals_updated_at
  BEFORE UPDATE ON public.partner_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_referral_status_history;
