# Local Seed Scripts

These were previously deployed as Supabase edge functions (`seed-test-data`, `seed-partners`). They were moved here so they don't run as production endpoints.

They're still Deno scripts. Run locally with:

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  deno run --allow-net --allow-env scripts/seed/seed-test-data/index.ts

SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  deno run --allow-net --allow-env scripts/seed/seed-partners/index.ts
```

Each `index.ts` exposes a `Deno.serve` handler — invoke its inner logic by POSTing to `http://localhost:8000` after `deno run`, or refactor the inner block into a plain async function if you want a one-shot.

**Never run these against production.** They create users with predictable passwords.
