

## Plan: Create Dropbox Database Infrastructure + Fix Build Error

### What's Missing
The migration file `supabase/migrations/20260304_dropbox_tables.sql` exists in the repo but was **never executed**. The database has zero Dropbox tables. Additionally, `DropboxFilePicker.tsx` references the non-existent `dropbox_files` table, causing a TypeScript build error.

### Changes

**1. Run the database migration** (via migration tool)
Execute the SQL from the existing migration file to create:
- `dropbox_connections` table (shared OAuth tokens, single row per company)
- `dropbox_files` table (file metadata, text index, lead linking)
- RLS policies restricting both tables to admin role
- Indexes for path, lead, full-text search, and extraction status

**2. Add secrets** (if not already present)
The edge functions need `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET`. These are not in the current secrets list — will need to prompt for them.

**3. Fix `DropboxFilePicker.tsx` build error**
The query on line 70 uses `.from('dropbox_files')` which isn't in the auto-generated types yet. After the migration runs and types regenerate, this should resolve automatically. If not, cast with `as any` temporarily to unblock the build.

### No Code File Changes Needed
The migration creates all the infrastructure. The existing edge functions (`dropbox-auth`, `dropbox-api`, `dropbox-sync`) and hooks (`useDropbox`, `useDropboxConnection`) are already correctly written against these tables.

