-- Per-user third-party integration credentials with envelope encryption fields.
-- Admin-assigned model: only admins/super_admins write or revoke; users see their own.
-- Encryption: AES-GCM + wrapped per-row DEK (see supabase/functions/_shared/crypto.ts).

CREATE TABLE public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  ciphertext BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  encrypted_dek BYTEA NOT NULL,
  dek_iv BYTEA NOT NULL,
  dek_auth_tag BYTEA NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, provider, label)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- A user can see metadata for keys assigned to them (read-only).
CREATE POLICY "Users can view own integration metadata"
  ON public.user_integrations FOR SELECT
  USING (user_id = current_team_member_id());

-- Admins and super_admins can see all integrations (for the admin assignment UI).
CREATE POLICY "Admins can view all integration metadata"
  ON public.user_integrations FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Writes (insert/update/delete) are not allowed directly. They go through
-- service-role edge functions (add-user-integration, revoke-user-integration)
-- which enforce admin role + handle encryption.

CREATE INDEX idx_user_integrations_user_provider_revoked
  ON public.user_integrations (user_id, provider, revoked_at);

CREATE INDEX idx_user_integrations_last_used_at
  ON public.user_integrations (last_used_at DESC);
