# Local Seed Scripts

These were previously deployed as Supabase edge functions (`seed-test-data`, `seed-partners`). They were moved here and refactored into plain one-shot Deno scripts so they can't run as production endpoints.

Run locally:

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  deno run --allow-net --allow-env scripts/seed/seed-test-data/index.ts

SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  deno run --allow-net --allow-env scripts/seed/seed-partners/index.ts
```

Each script runs its `main()` once and exits. There's no HTTP listener — do not deploy these as edge functions.

**Never run these against production.** They create users with predictable passwords.
