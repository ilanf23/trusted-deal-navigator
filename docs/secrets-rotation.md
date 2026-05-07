# Per-User Integration KEK Rotation Runbook

This runbook rotates the key-encryption-key (KEK) used for `user_integrations`.

## Scope

- Storage model: app-level envelope encryption (AES-256-GCM)
- DEK per row (`encrypted_dek`, `dek_iv`, `dek_auth_tag`)
- KEK in env vars (`SECRETS_KEK_V1`, `SECRETS_KEK_V2`, etc.)
- Row `key_version` indicates which KEK decrypts the wrapped DEK

## Preconditions

- Migration `create_user_integrations` is applied.
- `read-user-integration` and `add-user-integration` edge functions are deployed.
- You have maintenance access to Supabase edge secrets and Vercel environment variables.

## 1) Generate New KEK

Generate a 32-byte key as hex:

```bash
openssl rand -hex 32
```

Store safely in your password manager under `SECRETS_KEK_V2`.

## 2) Set New KEK in Both Runtimes

- Supabase edge function secret: set `SECRETS_KEK_V2`
- Vercel environment variable: set `SECRETS_KEK_V2`

Do not remove `SECRETS_KEK_V1` yet.

## 3) Deploy Dual-Key Code

Deploy code that can decrypt by `key_version`:

- `key_version = 1` -> `SECRETS_KEK_V1`
- `key_version = 2` -> `SECRETS_KEK_V2`

New writes should start using `key_version = 2`.

## 4) Re-wrap Existing DEKs

Run a batch migration script from a trusted server process:

1. Read row in `user_integrations`
2. Unwrap DEK with old KEK (v1)
3. Re-wrap the same DEK with new KEK (v2)
4. Update `encrypted_dek`, `dek_iv`, `dek_auth_tag`, `key_version = 2`

Do not re-encrypt `ciphertext`; only re-wrap DEKs.

Process in batches and log row counts only (never plaintext, never key material).

## 5) Verify

- Query remaining rows on old version:
  - `SELECT count(*) FROM public.user_integrations WHERE key_version = 1;`
- Must be `0` before retirement of old key.
- Spot-check decrypt reads from application paths.

## 6) Retire Old KEK

- Remove `SECRETS_KEK_V1` from Supabase and Vercel
- Redeploy to ensure stale env snapshots are dropped

## Rollback

If errors occur mid-rotation:

- Keep both KEKs configured
- Re-run re-wrap batch for failed rows
- If needed, temporarily route new writes back to prior `key_version`

Never delete old KEK until all rows are confirmed migrated and reads are healthy.
