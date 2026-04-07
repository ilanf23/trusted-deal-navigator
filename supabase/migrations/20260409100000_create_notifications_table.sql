-- Create general-purpose notifications table with per-user scoping
-- Each user sees only their own notifications; super_admins see all.

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email','lead','opportunity','project','closed','system')),
  title TEXT NOT NULL,
  description TEXT,
  link_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: own notifications, super_admin sees all
CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (
    team_member_id = current_team_member_id()
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- UPDATE: users can mark their own as read
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (team_member_id = current_team_member_id());

-- INSERT: admin or super_admin
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- DELETE: admin or super_admin
CREATE POLICY "Admins can delete notifications"
  ON public.notifications FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Index for primary query: user's notifications sorted by recency, unread first
CREATE INDEX idx_notifications_user_read_created
  ON public.notifications (team_member_id, is_read, created_at DESC);

-- Enable realtime for live notification delivery
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
