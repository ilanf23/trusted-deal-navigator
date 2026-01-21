-- Create pipeline_shares table for managing pipeline access
CREATE TABLE public.pipeline_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  shared_with_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'view' CHECK (access_level IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.team_members(id),
  UNIQUE(owner_id, shared_with_id)
);

-- Enable RLS
ALTER TABLE public.pipeline_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all shares
CREATE POLICY "Admins can manage pipeline shares"
ON public.pipeline_shares
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Pipeline owners can manage their own shares
CREATE POLICY "Owners can manage their pipeline shares"
ON public.pipeline_shares
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = pipeline_shares.owner_id
    AND tm.user_id = auth.uid()
  )
);

-- Policy: Shared users can view shares they're part of
CREATE POLICY "Users can view shares they have access to"
ON public.pipeline_shares
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = pipeline_shares.shared_with_id
    AND tm.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_pipeline_shares_owner ON public.pipeline_shares(owner_id);
CREATE INDEX idx_pipeline_shares_shared_with ON public.pipeline_shares(shared_with_id);

-- Add updated_at column with trigger
ALTER TABLE public.pipeline_shares ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

CREATE TRIGGER update_pipeline_shares_updated_at
  BEFORE UPDATE ON public.pipeline_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();