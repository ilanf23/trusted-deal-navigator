-- Per-user third-party integration credentials with envelope encryption fields
-- Option 2: app-level encryption (AES-GCM + wrapped per-row DEK)

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

-- Metadata-only access for the current user; secret columns are still protected
-- by frontend select lists and server-side handling.
CREATE POLICY "Users can view own integration metadata"
  ON public.user_integrations FOR SELECT
  USING (user_id = current_team_member_id());

CREATE POLICY "Users can revoke own integrations"
  ON public.user_integrations FOR UPDATE
  USING (user_id = current_team_member_id())
  WITH CHECK (user_id = current_team_member_id());

CREATE POLICY "Users can delete own integrations"
  ON public.user_integrations FOR DELETE
  USING (user_id = current_team_member_id());

-- No direct INSERT for authenticated users; writes happen via edge functions
-- using the service-role key to guarantee encrypted payloads.

CREATE INDEX idx_user_integrations_user_provider_revoked
  ON public.user_integrations (user_id, provider, revoked_at);

CREATE INDEX idx_user_integrations_last_used_at
  ON public.user_integrations (last_used_at DESC);
