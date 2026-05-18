# Per-User Integration KEK Rotation Runbook

This runbook rotates the key-encryption-key (KEK) used for `user_integrations`.

## Scope

- Storage model: app-level envelope encryption (AES-256-GCM)
- DEK per row (`encrypted_dek`, `dek_iv`, `dek_auth_tag`)
- KEK in env vars (`SECRETS_KEK_V1`, `SECRETS_KEK_V2`, etc.)
- Row `key_version` indicates which KEK decrypts the wrapped DEK

## Preconditions

- Migration `create_user_integrations` is applied.
- `add-user-integration`, `revoke-user-integration`, and `rewrap-user-integrations` edge functions are deployed.
- You have maintenance access to Supabase edge secrets and Vercel environment variables.
- You are signed in as an admin or super_admin (the re-wrap function is admin-gated).

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

Invoke the `rewrap-user-integrations` edge function (admin-only, rate-limited
5/60s). It scans rows on the old `key_version`, unwraps each DEK with the old
KEK, re-wraps with the new KEK, and updates `encrypted_dek`, `dek_iv`,
`dek_auth_tag`, `key_version`. The `ciphertext` is **never** touched.

Dry-run first to verify counts and confirm both KEKs decrypt cleanly:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/rewrap-user-integrations" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"from_version":1,"to_version":2,"batch_size":200,"dry_run":true}'
```

Then run for real, looping until `remaining_on_from_version` is `0`:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/rewrap-user-integrations" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"from_version":1,"to_version":2,"batch_size":200}'
```

Response shape:

```json
{
  "scanned": 200,
  "rewrapped": 200,
  "failed": 0,
  "dry_run": false,
  "remaining_on_from_version": 0
}
```

The function logs counts only — never plaintext, never key material. Each
update is guarded by `key_version = from_version`, so concurrent invocations
cannot double-wrap a row.

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
