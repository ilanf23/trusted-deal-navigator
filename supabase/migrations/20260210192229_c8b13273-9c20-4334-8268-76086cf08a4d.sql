
-- Create partner_tracking table
CREATE TABLE public.partner_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid NOT NULL,
  referral_id uuid NOT NULL REFERENCES public.partner_referrals(id) ON DELETE CASCADE,
  tracking_status text NOT NULL DEFAULT 'active',
  priority text NOT NULL DEFAULT 'normal',
  internal_notes text,
  last_contacted_at timestamp with time zone,
  next_follow_up date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(partner_id, referral_id)
);

-- Enable RLS
ALTER TABLE public.partner_tracking ENABLE ROW LEVEL SECURITY;

-- Partners can manage their own tracking records
CREATE POLICY "Partners can view own tracking"
  ON public.partner_tracking FOR SELECT
  USING (auth.uid() = partner_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can insert own tracking"
  ON public.partner_tracking FOR INSERT
  WITH CHECK (auth.uid() = partner_id AND has_role(auth.uid(), 'partner'::app_role));

CREATE POLICY "Partners can update own tracking"
  ON public.partner_tracking FOR UPDATE
  USING (auth.uid() = partner_id AND has_role(auth.uid(), 'partner'::app_role));

CREATE POLICY "Partners can delete own tracking"
  ON public.partner_tracking FOR DELETE
  USING (auth.uid() = partner_id AND has_role(auth.uid(), 'partner'::app_role));

-- Admins full access
CREATE POLICY "Admins can manage all tracking"
  ON public.partner_tracking FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_partner_tracking_updated_at
  BEFORE UPDATE ON public.partner_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_tracking;
